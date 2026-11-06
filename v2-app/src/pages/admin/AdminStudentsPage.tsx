import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ArchiveRestore, Copy, Eye, EyeOff, Pencil, Search, ServerCrash } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Input, Select, Table, useToast } from '../../components/ui';
import type { TableColumn } from '../../components/ui';
import { GRADE_OPTIONS, getGradeLabel } from '../../lib/grades';
import { listStudents, setStudentArchived, updateStudentProfile } from '../../services/students';
import type { Student } from '../../services/students';
import { resolveStudentPassword, setStoredAdminPassword } from '../../lib/studentPasswords';
import { isValidEgyptPhone, normalizePhone, phoneToEmail } from '../../lib/phone';
import { cn } from '../../components/ui/cn';

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
  const [parentStatus, setParentStatus] = useState<'all' | 'valid' | 'missing'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [pwdOverrides, setPwdOverrides] = useState<Record<string, string>>({});

  const getEffectivePwd = (student: Student): string | null => {
    if (pwdOverrides[student.id]) return pwdOverrides[student.id];
    if (student.phone && pwdOverrides[student.phone]) return pwdOverrides[student.phone];
    return resolveStudentPassword(student);
  };

  const handleEditPassword = async (student: Student, currentPwd: string) => {
    const promptLabel = student.name ? `تعديل كلمة المرور للطالب (${student.name}):` : 'تعديل كلمة المرور:';
    const newPwd = window.prompt(promptLabel, currentPwd);
    if (newPwd !== null && newPwd.trim().length > 0) {
      const trimmed = newPwd.trim();
      setStoredAdminPassword(student.id, trimmed, student.phone);
      setPwdOverrides((prev) => ({
        ...prev,
        [student.id]: trimmed,
        ...(student.phone ? { [student.phone]: trimmed } : {}),
      }));

      const studentEmail = student.phone ? phoneToEmail(student.phone) : (student.email || '');
      const candidateOldPwds = Array.from(
        new Set([student.plainPassword, currentPwd, '12345678', '123456', student.phone, student.parentPhone].filter(Boolean))
      ) as string[];

      let updatedInFirebase = false;
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

      if (apiKey && trimmed && studentEmail) {
        for (const testOld of candidateOldPwds) {
          try {
            const loginRes = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: studentEmail, password: testOld, returnSecureToken: true }),
              }
            );
            const loginData = await loginRes.json();
            if (loginData.idToken) {
              const updateRes = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken: loginData.idToken, password: trimmed, returnSecureToken: true }),
                }
              );
              const updateData = await updateRes.json();
              if (updateData.idToken || updateRes.ok) {
                updatedInFirebase = true;
                break;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      if (updatedInFirebase) {
        showToast('تم تحديث كلمة المرور في فايربيز وسجلات المنصة بنجاح!', 'success');
      } else {
        showToast('تم حفظ كلمة المرور في سجلات المنصة بنجاح', 'success');
      }
    }
  };

    const handleEditParentPhone = async (student: Student) => {
    const promptLabel = student.name ? `تعديل رقم ولي الأمر للطالب (${student.name}):` : 'تعديل رقم ولي الأمر:';
    const newPhone = window.prompt(promptLabel, student.parentPhone || '');
    if (newPhone !== null) {
      const clean = normalizePhone(newPhone);
      if (clean && !isValidEgyptPhone(clean)) {
        showToast('يجب كتابة رقم هاتف مصري صحيح (11 رقماً يبدأ بـ 01)', 'error');
        return;
      }
      try {
        await updateStudentProfile(student.id, { parentPhone: clean });
        setStudents((prev) =>
          prev.map((s) => (s.id === student.id ? { ...s, parentPhone: clean } : s)),
        );
        showToast('تم تحديث رقم ولي الأمر بنجاح', 'success');
      } catch {
        showToast('تعذر تحديث رقم ولي الأمر', 'error');
      }
    }
  };

  const handleEditStudentName = async (student: Student) => {
    const promptLabel = student.studentCode ? `تعديل اسم الطالب (${student.studentCode}):` : 'تعديل اسم الطالب:';
    const newName = window.prompt(promptLabel, student.name || '');
    if (newName !== null && newName.trim().length > 0) {
      const clean = newName.trim().replace(/\s+/g, ' ');
      if (clean.length < 3 || clean.length > 80) {
        showToast('يجب أن يتراوح الاسم بين 3 و80 حرفاً', 'error');
        return;
      }
      try {
        await updateStudentProfile(student.id, { name: clean });
        setStudents((prev) =>
          prev.map((s) => (s.id === student.id ? { ...s, name: clean } : s)),
        );
        showToast('تم تحديث اسم الطالب بنجاح', 'success');
      } catch {
        showToast('تعذر تحديث اسم الطالب', 'error');
      }
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

    const parentStats = useMemo(() => {
    let validCount = 0;
    for (const s of students) {
      const normP = normalizePhone(s.parentPhone || '');
      const normS = normalizePhone(s.phone || '');
      if (
        s.parentPhone &&
        s.parentPhone !== 'غير مسجل' &&
        s.parentPhone !== '-' &&
        isValidEgyptPhone(normP) &&
        normP !== normS
      ) {
        validCount++;
      }
    }
    return {
      valid: validCount,
      missing: students.length - validCount,
      total: students.length,
    };
  }, [students]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students
      .filter((student) => (grade === '' ? true : student.grade === grade))
      .filter((student) => {
        if (parentStatus === 'all') return true;
        const normP = normalizePhone(student.parentPhone || '');
        const normS = normalizePhone(student.phone || '');
        const hasValid = Boolean(
          student.parentPhone &&
          student.parentPhone !== 'غير مسجل' &&
          student.parentPhone !== '-' &&
          isValidEgyptPhone(normP) &&
          normP !== normS
        );
        return parentStatus === 'valid' ? hasValid : !hasValid;
      })
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
  }, [students, search, grade, parentStatus]);

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
        <div className="min-w-[10rem] flex items-center justify-between gap-2">
          <div>
            <Link to={`/admin/students/${student.id}`} className="font-bold text-white hover:text-gold-400">
              {student.name || 'بدون اسم'}
            </Link>
            <p className="text-xs text-slate-500">{student.studentCode}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleEditStudentName(student)}
            className="p-1 text-slate-400 hover:text-gold-400 rounded hover:bg-slate-800 transition-colors"
            title="تعديل اسم الطالب"
            aria-label="تعديل اسم الطالب"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
    { key: 'phone', header: 'الموبايل', render: (student) => <span dir="ltr">{student.phone || '-'}</span> },
    {
      key: 'password',
      header: 'كلمة المرور',
      render: (student) => {
        const pwd = getEffectivePwd(student);
        const isRevealed = revealedIds.has(student.id);

        if (!pwd) {
          return (
            <div className="flex items-center gap-1.5" dir="ltr">
              <span
                className="text-[11px] text-amber-400/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium"
                title="الحساب بانتظار التجديد الإجباري من الطالب، أو يمكنك تحديد كلمة مرور له يدويًا"
              >
                بانتظار التجديد
              </span>
              <button
                type="button"
                onClick={() => handleEditPassword(student, '')}
                className="p-1 text-sky-400 hover:text-sky-300 rounded hover:bg-sky-500/10 transition-colors"
                title="تحديد كلمة المرور يدويًا"
                aria-label="تحديد كلمة المرور يدويًا"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-1.5" dir="ltr">
            <span className="font-mono text-xs text-gold-400 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700 font-bold select-all min-w-[5.5rem] text-center">
              {isRevealed ? pwd : '••••••••'}
            </span>
            <button
              type="button"
              onClick={() => toggleReveal(student.id)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title={isRevealed ? 'إخفاء' : 'إظهار'}
              aria-label={isRevealed ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(pwd);
                showToast('تم نسخ كلمة المرور', 'success');
              }}
              className="p-1 text-gold-400 hover:text-gold-300 rounded hover:bg-gold-500/10 transition-colors"
              title="نسخ كلمة المرور"
              aria-label="نسخ كلمة المرور"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleEditPassword(student, pwd)}
              className="p-1 text-sky-400 hover:text-sky-300 rounded hover:bg-sky-500/10 transition-colors"
              title="تعديل كلمة المرور"
              aria-label="تعديل كلمة المرور"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      },
    },
    {
      key: 'parentPhone',
      header: 'ولي الأمر',
      render: (student) => {
        const normP = normalizePhone(student.parentPhone || '');
        const normS = normalizePhone(student.phone || '');
        const isValid =
          Boolean(student.parentPhone) &&
          student.parentPhone !== 'غير مسجل' &&
          student.parentPhone !== '-' &&
          isValidEgyptPhone(normP) &&
          normP !== normS;

        return (
          <div className="flex items-center gap-1.5 min-w-[8.5rem]">
            {isValid ? (
              <span dir="ltr" className="font-mono text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {normP}
              </span>
            ) : (
              <Badge variant="danger">غير مسجل</Badge>
            )}
            <button
              type="button"
              onClick={() => void handleEditParentPhone(student)}
              className="p-1 text-slate-400 hover:text-gold-400 rounded hover:bg-slate-800 transition-colors"
              title="تعديل رقم ولي الأمر"
              aria-label="تعديل رقم ولي الأمر"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      },
    },
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
