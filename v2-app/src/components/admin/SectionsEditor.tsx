import { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Circle,
  ClipboardList,
  FileText,
  Heading,
  PlayCircle,
  Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Button, Card, Input, Select } from '../ui';
import { cn } from '../ui/cn';
import { KIND_LABELS } from '../../lib/grading';
import { getVideoSource, isSafeHttpUrl } from '../../lib/media';
import { newItem, newSection } from '../../services/courses';
import type { CourseItem, CourseItemType, CourseSection } from '../../services/courses';

interface SectionsEditorProps {
  sections: CourseSection[];
  onChange: (sections: CourseSection[]) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

const TYPE_LABELS: Record<CourseItemType, string> = {
  video: 'فيديو',
  pdf: 'ملف PDF',
  header: 'عنوان فرعي',
  task: 'واجب',
  quiz: 'امتحان',
  other: 'عنصر',
};

const TYPE_ICONS: Record<CourseItemType, LucideIcon> = {
  video: PlayCircle,
  pdf: FileText,
  header: Heading,
  task: ClipboardList,
  quiz: ClipboardList,
  other: Circle,
};

const ADD_TYPE_OPTIONS = [
  { value: 'video', label: 'فيديو' },
  { value: 'pdf', label: 'ملف PDF' },
  { value: 'header', label: 'عنوان فرعي' },
];

type AddableType = 'video' | 'pdf' | 'header';

function isAddableType(value: string): value is AddableType {
  return value === 'video' || value === 'pdf' || value === 'header';
}

const VIDEO_URL_ERROR = 'رابط الفيديو غير مدعوم. استخدم رابط يوتيوب أو فيميو أو ملف فيديو مباشر.';
const PDF_URL_ERROR = 'رابط الملف غير صحيح. يجب أن يبدأ بـ https://';

function getItemError(item: CourseItem): string {
  if (item.archived) return '';
  if (item.type === 'video' || item.type === 'pdf' || item.type === 'header') {
    if (!item.title.trim()) return 'اكتب عنوان العنصر.';
  }
  if (item.type === 'video' && getVideoSource(item.videoUrl).kind === 'unknown') {
    return VIDEO_URL_ERROR;
  }
  if (item.type === 'pdf' && !isSafeHttpUrl(item.pdfUrl)) {
    return PDF_URL_ERROR;
  }
  return '';
}

function hasAnyError(sections: CourseSection[]): boolean {
  return sections.some(
    (section) =>
      !section.archived &&
      (!section.title.trim() || section.items.some((item) => getItemError(item) !== '')),
  );
}

interface AddItemFormProps {
  onAdd: (item: CourseItem) => void;
}

function AddItemForm({ onAdd }: AddItemFormProps) {
  const [type, setType] = useState<AddableType>('video');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!title.trim()) {
      setError('اكتب عنوان العنصر.');
      return;
    }
    if (type === 'video' && getVideoSource(url).kind === 'unknown') {
      setError(VIDEO_URL_ERROR);
      return;
    }
    if (type === 'pdf' && !isSafeHttpUrl(url)) {
      setError(PDF_URL_ERROR);
      return;
    }

    onAdd(newItem(type, title, url));
    setTitle('');
    setUrl('');
    setError('');
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-navy-700 p-3">
      <p className="text-sm font-bold text-slate-300">إضافة عنصر جديد</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label="النوع"
          options={ADD_TYPE_OPTIONS}
          value={type}
          onChange={(event) => {
            if (isAddableType(event.target.value)) setType(event.target.value);
            setError('');
          }}
        />
        <div className="sm:col-span-2">
          <Input
            label="العنوان"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
      </div>
      {type !== 'header' && (
        <Input
          label={type === 'video' ? 'رابط الفيديو' : 'رابط ملف PDF'}
          dir="ltr"
          placeholder="https://"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button size="sm" variant="secondary" onClick={handleAdd}>
        <Plus className="h-4 w-4" />
        إضافة العنصر
      </Button>
    </div>
  );
}

interface ItemEditorProps {
  item: CourseItem;
  onChange: (item: CourseItem) => void;
}

function ItemEditor({ item, onChange }: ItemEditorProps) {
  const Icon = TYPE_ICONS[item.type];
  const typeLabel = item.assessmentKind ? KIND_LABELS[item.assessmentKind] : TYPE_LABELS[item.type];
  const editable = item.type === 'video' || item.type === 'pdf' || item.type === 'header';
  const error = getItemError(item);

  return (
    <li
      className={cn(
        'space-y-3 rounded-xl border border-navy-800 bg-navy-950/40 p-3',
        item.archived && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-gold-400" />
          <Badge variant="neutral">{typeLabel}</Badge>
          {item.archived && <Badge variant="danger">مؤرشف</Badge>}
        </div>
        {editable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({ ...item, archived: !item.archived })}
          >
            {item.archived ? (
              <>
                <ArchiveRestore className="h-4 w-4" />
                استعادة
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                أرشفة
              </>
            )}
          </Button>
        )}
      </div>

      {!editable ? (
        <p className="text-sm text-slate-400">
          {item.title || 'بدون عنوان'} (يُدار من قسم «الامتحانات والتدريبات والواجبات» أسفل الصفحة، ولا يُعدَّل
          من هنا)
        </p>
      ) : (
        !item.archived && (
          <div className="space-y-3">
            <Input
              label="العنوان"
              value={item.title}
              onChange={(event) => onChange({ ...item, title: event.target.value })}
            />
            {item.type === 'video' && (
              <Input
                label="رابط الفيديو"
                dir="ltr"
                value={item.videoUrl}
                onChange={(event) => onChange({ ...item, videoUrl: event.target.value })}
              />
            )}
            {item.type === 'pdf' && (
              <Input
                label="رابط ملف PDF"
                dir="ltr"
                value={item.pdfUrl}
                onChange={(event) => onChange({ ...item, pdfUrl: event.target.value })}
              />
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )
      )}
    </li>
  );
}

export default function SectionsEditor({
  sections,
  onChange,
  onSave,
  saving,
  dirty,
}: SectionsEditorProps) {
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [sectionError, setSectionError] = useState('');

  const updateSection = (sectionId: string, patch: Partial<CourseSection>) => {
    onChange(sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)));
  };

  const updateItem = (sectionId: string, updated: CourseItem) => {
    onChange(
      sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) => (item.id === updated.id ? updated : item)),
            }
          : section,
      ),
    );
  };

  const addItem = (sectionId: string, item: CourseItem) => {
    onChange(
      sections.map((section) =>
        section.id === sectionId ? { ...section, items: [...section.items, item] } : section,
      ),
    );
  };

  const addSection = () => {
    if (!newSectionTitle.trim()) {
      setSectionError('اكتب عنوان القسم.');
      return;
    }
    onChange([...sections, newSection(newSectionTitle)]);
    setNewSectionTitle('');
    setSectionError('');
  };

  const blocked = hasAnyError(sections);

  return (
    <div className="space-y-5">
      {sections.length === 0 && (
        <Card>
          <p className="text-center text-sm text-slate-400">لا توجد أقسام بعد. أضف أول قسم من الأسفل.</p>
        </Card>
      )}

      {sections.map((section) => (
        <Card key={section.id} className={cn('space-y-4', section.archived && 'opacity-60')}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Input
                label="عنوان القسم"
                value={section.title}
                error={!section.archived && !section.title.trim() ? 'اكتب عنوان القسم.' : undefined}
                disabled={section.archived}
                onChange={(event) => updateSection(section.id, { title: event.target.value })}
              />
            </div>
            <Button
              variant="ghost"
              onClick={() => updateSection(section.id, { archived: !section.archived })}
            >
              {section.archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4" />
                  استعادة القسم
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  أرشفة القسم
                </>
              )}
            </Button>
          </div>

          {section.archived ? (
            <p className="text-sm text-slate-400">هذا القسم مؤرشف ولا يظهر للطلاب.</p>
          ) : (
            <>
              {section.items.length > 0 && (
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <ItemEditor
                      key={item.id}
                      item={item}
                      onChange={(updated) => updateItem(section.id, updated)}
                    />
                  ))}
                </ul>
              )}
              <AddItemForm onAdd={(item) => addItem(section.id, item)} />
            </>
          )}
        </Card>
      ))}

      <Card className="space-y-3">
        <p className="font-bold text-white">إضافة قسم جديد</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Input
              label="عنوان القسم"
              value={newSectionTitle}
              error={sectionError || undefined}
              onChange={(event) => {
                setNewSectionTitle(event.target.value);
                setSectionError('');
              }}
            />
          </div>
          <Button variant="secondary" onClick={addSection}>
            <Plus className="h-4 w-4" />
            إضافة القسم
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" loading={saving} disabled={!dirty || blocked} onClick={onSave}>
          حفظ المحتوى
        </Button>
        {blocked && <p className="text-sm text-red-400">أصلح الأخطاء الظاهرة بالأحمر قبل الحفظ.</p>}
        {!blocked && dirty && <p className="text-sm text-gold-300">لديك تغييرات غير محفوظة.</p>}
      </div>
    </div>
  );
}
