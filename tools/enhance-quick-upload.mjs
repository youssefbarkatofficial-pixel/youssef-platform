import fs from 'fs';

let page = fs.readFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', 'utf8');

// 1. Add cairoTime import if missing
if (!page.includes("from '../../lib/cairoTime'")) {
  page = page.replace(
    "import { formatCairoScheduleSummary, getCairoNextSchedule } from '../../lib/questionImport';",
    "import { formatCairoScheduleSummary, getCairoNextSchedule } from '../../lib/questionImport';\nimport { cairoInputToUtcMs, formatCairoDateTime, tzOffsetMs, cairoToUtcMs } from '../../lib/cairoTime';"
  );
}

// 2. Add state for lectures openAt/closeAt and weekly distribution
const oldLecState = `  // محاضرات
  const [lectureText, setLectureText] = useState('');
  const [lectureMode, setLectureMode] = useState<'append' | 'replace'>('append');
  const [savingLectures, setSavingLectures] = useState(false);
  const lectureDrafts = useMemo(() => parseLectureLines(lectureText), [lectureText]);`;

const newLecState = `  // محاضرات
  const [lectureText, setLectureText] = useState('');
  const [lectureMode, setLectureMode] = useState<'append' | 'replace'>('append');
  const [savingLectures, setSavingLectures] = useState(false);
  const [lectureOpenAt, setLectureOpenAt] = useState('');
  const [lectureCloseAt, setLectureCloseAt] = useState('');
  const [multiWeekStartDate, setMultiWeekStartDate] = useState('');
  const [useMultiWeek, setUseMultiWeek] = useState(false);
  const lectureDrafts = useMemo(() => parseLectureLines(lectureText), [lectureText]);`;

// 3. Add state for files openAt/closeAt
const oldFileState = `  // ملفات
  const [fileLectureId, setFileLectureId] = useState('');
  const [fileText, setFileText] = useState('');
  const [savingFiles, setSavingFiles] = useState(false);
  const fileDrafts = useMemo(() => parseFileLines(fileText), [fileText]);`;

const newFileState = `  // ملفات
  const [fileLectureId, setFileLectureId] = useState('');
  const [fileText, setFileText] = useState('');
  const [savingFiles, setSavingFiles] = useState(false);
  const [fileOpenAt, setFileOpenAt] = useState('');
  const [fileCloseAt, setFileCloseAt] = useState('');
  const fileDrafts = useMemo(() => parseFileLines(fileText), [fileText]);`;

// 4. Add dynamic options state (2 to 6 options)
const oldManualState = `  // وضع الإضافة اليدوية سؤال بسؤال (Part 3)
  const [assessmentMode, setAssessmentMode] = useState<'import' | 'manual'>('import');
  const [manualType, setManualType] = useState<QuestionType>('choose');
  const [manualText, setManualText] = useState('');
  const [manualPoints, setManualPoints] = useState(1);
  const [manualOptions, setManualOptions] = useState<Record<string, string>>({ a: '', b: '', c: '', d: '' });
  const [manualAnswer, setManualAnswer] = useState('a');`;

const newManualState = `  // وضع الإضافة اليدوية سؤال بسؤال (Part 3)
  const [assessmentMode, setAssessmentMode] = useState<'import' | 'manual'>('import');
  const [manualType, setManualType] = useState<QuestionType>('choose');
  const [manualText, setManualText] = useState('');
  const [manualPoints, setManualPoints] = useState(1);
  const [manualOptionKeys, setManualOptionKeys] = useState<string[]>(['a', 'b', 'c', 'd']);
  const [manualOptions, setManualOptions] = useState<Record<string, string>>({ a: '', b: '', c: '', d: '' });
  const [manualAnswer, setManualAnswer] = useState('a');`;

const isCrlf = page.includes('\r\n');
const toTarget = (s) => isCrlf ? s.replace(/\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

if (page.includes(toTarget(oldLecState))) page = page.replace(toTarget(oldLecState), toTarget(newLecState));
if (page.includes(toTarget(oldFileState))) page = page.replace(toTarget(oldFileState), toTarget(newFileState));
if (page.includes(toTarget(oldManualState))) page = page.replace(toTarget(oldManualState), toTarget(newManualState));

fs.writeFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', page, 'utf8');
console.log('✔ Enhanced QuickUploadPage state');
