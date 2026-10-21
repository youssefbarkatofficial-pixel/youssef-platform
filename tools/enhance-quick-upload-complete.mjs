import fs from 'node:fs';

let code = fs.readFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', 'utf8');

// 1. Ensure cairoTime imports
if (!code.includes("from '../../lib/cairoTime'")) {
  code = code.replace(
    "import { formatCairoScheduleSummary, getCairoNextSchedule } from '../../lib/questionImport';",
    "import { formatCairoScheduleSummary, getCairoNextSchedule } from '../../lib/questionImport';\nimport { cairoInputToUtcMs, formatCairoDateTime, tzOffsetMs, cairoToUtcMs } from '../../lib/cairoTime';"
  );
}

// 2. Ensure icons ArrowUp, ArrowDown are imported
if (!code.includes('ArrowUp,') && !code.includes('ArrowUp ')) {
  code = code.replace(
    "import {\n  AlertTriangle,",
    "import {\n  AlertTriangle,\n  ArrowUp,\n  ArrowDown,"
  );
}

// 3. Update state declarations
const oldStateLec = `  // محاضرات
  const [lectureText, setLectureText] = useState('');
  const [lectureMode, setLectureMode] = useState<'append' | 'replace'>('append');
  const [savingLectures, setSavingLectures] = useState(false);
  const lectureDrafts = useMemo(() => parseLectureLines(lectureText), [lectureText]);`;

const newStateLec = `  // محاضرات
  const [lectureText, setLectureText] = useState('');
  const [lectureMode, setLectureMode] = useState<'append' | 'replace'>('append');
  const [savingLectures, setSavingLectures] = useState(false);
  const [lectureOpenAt, setLectureOpenAt] = useState('');
  const [lectureCloseAt, setLectureCloseAt] = useState('');
  const [useMultiWeekLectures, setUseMultiWeekLectures] = useState(false);
  const [lectureStartDateTime, setLectureStartDateTime] = useState('');
  const lectureDrafts = useMemo(() => parseLectureLines(lectureText), [lectureText]);`;

const oldStateFiles = `  // ملفات
  const [fileLectureId, setFileLectureId] = useState('');
  const [fileText, setFileText] = useState('');
  const [savingFiles, setSavingFiles] = useState(false);
  const fileDrafts = useMemo(() => parseFileLines(fileText), [fileText]);`;

const newStateFiles = `  // ملفات
  const [fileLectureId, setFileLectureId] = useState('');
  const [fileText, setFileText] = useState('');
  const [savingFiles, setSavingFiles] = useState(false);
  const [fileOpenAt, setFileOpenAt] = useState('');
  const [fileCloseAt, setFileCloseAt] = useState('');
  const fileDrafts = useMemo(() => parseFileLines(fileText), [fileText]);`;

const oldManual = `  // وضع الإضافة اليدوية سؤال بسؤال (Part 3)
  const [assessmentMode, setAssessmentMode] = useState<'import' | 'manual'>('import');
  const [manualType, setManualType] = useState<QuestionType>('choose');
  const [manualText, setManualText] = useState('');
  const [manualPoints, setManualPoints] = useState(1);
  const [manualOptions, setManualOptions] = useState<Record<string, string>>({ a: '', b: '', c: '', d: '' });
  const [manualAnswer, setManualAnswer] = useState('a');`;

const newManual = `  // وضع الإضافة اليدوية سؤال بسؤال (Part 3)
  const [assessmentMode, setAssessmentMode] = useState<'import' | 'manual'>('import');
  const [manualType, setManualType] = useState<QuestionType>('choose');
  const [manualText, setManualText] = useState('');
  const [manualPoints, setManualPoints] = useState(1);
  const [manualOptionKeys, setManualOptionKeys] = useState<string[]>(['a', 'b', 'c', 'd']);
  const [manualOptions, setManualOptions] = useState<Record<string, string>>({ a: '', b: '', c: '', d: '' });
  const [manualAnswer, setManualAnswer] = useState('a');
  const [weekOffset, setWeekOffset] = useState<number>(0);`;

const isCrlf = code.includes('\r\n');
const toTarget = (s) => isCrlf ? s.replace(/\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

if (code.includes(toTarget(oldStateLec))) code = code.replace(toTarget(oldStateLec), toTarget(newStateLec));
if (code.includes(toTarget(oldStateFiles))) code = code.replace(toTarget(oldStateFiles), toTarget(newStateFiles));
if (code.includes(toTarget(oldManual))) code = code.replace(toTarget(oldManual), toTarget(newManual));

fs.writeFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', code, 'utf8');
console.log('✔ QuickUploadPage state patched');
