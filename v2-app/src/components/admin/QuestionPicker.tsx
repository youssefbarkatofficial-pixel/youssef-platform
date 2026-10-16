import { useEffect, useState } from 'react';
import { Badge, Button, Input, Modal, Select, Spinner } from '../ui';
import { cn } from '../ui/cn';
import { getGradeLabel } from '../../lib/grades';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, cloneDraft } from '../../lib/questionDraft';
import type { QuestionDraft } from '../../lib/questionDraft';
import { listBankQuestions } from '../../services/questionBank';
import type { BankQuestion } from '../../services/questionBank';

interface QuestionPickerProps {
  open: boolean;
  onClose: () => void;
  // تُرجع نسخًا من الأسئلة المحددة (كل نسخة برقم جديد)
  onAdd: (drafts: QuestionDraft[]) => void;
}

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'كل الأنواع' },
  ...QUESTION_TYPES.map((type) => ({ value: type, label: QUESTION_TYPE_LABELS[type] })),
];

export default function QuestionPicker({ open, onClose, onAdd }: QuestionPickerProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (!open || loaded) return;

    let active = true;
    setLoading(true);
    setError(false);

    listBankQuestions()
      .then((list) => {
        if (active) {
          setQuestions(list.filter((question) => !question.archived));
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, loaded, reloadKey]);

  const toggle = (docId: string) => {
    setSelected((previous) =>
      previous.includes(docId) ? previous.filter((item) => item !== docId) : [...previous, docId],
    );
  };

  const handleAdd = () => {
    const chosen = questions.filter((question) => selected.includes(question.docId));
    onAdd(chosen.map(cloneDraft));
    setSelected([]);
    onClose();
  };

  const term = search.trim().toLowerCase();
  const visible = questions.filter((question) => {
    if (typeFilter !== 'all' && question.type !== typeFilter) return false;
    if (term && !`${question.text} ${question.topic}`.toLowerCase().includes(term)) return false;
    return true;
  });

  let list;
  if (loading) {
    list = (
      <div className="flex justify-center py-8 text-gold-400">
        <Spinner />
      </div>
    );
  } else if (error) {
    list = (
      <div className="space-y-3 py-6 text-center">
        <p className="text-sm text-slate-400">تعذر تحميل بنك الأسئلة.</p>
        <Button variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
          إعادة المحاولة
        </Button>
      </div>
    );
  } else if (visible.length === 0) {
    list = (
      <p className="py-6 text-center text-sm text-slate-400">
        {questions.length === 0 ? 'بنك الأسئلة فارغ.' : 'لا توجد أسئلة مطابقة.'}
      </p>
    );
  } else {
    list = (
      <ul className="space-y-2">
        {visible.map((question) => {
          const isSelected = selected.includes(question.docId);
          return (
            <li key={question.docId}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                  isSelected
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-navy-700 bg-navy-950/40 hover:border-navy-500',
                )}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(question.docId)}
                  className="mt-1 h-5 w-5 rounded border-navy-600 bg-navy-900 accent-gold-500"
                />
                <span className="flex-1 space-y-1.5">
                  <span className="flex flex-wrap gap-2">
                    <Badge variant="gold">{QUESTION_TYPE_LABELS[question.type]}</Badge>
                    <Badge variant="neutral">{question.points} درجة</Badge>
                    {question.grade && <Badge variant="info">{getGradeLabel(question.grade)}</Badge>}
                    {question.topic && <Badge variant="neutral">{question.topic}</Badge>}
                  </span>
                  <span className="block whitespace-pre-line text-sm leading-relaxed text-slate-200">
                    {question.text}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="اختيار أسئلة من البنك"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button disabled={selected.length === 0} onClick={handleAdd}>
            إضافة المحدد ({selected.length})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            aria-label="بحث"
            placeholder="ابحث في الأسئلة"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            aria-label="نوع السؤال"
            options={TYPE_FILTER_OPTIONS}
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          />
        </div>
        {list}
      </div>
    </Modal>
  );
}
