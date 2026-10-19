import { AlertTriangle, Clock } from 'lucide-react';
import { Badge, Card, ProgressBar } from '../ui';
import { cn } from '../ui/cn';
import { LATE_PENALTY_PERCENT } from '../../lib/grading';
import type { AnswerDetail, AttemptResult } from '../../lib/grading';

interface ExamResultViewProps {
  result: AttemptResult;
  preview?: boolean;
}

const OPTION_LABELS: Record<string, string> = { a: 'أ', b: 'ب', c: 'ج', d: 'د' };

// لو الإجابة مفتاح خيار (a-d) نعرض نص الخيار، وإلا نعرض الإجابة كما هي.
function describeAnswer(value: string, options: Record<string, string> | null): string {
  const key = value.trim().toLowerCase();
  if (options && options[key] !== undefined) {
    return `${OPTION_LABELS[key] ?? key}) ${options[key]}`;
  }
  return value;
}

function getDetailState(detail: AnswerDetail): {
  label: string;
  variant: 'success' | 'danger' | 'gold' | 'neutral';
  border: string;
} {
  if (detail.needsReview) {
    return { label: 'قيد المراجعة', variant: 'gold', border: 'border-gold-500/40' };
  }
  if (detail.method === 'unanswered') {
    return { label: 'بدون إجابة', variant: 'neutral', border: 'border-navy-700' };
  }
  if (detail.score >= 1) {
    return { label: 'صحيحة', variant: 'success', border: 'border-emerald-500/40' };
  }
  return { label: 'خاطئة', variant: 'danger', border: 'border-red-500/40' };
}

export default function ExamResultView({ result, preview = false }: ExamResultViewProps) {
  const pendingDetails = result.details.filter((d) => d.needsReview);
  const pendingCount = pendingDetails.length;
  const objectiveDetails = result.details.filter((d) => !d.needsReview);
  const objectiveTotal = objectiveDetails.reduce((sum, d) => sum + d.totalPoints, 0);
  const objectiveEarned = objectiveDetails.reduce((sum, d) => sum + d.pointsEarned, 0);
  const objectivePercent =
    objectiveTotal > 0 ? Math.round((objectiveEarned / objectiveTotal) * 100) : 0;
  const pendingPoints = pendingDetails.reduce((sum, d) => sum + d.totalPoints, 0);

  return (
    <div className="space-y-5">
      <Card className="space-y-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge variant={result.isOfficial ? 'gold' : 'neutral'}>
            {preview
              ? 'معاينة الأدمن'
              : result.isOfficial
                ? 'المحاولة الرسمية'
                : `المحاولة رقم ${result.attemptNumber} (تدريبية)`}
          </Badge>
          {result.autoSubmit && <Badge variant="danger">سُلِّم تلقائيًا</Badge>}
          {result.needsReview && <Badge variant="gold">قيد المراجعة</Badge>}
        </div>

        {result.needsReview && objectiveTotal === 0 ? (
          <div className="py-2">
            <p className="text-3xl font-extrabold text-gold-400">قيد المراجعة</p>
            <p className="mt-1 text-sm text-slate-400">
              جميع أسئلة هذا الاختبار مقالية وسيتم تقييمها يدويًا من معلم المادة
            </p>
          </div>
        ) : (
          <>
            <p className="text-5xl font-extrabold text-gold-400">
              <span dir="ltr">
                {result.needsReview ? `${objectivePercent}%` : `${result.effectivePercent}%`}
              </span>
            </p>

            <ProgressBar
              value={result.needsReview ? objectivePercent : result.effectivePercent}
              showValue={false}
            />

            <p className="text-sm text-slate-400">
              {result.needsReview ? (
                <>
                  درجة الأسئلة الموضوعية المصححة:{' '}
                  <span className="font-bold text-slate-200">{objectiveEarned}</span> من{' '}
                  <span className="font-bold text-slate-200">{objectiveTotal}</span>
                  {pendingPoints > 0 && (
                    <span className="block mt-1 text-xs text-gold-300/90">
                      (+ {pendingPoints} درجات لأسئلة مقالية قيد مراجعة المعلم)
                    </span>
                  )}
                </>
              ) : (
                <>
                  الدرجة:{' '}
                  <span className="font-bold text-slate-200">{result.earnedPoints}</span> من{' '}
                  <span className="font-bold text-slate-200">{result.totalPoints}</span>
                </>
              )}
            </p>
          </>
        )}

        {result.penalized && (
          <div className="flex items-start justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-3 text-start text-sm text-red-300">
            <Clock className="mt-0.5 h-5 w-5 shrink-0" />
            سُلِّم بعد الموعد المحدد، فتم خصم {LATE_PENALTY_PERCENT} نقطة مئوية. النسبة قبل الخصم:{' '}
            <span dir="ltr">{result.percent}%</span>
          </div>
        )}

        {result.needsReview && (
          <div className="flex items-start justify-center gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 px-3.5 py-3 text-start text-sm text-gold-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            يوجد {pendingCount} سؤال مقالي قيد مراجعة المعلم، ولن تُحتسب نتيجتها كصفر، وستُضاف درجاتها فور اعتماد التصحيح.
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-white">تفاصيل الإجابات</h2>

        {result.details.map((detail, index) => {
          const state = getDetailState(detail);
          const given = detail.rawAnswer ? describeAnswer(detail.rawAnswer, detail.options) : '';
          const correct =
            detail.correctAnswer !== null && detail.correctAnswer !== ''
              ? describeAnswer(detail.correctAnswer, detail.options)
              : '';

          return (
            <Card key={index} className={cn('space-y-3 border', state.border)}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="whitespace-pre-line font-bold leading-relaxed text-white">
                  {index + 1}. {detail.question || 'سؤال بدون نص'}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant={state.variant}>{state.label}</Badge>
                  <Badge variant="neutral">
                    {detail.needsReview
                      ? `قيد التقييم (من ${detail.totalPoints})`
                      : `${detail.pointsEarned} / ${detail.totalPoints}`}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <p className="text-slate-400">
                  إجابتك:{' '}
                  <span className="whitespace-pre-line font-bold text-slate-200">
                    {given || 'لم تجب'}
                  </span>
                </p>
                {correct && (
                  <p className="text-slate-400">
                    {detail.needsReview ? 'الإجابة النموذجية الاسترشادية: ' : 'الإجابة الصحيحة: '}
                    <span className="whitespace-pre-line font-bold text-emerald-300">{correct}</span>
                  </p>
                )}
                {detail.feedback && <p className="text-slate-500">{detail.feedback}</p>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
