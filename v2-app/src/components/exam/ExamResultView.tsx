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
    return { label: 'للمراجعة', variant: 'gold', border: 'border-gold-500/40' };
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
        </div>

        <p className="text-5xl font-extrabold text-gold-400">
          <span dir="ltr">{result.effectivePercent}%</span>
        </p>

        <ProgressBar value={result.effectivePercent} showValue={false} />

        <p className="text-sm text-slate-400">
          الدرجة: <span className="font-bold text-slate-200">{result.earnedPoints}</span> من{' '}
          <span className="font-bold text-slate-200">{result.totalPoints}</span>
        </p>

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
            فيه أسئلة مقالية ستُراجع لاحقًا، ولم تُحسب درجتها بعد في هذه النسبة.
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
                    {detail.pointsEarned} / {detail.totalPoints}
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
                    {detail.needsReview ? 'الإجابة النموذجية: ' : 'الإجابة الصحيحة: '}
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
