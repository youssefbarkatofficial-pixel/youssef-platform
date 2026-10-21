import fs from 'node:fs';

let code = fs.readFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', 'utf8');
const isCrlf = code.includes('\r\n');
const toTarget = (s) => isCrlf ? s.replace(/\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

// 1. Update applyWeeklySchedule to handle weekOffset
const oldApplySchedule = `  const applyWeeklySchedule = () => {
    const s = getCairoNextSchedule(kind);
    setAvailableFrom(s.availableFrom);
    setAvailableUntil(s.availableUntil);
    showToast(\`تم تطبيق جدول الأسبوع: \${s.summary}\`, 'success');
  };`;

const newApplySchedule = `  const applyWeeklySchedule = (offset = weekOffset) => {
    const baseDate = new Date();
    if (offset > 0) {
      baseDate.setDate(baseDate.getDate() + offset * 7);
    }
    const s = getCairoNextSchedule(kind, baseDate);
    setAvailableFrom(s.availableFrom);
    setAvailableUntil(s.availableUntil);
    showToast(\`تم تطبيق جدول الأسبوع \${offset > 0 ? \`(\${offset + 1})\` : ''}: \${s.summary}\`, 'success');
  };`;

if (code.includes(toTarget(oldApplySchedule))) {
  code = code.replace(toTarget(oldApplySchedule), toTarget(newApplySchedule));
}

// 2. Update saveLectures
const oldSaveLectures = `    try {
      const count = await addLectures(courseId, lectureDrafts, lectureMode);`;

const newSaveLectures = `    try {
      const baseMs = lectureStartDateTime
        ? (cairoInputToUtcMs(lectureStartDateTime) ?? Date.now())
        : (cairoInputToUtcMs(lectureOpenAt) ?? Date.now());
      const closeBaseMs = lectureCloseAt ? cairoInputToUtcMs(lectureCloseAt) : null;

      const processedDrafts = lectureDrafts.map((d, idx) => {
        let openAt: number | null = null;
        let closeAt: number | null = null;
        if (useMultiWeekLectures) {
          openAt = baseMs + idx * 7 * 24 * 60 * 60 * 1000;
          if (closeBaseMs) closeAt = closeBaseMs + idx * 7 * 24 * 60 * 60 * 1000;
        } else {
          openAt = cairoInputToUtcMs(lectureOpenAt);
          closeAt = cairoInputToUtcMs(lectureCloseAt);
        }
        return { ...d, openAt, closeAt };
      });

      const count = await addLectures(courseId, processedDrafts, lectureMode);`;

if (code.includes(toTarget(oldSaveLectures))) {
  code = code.replace(toTarget(oldSaveLectures), toTarget(newSaveLectures));
}

// 3. Update saveFiles
const oldSaveFiles = `    try {
      const count = await addFilesToLecture(courseId, fileLectureId, fileDrafts);`;

const newSaveFiles = `    try {
      const fOpen = cairoInputToUtcMs(fileOpenAt);
      const fClose = cairoInputToUtcMs(fileCloseAt);
      const processedFiles = fileDrafts.map((f) => ({ ...f, openAt: fOpen, closeAt: fClose }));
      const count = await addFilesToLecture(courseId, fileLectureId, processedFiles);`;

if (code.includes(toTarget(oldSaveFiles))) {
  code = code.replace(toTarget(oldSaveFiles), toTarget(newSaveFiles));
}

// 4. Update addManualQuestion to handle dynamic options
const oldAddManual = `  const addManualQuestion = () => {
    if (!manualText.trim()) {
      showToast('اكتب نص السؤال أولاً', 'error');
      return;
    }
    const q: QuestionDraft = {
      id: \`q_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
      type: manualType,
      text: manualText.trim(),
      points: manualPoints,
      options: manualType === 'choose' ? { ...manualOptions } : null,
      answer: manualAnswer,
      altAnswers: [],
      rubric: [],
    };
    setQuestions([...questions, q]);
    setManualText('');
    setManualOptions({ a: '', b: '', c: '', d: '' });
    showToast('تمت إضافة السؤال للقائمة بنجاح', 'success');
  };`;

const newAddManual = `  const addManualQuestion = () => {
    if (!manualText.trim()) {
      showToast('اكتب نص السؤال أولاً', 'error');
      return;
    }
    let opts: Record<string, string> | null = null;
    if (manualType === 'choose') {
      opts = {};
      manualOptionKeys.forEach((k) => {
        opts![k] = (manualOptions[k] ?? '').trim();
      });
      const filledKeys = Object.keys(opts).filter((k) => opts![k] !== '');
      if (filledKeys.length < 2) {
        showToast('يجب ملء خيارين على الأقل لسؤال الاختيار من متعدد', 'error');
        return;
      }
      if (!opts[manualAnswer]) {
        showToast('يجب اختيار إجابة صحيحة من بين الخيارات المكتوبة', 'error');
        return;
      }
    }
    const q: QuestionDraft = {
      id: \`q_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
      type: manualType,
      text: manualText.trim(),
      points: manualPoints,
      options: opts,
      answer: manualAnswer,
      altAnswers: [],
      rubric: [],
    };
    setQuestions([...questions, q]);
    setManualText('');
    setManualOptions({ a: '', b: '', c: '', d: '' });
    showToast('تمت إضافة السؤال للقائمة بنجاح', 'success');
  };`;

if (code.includes(toTarget(oldAddManual))) {
  code = code.replace(toTarget(oldAddManual), toTarget(newAddManual));
}

// 5. Update deleteQuestion helper to also have moveQuestion helper
if (!code.includes('const moveQuestionInDraft =')) {
  code = code.replace(
    'const updateQuestionInDraft = (idx: number, patch: Partial<QuestionDraft>) => {',
    `const moveQuestionInDraft = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };\n\n  const updateQuestionInDraft = (idx: number, patch: Partial<QuestionDraft>) => {`
  );
}

fs.writeFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', code, 'utf8');
console.log('✔ QuickUploadPage functions & handlers updated');
