import { formatCairoDateTime } from '../../lib/cairoTime';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ClipboardList, Lock, ServerCrash } from 'lucide-react';
import ExamResultView from '../../components/exam/ExamResultView';
import ExamTaker from '../../components/exam/ExamTaker';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Spinner,
  buttonClasses,
  useToast,
} from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useCourse } from '../../hooks/useCourses';
import {
  KIND_LABELS,
  MAX_ATTEMPTS,
  LATE_PENALTY_PERCENT,
  getEffectiveDurationMinutes,
  getEffectiveStrict,
} from '../../lib/grading';
import type { AttemptResult } from '../../lib/grading';
import {
  GradingPendingError,
  findItem,
  formatDateTime,
  getAssessmentAccess,
  getAssessmentErrorMessage,
  getAttemptsFor,
  gradeForPreview,
  gradeSubmittedAttempt,
  isNewStyleAssessment,
  loadQuestions,
  loadSubmissions,
  parseExamResults,
  submitNewStyleAttempt,
  submitWithClientGrading,
  toAssessment,
} from '../../services/assessments';
import type { LoadedQuestions, SubmissionRecord } from '../../services/assessments';
import { canAccessCourseContent, getVisibleSections } from '../../services/courses';
import { getContentRules } from '../../services/contentRules';
import { getAllLocalWatchProgress } from '../../services/watchProgress';
import { getCourseAccessStatus } from '../../lib/subscriptions';
import {
  DEFAULT_CONTENT_RULES,
  formatMissingRequirementText,
  getAssessmentPrerequisiteDiagnostics,
} from '../../lib/contentRules';
import type { ContentRulesSettings } from '../../lib/contentRules';

type Stage = 'intro' | 'taking' | 'grading' | 'result';

interface QuestionsState {
  loading: boolean;
  error: boolean;
  permissionDenied?: boolean;
  data: LoadedQuestions | null;
}

interface SubmissionsState {
  loading: boolean;
  error: boolean;
  permissionDenied?: boolean;
  data: SubmissionRecord[] | null;
}

interface PreviousAttempt {
  attemptNumber: number;
  isOfficial: boolean;
  needsReview: boolean;
  effectivePercent: number;
}

export default function AssessmentPage() {
  const { courseId, itemId } = useParams();
  const { firebaseUser, student, isAdmin, refresh } = useAuth();
  const { showToast } = useToast();
  const { course, loading, error, reload } = useCourse(courseId);

  const [stage, setStage] = useState<Stage>('intro');
  const [contentRules, setContentRules] = useState<ContentRulesSettings>(DEFAULT_CONTENT_RULES);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [questionsState, setQuestionsState] = useState<QuestionsState>({
    loading: true,
    error: false,
    permissionDenied: false,
    data: null,
  });
  const [questionsReload, setQuestionsReload] = useState(0);
  const [submissionsState, setSubmissionsState] = useState<SubmissionsState>({
    loading: false,
    error: false,
    permissionDenied: false,
    data: null,
  });
  const [submissionsReload, setSubmissionsReload] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getContentRules()
      .then((loadedRules) => {
        if (active) {
          setContentRules(loadedRules);
          setRulesLoaded(true);
        }
      })
      .catch(() => {
        if (active) setRulesLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const uid = firebaseUser?.uid ?? '';
  const sections = course ? getVisibleSections(course.sections, { includeHidden: isAdmin }) : [];
  const item = course && itemId ? findItem(sections, itemId) : null;
  const assessment = course && item ? toAssessment(course.id, item) : null;
  const canAccess = course ? canAccessCourseContent(course, student, isAdmin) : false;
  const assessmentId = assessment?.id ?? '';
  const newStyle = assessment ? isNewStyleAssessment(assessment) : false;

  const now = Date.now();
  const openAtMs = typeof (item as any)?.openAt === 'number'
    ? (item as any).openAt
    : (typeof (assessment as any)?.raw?.openAt === 'number' ? (assessment as any).raw.openAt : null);
  const closeAtMs = typeof (item as any)?.closeAt === 'number'
    ? (item as any).closeAt
    : (typeof (assessment as any)?.raw?.closeAt === 'number' ? (assessment as any).raw.closeAt : null);

  const isLockedOpenAt = !isAdmin && typeof openAtMs === 'number' && openAtMs > now;
  const isLockedCloseAt = !isAdmin && typeof closeAtMs === 'number' && closeAtMs > 0 && closeAtMs < now;

  const parsedResults = parseExamResults(student?.examResults);
  const localWatch = student?.id ? getAllLocalWatchProgress(student.id) : {};
  const effectiveWatch = { ...(student?.watchProgress || {}), ...localWatch };
  const grantStatus = course ? getCourseAccessStatus(course, student, isAdmin) : undefined;

  const prereqDiag =
    course && assessment && rulesLoaded
      ? getAssessmentPrerequisiteDiagnostics({
          course,
          assessment: {
            id: assessment.id,
            title: assessment.title,
            kind: assessment.kind,
            lockedUntilTrainingId: assessment.lockedUntilTrainingId,
            availableFrom: assessment.availableFrom,
            availableUntil: assessment.availableUntil,
            openAt: openAtMs,
            closeAt: closeAtMs,
            raw: (item as any)?.raw ?? (assessment as any)?.raw,
          },
          student,
          watchProgress: effectiveWatch,
          examResults: parsedResults,
          rules: contentRules,
          serverTime: now,
          isAdminOrOwner: isAdmin,
          grantStatus,
        })
      : { locked: false, message: '', missingItems: [] };

  const isFirebasePermissionDenied = (err: unknown): boolean => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    return (
      code.includes('permission-denied') ||
      (err instanceof Error && err.message.toLowerCase().includes('insufficient permissions'))
    );
  };

  useEffect(() => {
    if (!assessment || !canAccess || !rulesLoaded || isLockedOpenAt || isLockedCloseAt || prereqDiag.locked) {
      return;
    }

    let active = true;
    setQuestionsState({ loading: true, error: false, permissionDenied: false, data: null });

    loadQuestions(assessment, isAdmin)
      .then((data) => {
        if (active) setQuestionsState({ loading: false, error: false, permissionDenied: false, data });
      })
      .catch((err) => {
        if (active) {
          setQuestionsState({
            loading: false,
            error: true,
            permissionDenied: isFirebasePermissionDenied(err),
            data: null,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [assessmentId, canAccess, rulesLoaded, isLockedOpenAt, isLockedCloseAt, prereqDiag.locked, isAdmin, questionsReload]);

  // تسليمات الامتحانات الجديدة (حتى 3 قراءات) لمعرفة المحاولات المستخدمة وأي تصحيح لم يكتمل.
  useEffect(() => {
    if (
      !assessment ||
      !canAccess ||
      !rulesLoaded ||
      !newStyle ||
      isAdmin ||
      !uid ||
      isLockedOpenAt ||
      isLockedCloseAt ||
      prereqDiag.locked
    ) {
      return;
    }

    let active = true;
    setSubmissionsState({ loading: true, error: false, permissionDenied: false, data: null });

    loadSubmissions(uid, assessment.id)
      .then((data) => {
        if (active) setSubmissionsState({ loading: false, error: false, permissionDenied: false, data });
      })
      .catch((err) => {
        if (active) {
          setSubmissionsState({
            loading: false,
            error: true,
            permissionDenied: isFirebasePermissionDenied(err),
            data: null,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [assessmentId, canAccess, rulesLoaded, newStyle, isAdmin, uid, isLockedOpenAt, isLockedCloseAt, prereqDiag.locked, submissionsReload]);

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-gold-400">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={ServerCrash}
            title="تعذر تحميل الكورس"
            description="تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى."
            action={<Button onClick={reload}>إعادة المحاولة</Button>}
          />
        </Card>
      </div>
    );
  }

  if (!course || !assessment) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="العنصر غير موجود"
            description="الرابط غير صحيح أو تم نقل هذا الامتحان."
            action={
              <Link to="/student/exams" className={buttonClasses({ variant: 'primary' })}>
                الامتحانات والواجبات
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={Lock}
            title="هذا المحتوى للمشتركين فقط"
            description="اشترك في الكورس لتتمكن من فتحه."
            action={
              <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'primary' })}>
                تفاصيل الكورس
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (isLockedOpenAt) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={Lock}
            title="هذا المحتوى مقفول حاليًا"
            description={`يفتح يوم ${formatCairoDateTime(openAtMs!)}`}
            action={
              <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'secondary' })}>
                الرجوع للكورس
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (isLockedCloseAt) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <EmptyState
            icon={Lock}
            title="انتهى الوقت"
            description="انتهت الفترة المحددة للإجابة على هذا التقييم."
            action={
              <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'secondary' })}>
                الرجوع للكورس
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const results = parsedResults;
  const submissions = submissionsState.data;
  const legacyAttempts = getAttemptsFor(results, assessment);

  const access = getAssessmentAccess(
    assessment,
    sections,
    results,
    isAdmin,
    Date.now(),
    newStyle && !isAdmin ? (submissions?.length ?? 0) : undefined,
  );

  const pendingSubmission = submissions?.find((entry) => entry.result === null) ?? null;

  const previous: PreviousAttempt[] =
    newStyle && !isAdmin
      ? (submissions ?? []).flatMap((entry) =>
          entry.result
            ? [
                {
                  attemptNumber: entry.attempt,
                  isOfficial: entry.attempt === 1,
                  needsReview: entry.result.needsReview,
                  effectivePercent: entry.result.effectivePercent,
                },
              ]
            : [],
        )
      : legacyAttempts.map((attempt) => ({
          attemptNumber: attempt.attemptNumber,
          isOfficial: attempt.isOfficial,
          needsReview: attempt.needsReview,
          effectivePercent: attempt.effectivePercent,
        }));

  const kindLabel = KIND_LABELS[assessment.kind];
  const strict = getEffectiveStrict(assessment.kind, assessment.strictMode);
  const durationMinutes = getEffectiveDurationMinutes(
    assessment.kind,
    assessment.duration,
    assessment.strictMode,
  );

  const questionsData = questionsState.data;
  const questions = questionsData?.questions ?? [];

  const finishWithResult = async (graded: AttemptResult) => {
    await refresh();
    setResult(graded);
    setStage('result');
  };

  // يضيف أو يحدّث تسليمًا في القائمة المحلية بدون قراءات إضافية.
  const upsertSubmission = (record: SubmissionRecord) => {
    setSubmissionsState((previousState) => {
      const list = previousState.data ?? [];
      const others = list.filter((entry) => entry.attempt !== record.attempt);
      return {
        loading: false,
        error: false,
        data: [...others, record].sort((a, b) => a.attempt - b.attempt),
      };
    });
  };

  // إكمال تصحيح محاولة سُلّمت ولم يكتمل تصحيحها.
  const handleResumeGrading = async (record: SubmissionRecord) => {
    if (!student) return;

    setStage('grading');
    try {
      const graded = await gradeSubmittedAttempt({
        student,
        uid,
        assessment,
        attempt: record.attempt,
      });
      upsertSubmission({ ...record, result: graded });
      await finishWithResult(graded);
    } catch (resumeError) {
      showToast(getAssessmentErrorMessage(resumeError), 'error');
      setStage('intro');
    }
  };

  const handleSubmit = async (answers: Record<string, string>, autoSubmit: boolean): Promise<boolean> => {
    setSubmitting(true);

    try {
      if (isAdmin) {
        // معاينة الأدمن: تصحيح محلي بدون حفظ.
        setResult(gradeForPreview(assessment, questions, answers, autoSubmit));
        setStage('result');
        return true;
      }

      if (!student || !uid) return false;

      // الامتحانات القديمة: تصحيح في المتصفح كما كانت.
      if (!newStyle) {
        const graded = await submitWithClientGrading({
          student,
          assessment,
          questions,
          answers,
          autoSubmit,
        });
        await finishWithResult(graded);
        return true;
      }

      const attempt = (submissions?.length ?? 0) + 1;

      try {
        const graded = await submitNewStyleAttempt({
          student,
          uid,
          assessment,
          attempt,
          answers,
          autoSubmit,
        });
        upsertSubmission({
          attempt,
          submittedAtMs: graded.ts,
          answers,
          autoSubmit,
          result: graded,
        });
        await finishWithResult(graded);
        return true;
      } catch (submitError) {
        if (submitError instanceof GradingPendingError) {
          // التسليم محفوظ، لكن التصحيح لم يكتمل. يمكن إكماله من الصفحة.
          upsertSubmission({ attempt, submittedAtMs: Date.now(), answers, autoSubmit, result: null });
          showToast(
            'تم استلام إجاباتك لكن تعذر إكمال التصحيح. اضغط «إكمال التصحيح» في الصفحة.',
            'error',
          );
          setStage('intro');
          return true;
        }
        throw submitError;
      }
    } catch (submitError) {
      showToast(getAssessmentErrorMessage(submitError), 'error');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setStage('intro');
  };

  const backLink = (
    <Link
      to={isAdmin ? `/admin/courses/${course.id}` : `/courses/${course.id}`}
      className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-400 hover:text-gold-300"
    >
      <ArrowRight className="h-4 w-4" />
      {isAdmin ? 'العودة لتعديل الكورس' : 'العودة للكورس'}
    </Link>
  );

  let content;

  if (stage === 'taking') {
    content = (
      <ExamTaker
        examId={assessment.id}
        questions={questions}
        durationSeconds={durationMinutes * 60}
        strict={strict}
        previewMode={isAdmin}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    );
  } else if (stage === 'grading') {
    content = (
      <Card className="space-y-4 text-center">
        <div className="mx-auto text-gold-400">
          <Spinner size="lg" />
        </div>
        <h2 className="text-lg font-bold text-white">جارٍ تصحيح إجاباتك...</h2>
      </Card>
    );
  } else if (stage === 'result' && result) {
    content = (
      <div className="space-y-5">
        <ExamResultView result={result} preview={isAdmin} />
        <div className="flex flex-wrap gap-3">
          {!isAdmin && (
            <>
              <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'secondary' })}>
                العودة للكورس
              </Link>
              <Link to="/student/exams" className={buttonClasses({ variant: 'ghost' })}>
                الامتحانات والواجبات
              </Link>
            </>
          )}
          {(isAdmin || access.attemptsUsed < MAX_ATTEMPTS) && (
            <Button onClick={handleRetry}>محاولة جديدة</Button>
          )}
        </div>
      </div>
    );
  } else {
    let startArea;

    if (!rulesLoaded) {
      startArea = (
        <div className="flex justify-center text-gold-400">
          <Spinner />
        </div>
      );
    } else if (prereqDiag.locked) {
      startArea = (
        <div
          data-no-motion="true"
          className="no-motion space-y-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3.5 text-sm text-amber-100 [html.light_&]:border-amber-700/40 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-950"
        >
          <div className="flex items-start gap-2.5 font-bold">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-300 [html.light_&]:text-amber-800" />
            <span>لا يمكنك فتح {kindLabel} حاليًا — أكمل المتطلبات التالية أولًا:</span>
          </div>
          {prereqDiag.missingItems.length > 0 ? (
            <ul className="space-y-2 ps-7 text-xs leading-relaxed">
              {prereqDiag.missingItems.map((req) => {
                const reqLink =
                  req.kind === 'training' || req.kind === 'homework' || req.kind === 'lockedTraining'
                    ? `/student/assessment/${encodeURIComponent(course.id)}/${encodeURIComponent(req.id)}`
                    : null;
                return (
                  <li key={`${req.kind}:${req.id}`} className="flex flex-wrap items-center justify-between gap-2">
                    <span>• {formatMissingRequirementText(req)}</span>
                    {reqLink ? (
                      <Link
                        to={reqLink}
                        className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-200 underline-offset-2 hover:underline [html.light_&]:bg-amber-200 [html.light_&]:text-amber-950"
                      >
                        الانتقال للحل
                      </Link>
                    ) : req.kind === 'watch' ? (
                      <Link
                        to={`/courses/${encodeURIComponent(course.id)}`}
                        className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-200 underline-offset-2 hover:underline [html.light_&]:bg-amber-200 [html.light_&]:text-amber-950"
                      >
                        مشاهدة المحاضرة
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ps-7 text-xs leading-relaxed">{prereqDiag.message}</p>
          )}
        </div>
      );
    } else if (access.state !== 'open') {
      startArea = (
        <div
          data-no-motion="true"
          className="no-motion flex items-start gap-2.5 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3.5 py-3 text-sm text-gold-200 [html.light_&]:border-amber-700/40 [html.light_&]:bg-amber-50 [html.light_&]:text-amber-950"
        >
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gold-300 [html.light_&]:text-amber-800" />
          <span>{access.message}</span>
        </div>
      );
    } else if (questionsState.loading || (newStyle && !isAdmin && submissionsState.loading)) {
      startArea = (
        <div className="flex justify-center text-gold-400">
          <Spinner />
        </div>
      );
    } else if (questionsState.error || (newStyle && !isAdmin && submissionsState.error)) {
      const isPermDenied = Boolean(questionsState.permissionDenied || submissionsState.permissionDenied);
      const isTemporaryGrant =
        grantStatus?.plan === 'trial_lecture' ||
        (Boolean(grantStatus?.isSelfClaimed) && !student?.courses.includes(course.id));
      startArea = (
        <div
          data-no-motion="true"
          className="no-motion space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5 text-center [html.light_&]:border-rose-700/30 [html.light_&]:bg-rose-50"
        >
          <p className="text-sm font-bold text-rose-200 [html.light_&]:text-rose-950">
            {isPermDenied
              ? 'تعذر فتح أسئلة الاختبار بسبب قيود صلاحيات الخادم (Permission Denied).'
              : 'تعذر تحميل بيانات الاختبار.'}
          </p>
          {isPermDenied && (
            <p className="text-xs leading-relaxed text-slate-300 [html.light_&]:text-slate-800">
              {isTemporaryGrant
                ? 'تم فتح الكورس لك عبر الاشتراك التجريبي/الشهري الذاتي بينما تتطلب قواعد أمان قاعدة البيانات حاليًا إدراج الكورس في الاشتراك الرسمي لقراءة أسئلة الاختبار.'
                : 'يرجى إعادة تسجيل الدخول أو مراجعة الإدارة لتأكيد تفعيل اشتراك الكورس على حسابك.'}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setQuestionsReload((value) => value + 1);
                setSubmissionsReload((value) => value + 1);
              }}
            >
              إعادة المحاولة
            </Button>
            <Link to={`/courses/${course.id}`} className={buttonClasses({ variant: 'ghost' })}>
              العودة للكورس
            </Link>
          </div>
        </div>
      );
    } else if (pendingSubmission) {
      startArea = (
        <div className="space-y-3 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3.5 py-3">
          <p className="text-sm leading-relaxed text-gold-200">
            لديك محاولة سُلّمت إجاباتها (المحاولة {pendingSubmission.attempt}) ولم يكتمل تصحيحها. اضغط الزر
            لإكمال التصحيح، ولن تحتاج لإعادة الحل.
          </p>
          <Button onClick={() => void handleResumeGrading(pendingSubmission)}>إكمال التصحيح</Button>
        </div>
      );
    } else if (questions.length === 0) {
      startArea = (
        <p className="text-center text-sm text-slate-400">لا توجد أسئلة في هذا العنصر حتى الآن.</p>
      );
    } else {
      startArea = (
        <Button size="lg" fullWidth onClick={() => setStage('taking')}>
          {assessment.kind === 'homework' ? 'ابدأ الواجب' : 'ابدأ الآن'}
        </Button>
      );
    }

    content = (
      <div className="space-y-5">
        <Card className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="gold">{kindLabel}</Badge>
              {isAdmin && <Badge variant="info">معاينة الأدمن</Badge>}
            </div>
            <h1 className="text-2xl font-extrabold leading-snug text-white">{assessment.title}</h1>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-navy-950/60 p-3">
              <dt className="text-slate-500">عدد الأسئلة</dt>
              <dd className="mt-1 font-bold text-white">
                {prereqDiag.locked || access.state !== 'open'
                  ? 'مقفول'
                  : !rulesLoaded || questionsState.loading
                    ? '…'
                    : questionsState.error
                      ? '—'
                      : questions.length}
              </dd>
            </div>
            <div className="rounded-xl bg-navy-950/60 p-3">
              <dt className="text-slate-500">المدة</dt>
              <dd className="mt-1 font-bold text-white">
                {durationMinutes > 0 ? `${durationMinutes} دقيقة` : 'مفتوحة'}
              </dd>
            </div>
            <div className="rounded-xl bg-navy-950/60 p-3">
              <dt className="text-slate-500">المحاولات</dt>
              <dd className="mt-1 font-bold text-white">
                {isAdmin ? 'بدون حد' : `${access.attemptsUsed} من ${MAX_ATTEMPTS}`}
              </dd>
            </div>
          </dl>

          <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
            <li>المحاولة الأولى فقط هي الرسمية، وباقي المحاولات للتدريب.</li>
            {strict && !isAdmin && (
              <li className="text-red-300">
                وضع منع الغش مفعّل: الخروج من الصفحة أو تغيير التبويب يسلّم إجاباتك تلقائيًا.
              </li>
            )}
            {assessment.availableUntil !== null && (
              <li className={access.late && !isAdmin ? 'text-red-300' : undefined}>
                آخر موعد: {formatDateTime(assessment.availableUntil)}. التسليم بعده يخصم{' '}
                {LATE_PENALTY_PERCENT} نقطة مئوية.
              </li>
            )}
          </ul>

          {startArea}
        </Card>

        {previous.length > 0 && !isAdmin && (
          <Card className="space-y-3">
            <h2 className="font-bold text-white">محاولاتك السابقة</h2>
            <ul className="space-y-2 text-sm">
              {previous.map((attempt) => (
                <li
                  key={attempt.attemptNumber}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy-950/60 px-3 py-2"
                >
                  <span className="text-slate-300">
                    المحاولة {attempt.attemptNumber}
                    {attempt.isOfficial && ' (الرسمية)'}
                  </span>
                  <span className="flex items-center gap-2">
                    {attempt.needsReview && <Badge variant="gold">قيد المراجعة</Badge>}
                    <span dir="ltr" className="font-bold text-gold-400">
                      {attempt.effectivePercent}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div data-no-motion="true" className="no-motion mx-auto w-full max-w-3xl space-y-5">
      {stage !== 'taking' && backLink}
      {content}
    </div>
  );
}
