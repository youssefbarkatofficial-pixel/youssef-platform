import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Search, ServerCrash } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Select, Table, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { GRADE_OPTIONS, getGradeLabel } from '../../lib/grades';
import { listStudents, setStudentArchived } from '../../services/students';
import type { Student } from '../../services/students';

function formatDate(ms: number | null): string {
  if (ms === null) return '-';
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function AdminStudentsPage() {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await listStudents();
      setStudents(result.students);
      setTruncated(result.truncated);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students
      .filter((student) => (grade === '' ? true : student.grade === grade))
      .filter((student) => {
        if (term === '') return true;
        return (
          student.name.toLowerCase().includes(term) ||
          student.phone.includes(term) ||
          student.studentCode.toLowerCase().includes(term) ||
          student.email.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  }, [students, search, grade]);

  const toggleArchive = async (student: Student) => {
    const next = !student.archived;
    const message = next
      ? `سيتم تجميد حساب ${student.name} (لا يستطيع الكتابة أو الشراء). البيانات لا تُحذف. متابعة؟`
      : `سيتم إعادة تفعيل حساب ${student.name}. متابعة؟`;
    if (!window.confirm(message)) return;

    setBusyId(student.id);
    try {
      await setStudentArchived(student.id, next);
      setStudents((previous) =>
        previous.map((item) => (item.id === student.id ? { ...item, archived: next } : item)),
      );
      showToast(next ? 'تم تجميد الحساب.' : 'تمت إعادة تفعيل الحساب.', 'success');
    } catch {
      showToast('تعذر تنفيذ العملية.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const columns: TableColumn<Student>[] = [
    {
      key: 'name',
      header: 'الطالب',
      render: (student) => (
        <div className="min-w-[10rem]">
          <Link to={`/admin/students/${student.id}`} className="font-bold text-white hover:text-gold-400">
            {student.name || 'بدون اسم'}
          </Link>
          <p className="text-xs text-slate-500">{student.studentCode}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'الموبايل', render: (student) => <span dir="ltr">{student.phone || '-'}</span> },
    { key: 'grade', header: 'الصف', render: (student) => getGradeLabel(student.grade, student.track) },
    { key: 'courses', header: 'الكورسات', render: (student) => student.courses.length },
    { key: 'createdAt', header: 'التسجيل', render: (student) => formatDate(student.createdAtMs) },
    { key: 'lastActive', header: 'آخر ظهور', render: (student) => formatDate(student.lastActiveMs) },
    {
      key: 'actions',
      header: '',
      render: (student) => (
        <div className="flex items-center gap-2">
          {student.archived && <Badge variant="danger">مجمّد</Badge>}
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === student.id}
            onClick={() => void toggleArchive(student)}
            aria-label={student.archived ? 'إعادة التفعيل' : 'تجميد الحساب'}
          >
            {student.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
        </div>
      ),
    },
  ];

  if (failed) {
    return (
      <Card className="mx-auto max-w-2xl">
        <EmptyState
          icon={ServerCrash}
          title="تعذر تحميل الطلاب"
          action={<Button onClick={() => void load()}>إعادة المحاولة</Button>}
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white md:text-3xl">الطلاب</h1>
          <p className="mt-1 text-sm text-slate-400">
            {students.length} طالب
            {truncated && ' (أول 1500 فقط، استخدم البحث أو الصف)'}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-[2.35rem] h-4 w-4 text-slate-500" />
          <Input
            label="بحث"
            value={search}
            placeholder="الاسم أو الموبايل أو كود الطالب"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          label="الصف"
          value={grade}
          options={GRADE_OPTIONS}
          placeholder="كل الصفوف"
          onChange={(event) => setGrade(event.target.value)}
        />
      </div>

      <Table
        columns={columns}
        rows={visible}
        rowKey={(student) => student.id}
        loading={loading}
        emptyMessage="لا يوجد طلاب مطابقون"
      />
    </div>
  );
}
