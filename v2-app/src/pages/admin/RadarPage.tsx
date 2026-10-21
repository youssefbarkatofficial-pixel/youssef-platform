import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Flame,
  MessageCircle,
  Play,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sliders,
  UserCheck,
  X,
} from 'lucide-react';
import { Badge, Card, EmptyState, Spinner, StatCard, Button } from '../../components/ui';
import { useCourses } from '../../hooks/useCourses';
import { calcWatchPercent, getOfficialScores, videoIdsForStudent } from '../../lib/stats';
import {
  commitmentLevel,
  dailyAtRiskSummary,
  dueFollowUps,
  canMessageThisWeek,
  encouragementFor,
  stuckLessons,
} from '../../lib/radarExtras';
import {
  SEGMENT_LABELS,
  buildRadar,
  messageFor,
  weakAssessments,
  whatsappLink,
  applyBaseline,
  revertBaseline,
  generateWhatsAppTemplate,
  DEFAULT_WHATSAPP_TEMPLATES,
} from '../../lib/radar';
import type {
  LessonScoreInput,
  RadarRow,
  RadarSegment,
  RadarStudentInput,
  SortOption,
} from '../../lib/radar';
import { parseExamResults } from '../../services/assessments';
import { listStudents } from '../../services/students';
import type { Student } from '../../services/students';
import {
  getNotificationSwitches,
  updateNotificationSwitches,
  sendBroadcastNotification,
} from '../../services/notifications';
import type { NotificationSwitches } from '../../services/notifications';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';

const ALL_SEGMENTS: RadarSegment[] = [
  'stopped',
  'at_risk',
  'missed_full_week',
  'weak',
  'lagging',
  'unwatched_video',
  'incomplete_video',
  'fast_or_skipped',
  'training_done_hw_pending',
  'hw_done_exam_pending',
  'exam_completed',
  'file_downloaded',
  'notified',
  'recovered',
  'star',
  'ok',
];

const SEGMENT_BADGE: Record<RadarSegment, 'danger' | 'gold' | 'info' | 'success' | 'neutral'> = {
  stopped: 'danger',
  at_risk: 'danger',
  missed_full_week: 'danger',
  weak: 'gold',
  lagging: 'info',
  unwatched_video: 'info',
  incomplete_video: 'info',
  fast_or_skipped: 'gold',
  training_done_hw_pending: 'gold',
  hw_done_exam_pending: 'info',
  exam_completed: 'success',
  file_downloaded: 'info',
  notified: 'neutral',
  recovered: 'success',
  star: 'success',
  ok: 'neutral',
};

export default function RadarPage() {
  const { firebaseUser } = useAuth();
  const { courses, loading: loadingCourses } = useCourses();
  const [students, setStudents] = useState<Student[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Search & Filter & Sort state
  const [filter, setFilter] = useState<RadarSegment | 'all'>('stopped');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('risk');

  // Master switches
  const [switches, setSwitches] = useState<NotificationSwitches>({
    platformUpdates: true,
    curriculumUpdates: true,
    laggingWarnings: true,
  });
  const [savingSwitches, setSavingSwitches] = useState(false);

  // Action Queue Modal ("افعل")
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionTab, setActionTab] = useState<'whatsapp' | 'inapp'>('whatsapp');
  const [queueIndex, setQueueIndex] = useState(0);
  const [useParentPhone, setUseParentPhone] = useState(false);
  const [customTemplate, setCustomTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATES.studentWarning);
  const [inAppTitle, setInAppTitle] = useState('');
  const [inAppMessage, setInAppMessage] = useState('');
  const [inAppSending, setInAppSending] = useState(false);
  const [inAppSuccess, setInAppSuccess] = useState(false);

  // Baseline Modal state
  const [baselineModalStudent, setBaselineModalStudent] = useState<RadarRow | null>(null);
  const [baselineNote, setBaselineNote] = useState('');
  const [followUpDays, setFollowUpDays] = useState(7);
  const [savingBaseline, setSavingBaseline] = useState(false);

  // Load switches
  useEffect(() => {
    void getNotificationSwitches().then(setSwitches);
  }, []);

  const handleToggleSwitch = async (key: keyof NotificationSwitches) => {
    const updated = { ...switches, [key]: !switches[key] };
    setSwitches(updated);
    setSavingSwitches(true);
    try {
      await updateNotificationSwitches(updated);
    } finally {
      setSavingSwitches(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    listStudents({ forceRefresh: reloadKey > 0 })
      .then((result) => {
        if (!active) return;
        setStudents(result.students);
        setTruncated(result.truncated);
      })
      .catch(() => {
        if (!active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const { rows, lessons } = useMemo(() => {
    const inputs: RadarStudentInput[] = [];
    const scoreInputs: LessonScoreInput[] = [];

    students.forEach((student) => {
      const official = getOfficialScores(parseExamResults(student.examResults));
      official.forEach((item) =>
        scoreInputs.push({ key: item.key, title: item.title, courseId: item.courseId, score: item.score })
      );
      const avg = official.length > 0 ? official.reduce((sum, item) => sum + item.score, 0) / official.length : null;

      // Extract raw baseline and progress fields
      const raw = student as unknown as Record<string, unknown>;
      const baselineAt = typeof raw.baselineAt === 'number' ? raw.baselineAt : null;
      const baselineNote = typeof raw.baselineNote === 'string' ? raw.baselineNote : '';
      const followUpDate = typeof raw.followUpDate === 'number' ? raw.followUpDate : null;
      const downloadedFilesCount = typeof raw.downloadedFilesCount === 'number' ? raw.downloadedFilesCount : 0;
      const lastNotifiedMs = typeof raw.lastNotifiedMs === 'number' ? raw.lastNotifiedMs : null;

      inputs.push({
        id: student.id,
        name: student.name,
        phone: student.phone,
        parentPhone: student.parentPhone,
        courseCount: student.courses.length,
        lastActiveMs: student.lastActiveMs,
        createdAtMs: student.createdAtMs,
        watchPercent: calcWatchPercent(student.watchProgress, videoIdsForStudent(courses, student.courses)),
        avgScore: avg,
        examCount: official.length,
        archived: student.archived,
        baselineAt,
        baselineNote,
        followUpDate,
        downloadedFilesCount,
        lastNotifiedMs,
      });
    });

    return {
      rows: buildRadar(inputs, Date.now(), sort, filter, search),
      lessons: weakAssessments(scoreInputs),
    };
  }, [students, courses, sort, filter, search]);

  const atRiskSummary = useMemo(() => dailyAtRiskSummary(rows), [rows]);
  const dueFollowUpIds = useMemo(() => dueFollowUps(rows, Date.now()), [rows]);
  const topStuckLessons = useMemo(() => stuckLessons(rows, 3), [rows]);

  // Compute segment counts across all students
  const counts = useMemo(() => {
    const rawAll = students.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      parentPhone: s.parentPhone,
      courseCount: s.courses.length,
      lastActiveMs: s.lastActiveMs,
      createdAtMs: s.createdAtMs,
      watchPercent: null,
      avgScore: null,
      examCount: 0,
      archived: s.archived,
    }));
    const scored = buildRadar(rawAll, Date.now());
    const res: Record<RadarSegment, number> = {} as any;
    ALL_SEGMENTS.forEach((seg) => {
      res[seg] = 0;
    });
    scored.forEach((r) => {
      res[r.segment] = (res[r.segment] || 0) + 1;
      r.smartSegments.forEach((sm) => {
        if (sm !== r.segment) {
          res[sm] = (res[sm] || 0) + 1;
        }
      });
    });
    return res;
  }, [students]);

  const courseTitle = (id: string) => courses.find((course) => course.id === id)?.title ?? '';

  // WhatsApp Queue State
  const queueStudents = rows;
  const currentQueueStudent = queueStudents[queueIndex] || null;

  const currentVars: Record<string, string> = useMemo(() => {
    if (!currentQueueStudent) return {} as Record<string, string>;
    return {
      studentName: currentQueueStudent.name || 'يا بطل',
      courseName: 'الجغرافيا للثانوية العامة',
      lectureTitle: 'الدرس الحالي',
      openTime: 'الخميس 9:00 م',
      lateDays: String(currentQueueStudent.daysInactive || 1),
    };
  }, [currentQueueStudent]);

  const liveWhatsAppMsg = useMemo(() => {
    return generateWhatsAppTemplate(customTemplate, currentVars);
  }, [customTemplate, currentVars]);

  const handleSendInApp = async () => {
    if (!inAppTitle.trim() || !inAppMessage.trim()) return;
    setInAppSending(true);
    try {
      await sendBroadcastNotification({
        title: inAppTitle.trim(),
        message: inAppMessage.trim(),
        category: filter === 'at_risk' || filter === 'stopped' ? 'laggingWarnings' : 'curriculumUpdates',
        targetType: 'all',
        sentBy: firebaseUser?.email || 'youssef',
      });
      setInAppSuccess(true);
      setTimeout(() => {
        setInAppSuccess(false);
        setActionModalOpen(false);
      }, 1500);
    } finally {
      setInAppSending(false);
    }
  };

  // Baseline save
  const handleSaveBaseline = async () => {
    if (!baselineModalStudent) return;
    setSavingBaseline(true);
    try {
      const now = Date.now();
      const followUpMs = followUpDays > 0 ? now + followUpDays * 86_400_000 : null;
      const ref = doc(db, 'students', baselineModalStudent.id);
      await updateDoc(ref, {
        baselineAt: now,
        baselineNote: baselineNote.trim(),
        followUpDate: followUpMs,
        updatedAt: now,
      });
      setReloadKey((k) => k + 1);
      setBaselineModalStudent(null);
    } catch (err) {
      console.error('Failed to set baseline:', err);
    } finally {
      setSavingBaseline(false);
    }
  };

  // Batch Export Backup before global reset
  const handleExportBackup = () => {
    const dataStr = JSON.stringify({ exportedAt: new Date().toISOString(), students }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_students_radar_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  if (loading || loadingCourses) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (failed) {
    return <EmptyState title="تعذر تحميل الطلاب" description="جرّب تاني بعد شوية." />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white md:text-3xl">
            <Radar className="h-7 w-7 text-gold-400" /> رادار الطلاب v2
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            تتبّع التسرّب والمشاهدة الحقيقية، الأقسام الذكية، جدول الأسبوع، والتصفير، وطابور واتساب نصف يدوي بضغطة واحدة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportBackup}
            className="flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> نسخة احتياطية
          </Button>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="flex items-center gap-1.5 rounded-xl bg-navy-900 border border-navy-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-navy-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </button>
        </div>
      </div>

      {/* Daily Risk & Follow-up Summary Banner (radarExtras) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-300">طلاب في خطر:</span>
          </div>
          <span className="text-sm font-extrabold text-red-400">{atRiskSummary.count} <span className="text-xs text-slate-500 font-normal">/ {atRiskSummary.total}</span></span>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-300">متابعات مستحقة اليوم:</span>
          </div>
          <span className="text-sm font-extrabold text-amber-400">{dueFollowUpIds.length}</span>
        </div>

        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-bold text-slate-300">أكثر المحاضرات توقفًا:</span>
          </div>
          <span className="text-xs font-bold text-blue-300 truncate max-w-[120px]">
            {topStuckLessons.length > 0 ? topStuckLessons.map(l => l.lectureId).join(', ') : 'لا يوجد'}
          </span>
        </div>
      </div>

      {/* Master Switches Panel */}
      <Card className="p-4 border-navy-700 bg-navy-900/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-gold-400" />
            <span className="text-xs font-bold text-white">مفاتيح التحكم في إشعارات التطبيق (Spark):</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={switches.curriculumUpdates}
                onChange={() => handleToggleSwitch('curriculumUpdates')}
                disabled={savingSwitches}
                className="rounded border-navy-600 bg-navy-800 text-gold-500 focus:ring-0"
              />
              <span className="text-slate-200">تحديثات المناهج والمواعيد</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={switches.laggingWarnings}
                onChange={() => handleToggleSwitch('laggingWarnings')}
                disabled={savingSwitches}
                className="rounded border-navy-600 bg-navy-800 text-gold-500 focus:ring-0"
              />
              <span className="text-slate-200">تحذيرات المتأخرين</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={switches.platformUpdates}
                onChange={() => handleToggleSwitch('platformUpdates')}
                disabled={savingSwitches}
                className="rounded border-navy-600 bg-navy-800 text-gold-500 focus:ring-0"
              />
              <span className="text-slate-200">تحديثات المنصة العامة</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Smart Segment Selector Pills */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-400">الأقسام الذكية ورادار التسرّب:</p>
          {filter !== 'all' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setQueueIndex(0);
                setActionModalOpen(true);
              }}
              className="flex items-center gap-1.5 shadow-md shadow-gold-500/20"
            >
              <Play className="h-3.5 w-3.5" />
              <span>افعل ({rows.length} طالب)</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-xl border p-2.5 text-start transition-all ${
              filter === 'all'
                ? 'border-gold-500 bg-gold-500/15 text-white'
                : 'border-navy-800 bg-navy-900/60 text-slate-300 hover:border-navy-700'
            }`}
          >
            <div className="text-[11px] text-slate-400 font-medium">كل المشتركين</div>
            <div className="text-lg font-black text-white">{students.length}</div>
          </button>

          {ALL_SEGMENTS.map((seg) => {
            const count = counts[seg] || 0;
            const isSelected = filter === seg;
            return (
              <button
                key={seg}
                type="button"
                onClick={() => setFilter(seg)}
                className={`rounded-xl border p-2.5 text-start transition-all ${
                  isSelected
                    ? 'border-gold-500 bg-gold-500/15 text-white shadow-md'
                    : 'border-navy-800 bg-navy-900/60 text-slate-300 hover:border-navy-700'
                }`}
              >
                <div className="text-[11px] text-slate-400 font-medium truncate">
                  {SEGMENT_LABELS[seg]}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-lg font-black text-white">{count}</span>
                  <Badge variant={SEGMENT_BADGE[seg]} className="text-[10px]">
                    {count > 0 ? 'نشط' : '0'}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Sort Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute end-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف أو رقم ولي الأمر..."
              className="w-full rounded-xl border border-navy-700 bg-navy-900 pe-9 ps-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">الترتيب:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-xl border border-navy-700 bg-navy-900 px-3 py-2 text-xs font-bold text-white focus:border-gold-500 focus:outline-none"
            >
              <option value="risk">الأكثر خطورة (تنازلي)</option>
              <option value="lastActive">آخر نشاط</option>
              <option value="alphabetical">أبجديًا (أ - ي)</option>
              <option value="newest">الأحدث تسجيلًا</option>
              <option value="oldest">الأقدم تسجيلًا</option>
            </select>
          </div>
        </div>

        {/* Student Table */}
        {rows.length === 0 ? (
          <div className="py-12">
            <EmptyState title="لا يوجد طلاب في هذا القسم" description="جرّب اختيار قسم آخر أو تغيير معايير البحث." />
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full min-w-[720px] text-xs text-slate-200">
              <thead>
                <tr className="border-b border-navy-800 text-slate-400 text-[11px]">
                  <th className="p-2.5 text-start">الطالب</th>
                  <th className="p-2.5 text-start">الحالة والأسبوع</th>
                  <th className="p-2.5 text-start">آخر نشاط</th>
                  <th className="p-2.5 text-start">المشاهدة</th>
                  <th className="p-2.5 text-start">الدرجات</th>
                  <th className="p-2.5 text-start">الخطر</th>
                  <th className="p-2.5 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 150).map((row) => (
                  <tr key={row.id} className="border-b border-navy-800/60 hover:bg-navy-900/40">
                    <td className="p-2.5">
                      <div className="font-bold text-white hover:text-gold-400">
                        <Link to={`/admin/students/${encodeURIComponent(row.id)}`}>
                          {row.name || 'طالب بدون اسم'}
                        </Link>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant={SEGMENT_BADGE[row.segment]}>
                          {SEGMENT_LABELS[row.segment]}
                        </Badge>
                        {row.baselineAt && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300 font-bold border border-emerald-500/30">
                            بداية جديدة
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-2.5">
                      {row.weeklyStatus.isMissedFullWeek ? (
                        <span className="text-red-400 font-bold">ضيّع الأسبوع كله</span>
                      ) : row.weeklyStatus.isHwDueWarning ? (
                        <span className="text-amber-300 font-bold">ميعاد الواجب جه!</span>
                      ) : (
                        <span className="text-slate-400">{row.weeklyStatus.nextMilestone}</span>
                      )}
                    </td>

                    <td className="p-2.5">
                      {row.daysInactive === null ? '—' : `من ${row.daysInactive} يوم`}
                    </td>

                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-navy-800">
                          <div
                            className="h-full bg-gold-500"
                            style={{ width: `${Math.min(100, row.watchPercent || 0)}%` }}
                          />
                        </div>
                        <span>{row.watchPercent === null ? '—' : `${Math.round(row.watchPercent)}%`}</span>
                      </div>
                    </td>

                    <td className="p-2.5">
                      {row.avgScore === null ? '—' : `${Math.round(row.avgScore)}%`}
                    </td>

                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-black ${
                            row.risk >= 70 ? 'text-red-400' : row.risk >= 40 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {row.risk}
                        </span>
                        {(() => {
                          const color = commitmentLevel(row);
                          const bg =
                            color === 'green'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : color === 'amber'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30';
                          const label =
                            color === 'green'
                              ? 'ملتزم'
                              : color === 'amber'
                              ? 'متوسط'
                              : 'منخفض';
                          return (
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${bg}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        {row.phone && (
                          <a
                            href={whatsappLink(row.phone, encouragementFor(row) || messageFor(row.segment, row.name, false))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30"
                            title="إرسال واتساب للطالب"
                          >
                            <MessageCircle className="h-3 w-3" />
                            <span>واتساب</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setBaselineModalStudent(row);
                            setBaselineNote(row.baselineNote || '');
                          }}
                          className="rounded-lg border border-navy-700 bg-navy-800 px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-navy-700"
                          title="تصفير ومتابعة"
                        >
                          تصفير
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Weak Assessments / Lessons Map */}
      <Card className="space-y-3 p-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Flame className="h-5 w-5 text-gold-400" />
          <span>خريطة الدروس والامتحانات الأضعف (أعد شرحها):</span>
        </h2>
        {lessons.length === 0 ? (
          <p className="text-xs text-slate-400">
            لا توجد بيانات كافية حالياً (يتطلب 3 تسليمات على الأقل لعرض المتوسطات).
          </p>
        ) : (
          <div className="space-y-2">
            {lessons.map((lesson) => (
              <div
                key={lesson.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy-950/60 p-3 text-xs border border-navy-800"
              >
                <div>
                  <div className="font-bold text-slate-100">{lesson.title}</div>
                  <div className="text-slate-500 text-[11px]">
                    {courseTitle(lesson.courseId)} • {lesson.count} طالب شارك
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="gold">متوسط {lesson.avg}%</Badge>
                  <Badge variant="danger">رسوب {lesson.failRate}%</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Action Modal ("افعل" - طابور واتساب نصف يدوي + إشعار داخل التطبيق) */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-navy-700 bg-navy-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-gold-400" />
                <h3 className="text-base font-bold text-white">
                  إجراء سريع: {SEGMENT_LABELS[filter as RadarSegment] || 'الكل'} ({rows.length} طالب)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab switch */}
            <div className="flex items-center gap-2 border-b border-navy-800 py-3 text-xs">
              <button
                type="button"
                onClick={() => setActionTab('whatsapp')}
                className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                  actionTab === 'whatsapp' ? 'bg-gold-500 text-navy-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                طابور واتساب نصف يدوي
              </button>
              <button
                type="button"
                onClick={() => setActionTab('inapp')}
                className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                  actionTab === 'inapp' ? 'bg-gold-500 text-navy-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                إشعار داخل التطبيق (Spark بث)
              </button>
            </div>

            {actionTab === 'whatsapp' ? (
              <div className="mt-4 space-y-4">
                {currentQueueStudent ? (
                  <>
                    <div className="rounded-xl bg-navy-950/80 p-3 text-xs border border-navy-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-white text-sm">{currentQueueStudent.name}</p>
                          <p className="text-slate-400 mt-0.5">
                            هاتف: {useParentPhone ? currentQueueStudent.parentPhone || 'غير متوفر' : currentQueueStudent.phone}
                          </p>
                        </div>
                        <div className="text-end">
                          <span className="text-[11px] text-gold-400 font-bold">
                            طالب {queueIndex + 1} من {queueStudents.length}
                          </span>
                          <div className="mt-1">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                              <input
                                type="checkbox"
                                checked={useParentPhone}
                                onChange={(e) => setUseParentPhone(e.target.checked)}
                                className="rounded border-navy-600 bg-navy-800 text-gold-500 focus:ring-0"
                              />
                              <span>رقم ولي الأمر</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      {!canMessageThisWeek(currentQueueStudent, Date.now()) && (
                        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 p-2 text-[11px] text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span>تنبيه: أُرسل لهذا الطالب رسالة خلال آخر 7 أيام بالفعل.</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">
                        نص الرسالة الجاهزة (مع استبدال المتغيرات):
                      </label>
                      <textarea
                        rows={3}
                        value={liveWhatsAppMsg}
                        onChange={(e) => setCustomTemplate(e.target.value)}
                        className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQueueIndex((i) => Math.max(0, i - 1))}
                          disabled={queueIndex === 0}
                          className="rounded-xl border border-navy-700 bg-navy-800 p-2 text-slate-300 disabled:opacity-40"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQueueIndex((i) => Math.min(queueStudents.length - 1, i + 1))}
                          disabled={queueIndex >= queueStudents.length - 1}
                          className="rounded-xl border border-navy-700 bg-navy-800 p-2 text-slate-300 disabled:opacity-40"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-xs text-slate-400">تخطي</span>
                      </div>

                      <a
                        href={whatsappLink(
                          useParentPhone ? currentQueueStudent.parentPhone : currentQueueStudent.phone,
                          liveWhatsAppMsg
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (queueIndex < queueStudents.length - 1) {
                            setQueueIndex((i) => i + 1);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>إرسال في واتساب ثم التالي</span>
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">لا يوجد طلاب في الطابور.</p>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">عنوان الإشعار:</label>
                  <input
                    type="text"
                    value={inAppTitle}
                    onChange={(e) => setInAppTitle(e.target.value)}
                    placeholder="مثال: تنبيه هام بخصوص موعد الواجب..."
                    className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">نص الإشعار:</label>
                  <textarea
                    rows={3}
                    value={inAppMessage}
                    onChange={(e) => setInAppMessage(e.target.value)}
                    placeholder="اكتب التنبيه أو التوجيه هنا..."
                    className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2.5 text-xs text-white focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleSendInApp}
                    disabled={inAppSending || inAppSuccess}
                    className="flex items-center gap-1.5"
                  >
                    {inAppSuccess ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                    <span>{inAppSuccess ? 'تم البث بنجاح' : inAppSending ? 'جارٍ الإرسال...' : 'بث الإشعار (1 كتابة فقط)'}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Baseline Modal (تصفير ومتابعة) */}
      {baselineModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-navy-700 bg-navy-900 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">
              تصفير ومتابعة للطالب: {baselineModalStudent.name}
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              التصفير يضبط تاريخ بداية جديدة (baselineAt) لحساب النشاط ومؤشرات الخطر بدون حذف أي بيانات سابقة.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظة الاتفاق / المتابعة:
                </label>
                <input
                  type="text"
                  value={baselineNote}
                  onChange={(e) => setBaselineNote(e.target.value)}
                  placeholder="مثال: تم الاتفاق مع ولي الأمر على المذاكرة يوميًا..."
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2 text-xs text-white focus:border-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  موعد المتابعة القادم:
                </label>
                <select
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 p-2 text-xs font-bold text-white focus:border-gold-500 focus:outline-none"
                >
                  <option value={3}>بعد 3 أيام</option>
                  <option value={7}>بعد أسبوع (7 أيام)</option>
                  <option value={14}>بعد أسبوعين</option>
                  <option value={0}>بدون موعد محدد</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setBaselineModalStudent(null)}
                >
                  إلغاء
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveBaseline}
                  disabled={savingBaseline}
                >
                  {savingBaseline ? 'جارٍ الحفظ...' : 'تأكيد التصفير كبداية جديدة'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
