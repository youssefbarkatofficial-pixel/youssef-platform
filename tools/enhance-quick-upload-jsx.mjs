import fs from 'node:fs';

let code = fs.readFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', 'utf8');
const isCrlf = code.includes('\r\n');
const toTarget = (s) => isCrlf ? s.replace(/\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

// 1. Lectures JSX enhancement
const oldLecEnd = `              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input
                      type="radio"
                      name="lecMode"
                      checked={lectureMode === 'append'}
                      onChange={() => setLectureMode('append')}
                    />
                    إضافة للمحاضرات الحالية ({lectures.length})
                  </label>
                  <label className="flex items-center gap-1.5 text-rose-300">
                    <input
                      type="radio"
                      name="lecMode"
                      checked={lectureMode === 'replace'}
                      onChange={() => setLectureMode('replace')}
                    />
                    استبدال الكل
                  </label>
                </div>
                <Button onClick={saveLectures} loading={savingLectures} disabled={lectureDrafts.length === 0}>
                  حفظ {lectureDrafts.length || ''} محاضرة
                </Button>
              </div>`;

const newLecEnd = `              <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-950/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gold-400">مواعيد الفتح والإغلاق بتوقيت القاهرة</span>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useMultiWeekLectures}
                      onChange={(e) => setUseMultiWeekLectures(e.target.checked)}
                      className="h-4 w-4 rounded border-navy-600 bg-navy-900 accent-gold-500"
                    />
                    <span>توزيع المحاضرات أسبوعيًا بالتتالي (كل خميس 9:00 م)</span>
                  </label>
                </div>

                {useMultiWeekLectures ? (
                  <div className="space-y-2">
                    <Input
                      label="تاريخ بداية أول محاضرة (الخميس 9:00 م بتوقيت القاهرة)"
                      type="datetime-local"
                      dir="ltr"
                      value={lectureStartDateTime}
                      onChange={(e) => setLectureStartDateTime(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-400">
                      سيتم فتح المحاضرة الأولى في هذا الموعد، والمحاضرة الثانية بعد 7 أيام، والثالثة بعد 14 يومًا تلقائيًا.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="موعد فتح المحاضرات (openAt)"
                      type="datetime-local"
                      dir="ltr"
                      value={lectureOpenAt}
                      onChange={(e) => setLectureOpenAt(e.target.value)}
                    />
                    <Input
                      label="موعد إغلاق اختياري (closeAt)"
                      type="datetime-local"
                      dir="ltr"
                      value={lectureCloseAt}
                      onChange={(e) => setLectureCloseAt(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-slate-300">
                    <input
                      type="radio"
                      name="lecMode"
                      checked={lectureMode === 'append'}
                      onChange={() => setLectureMode('append')}
                    />
                    إضافة للمحاضرات الحالية ({lectures.length})
                  </label>
                  <label className="flex items-center gap-1.5 text-rose-300">
                    <input
                      type="radio"
                      name="lecMode"
                      checked={lectureMode === 'replace'}
                      onChange={() => setLectureMode('replace')}
                    />
                    استبدال الكل
                  </label>
                </div>
                <Button onClick={saveLectures} loading={savingLectures} disabled={lectureDrafts.length === 0}>
                  حفظ {lectureDrafts.length || ''} محاضرة
                </Button>
              </div>`;

if (code.includes(toTarget(oldLecEnd))) {
  code = code.replace(toTarget(oldLecEnd), toTarget(newLecEnd));
}

// 2. Files JSX enhancement
const oldFilesEnd = `              <Button onClick={saveFiles} loading={savingFiles} disabled={!fileLectureId || fileDrafts.every((f) => !f.url)}>
                إضافة الملفات
              </Button>`;

const newFilesEnd = `              <div className="space-y-3 rounded-xl border border-navy-800 bg-navy-950/70 p-3">
                <span className="text-xs font-bold text-gold-400">مواعيد إتاحة الملفات بتوقيت القاهرة</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="موعد فتح الملفات (openAt)"
                    type="datetime-local"
                    dir="ltr"
                    value={fileOpenAt}
                    onChange={(e) => setFileOpenAt(e.target.value)}
                  />
                  <Input
                    label="موعد إغلاق اختياري (closeAt)"
                    type="datetime-local"
                    dir="ltr"
                    value={fileCloseAt}
                    onChange={(e) => setFileCloseAt(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={saveFiles} loading={savingFiles} disabled={!fileLectureId || fileDrafts.every((f) => !f.url)}>
                إضافة الملفات
              </Button>`;

if (code.includes(toTarget(oldFilesEnd))) {
  code = code.replace(toTarget(oldFilesEnd), toTarget(newFilesEnd));
}

// 3. Manual choose options (2 to 6 options)
const oldManualChoose = `                  {manualType === 'choose' && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-400">الخيارات والإجابة الصحيحة:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(['a', 'b', 'c', 'd'] as const).map((k) => (
                          <div key={k} className="flex items-center gap-2 rounded-lg border border-navy-800 bg-navy-950 p-2">
                            <input
                              type="radio"
                              name="manual_opt_ans"
                              checked={manualAnswer === k}
                              onChange={() => setManualAnswer(k)}
                            />
                            <span className="font-bold text-gold-400 uppercase">{k})</span>
                            <input
                              type="text"
                              placeholder={\`الخيار \${k}\`}
                              value={manualOptions[k]}
                              onChange={(e) => setManualOptions({ ...manualOptions, [k]: e.target.value })}
                              className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}`;

const newManualChoose = `                  {manualType === 'choose' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">
                          الخيارات ({manualOptionKeys.length} خيارات — اختر الإجابة بالدائرة):
                        </span>
                        <div className="flex items-center gap-2">
                          {manualOptionKeys.length < 6 && (
                            <button
                              type="button"
                              onClick={() => {
                                const allKeys = ['a', 'b', 'c', 'd', 'e', 'f'];
                                const nextKey = allKeys[manualOptionKeys.length];
                                if (nextKey) setManualOptionKeys([...manualOptionKeys, nextKey]);
                              }}
                              className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-bold text-gold-400 hover:bg-navy-700"
                            >
                              + إضافة خيار
                            </button>
                          )}
                          {manualOptionKeys.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const removed = manualOptionKeys[manualOptionKeys.length - 1];
                                setManualOptionKeys(manualOptionKeys.slice(0, -1));
                                if (manualAnswer === removed) setManualAnswer('a');
                              }}
                              className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-navy-700"
                            >
                              - حذف خيار
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {manualOptionKeys.map((k) => (
                          <div key={k} className="flex items-center gap-2 rounded-lg border border-navy-800 bg-navy-950 p-2">
                            <input
                              type="radio"
                              name="manual_opt_ans"
                              checked={manualAnswer === k}
                              onChange={() => setManualAnswer(k)}
                            />
                            <span className="font-bold text-gold-400 uppercase">{k})</span>
                            <input
                              type="text"
                              placeholder={\`الخيار \${k}\`}
                              value={manualOptions[k] ?? ''}
                              onChange={(e) => setManualOptions({ ...manualOptions, [k]: e.target.value })}
                              className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}`;

if (code.includes(toTarget(oldManualChoose))) {
  code = code.replace(toTarget(oldManualChoose), toTarget(newManualChoose));
}

// 4. Multi-week schedule selector
const oldWeeklyBtn = `                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gold-400">مواعيد الفتح والإغلاق (بتوقيت القاهرة)</span>
                      <button
                        type="button"
                        onClick={applyWeeklySchedule}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500/20 px-3 py-1 text-xs font-bold text-gold-300 hover:bg-gold-500/30"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-gold-400" />
                        <span>طبّق جدول الأسبوع تلقائيًا</span>
                      </button>
                    </div>`;

const newWeeklyBtn = `                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-gold-400">مواعيد الفتح والإغلاق (بتوقيت القاهرة)</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={weekOffset}
                          onChange={(e) => {
                            const offset = Number(e.target.value) || 0;
                            setWeekOffset(offset);
                            applyWeeklySchedule(offset);
                          }}
                          className="rounded-lg border border-navy-700 bg-navy-900 px-2 py-1 text-xs text-white"
                        >
                          <option value={0}>الأسبوع الحالي</option>
                          <option value={1}>الأسبوع القادم (+7 أيام)</option>
                          <option value={2}>الأسبوع الثالث (+14 يوم)</option>
                          <option value={3}>الأسبوع الرابع (+21 يوم)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => applyWeeklySchedule(weekOffset)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gold-500/20 px-3 py-1 text-xs font-bold text-gold-300 hover:bg-gold-500/30"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-gold-400" />
                          <span>طبّق جدول الأسبوع</span>
                        </button>
                      </div>
                    </div>`;

if (code.includes(toTarget(oldWeeklyBtn))) {
  code = code.replace(toTarget(oldWeeklyBtn), toTarget(newWeeklyBtn));
}

// 5. Add Up/Down buttons in questions draft list
const oldItemActions = `<button
                          type="button"
                          aria-label="حذف السؤال"
                          onClick={() => setQuestions(deleteQuestion(questions, index))}
                          className="p-1 hover:bg-rose-500/20 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </button>`;

const newItemActions = `<button
                          type="button"
                          disabled={index === 0}
                          aria-label="تحريك لأعلى"
                          onClick={() => moveQuestionInDraft(index, -1)}
                          className="p-1 hover:bg-navy-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === questions.length - 1}
                          aria-label="تحريك لأسفل"
                          onClick={() => moveQuestionInDraft(index, 1)}
                          className="p-1 hover:bg-navy-800 rounded text-slate-400 hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="حذف السؤال"
                          onClick={() => setQuestions(deleteQuestion(questions, index))}
                          className="p-1 hover:bg-rose-500/20 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        </button>`;

if (code.includes(toTarget(oldItemActions))) {
  code = code.replace(toTarget(oldItemActions), toTarget(newItemActions));
}

fs.writeFileSync('v2-app/src/pages/admin/QuickUploadPage.tsx', code, 'utf8');
console.log('✔ QuickUploadPage JSX updated successfully');
