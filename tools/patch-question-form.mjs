import fs from 'node:fs';

let content = fs.readFileSync('v2-app/src/components/admin/QuestionForm.tsx', 'utf8');

// Add optionCount state
const stateMarker = "const [error, setError] = useState('');";
const stateAdd = `const [error, setError] = useState('');
  const [optionCount, setOptionCount] = useState<number>(() => {
    if (!initial?.options) return 4;
    const filled = Object.entries(initial.options).filter(([k, v]) => (v ?? '').trim() !== '');
    return Math.max(2, Math.min(6, filled.length || 4));
  });`;

content = content.replace(stateMarker, stateAdd);

// Replace the choose fieldset
const oldChoose = `{draft.type === 'choose' && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-medium text-slate-300">
            الخيارات (اختر الإجابة الصحيحة بالدائرة)
          </legend>
          {OPTION_KEYS.map((key) => (
            <div key={key} className="flex items-end gap-3">
              <label
                className={cn(
                  'mb-0.5 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border',
                  draft.answer === key
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-navy-700 bg-navy-900 text-slate-400',
                )}
              >
                <input
                  type="radio"
                  name="correct-option"
                  checked={draft.answer === key}
                  onChange={() => update({ answer: key })}
                  className="sr-only"
                  aria-label={\`الإجابة الصحيحة هي الخيار \${OPTION_LABELS[key]}\`}
                />
                <span className="font-bold">{OPTION_LABELS[key]}</span>
              </label>
              <div className="flex-1">
                <Input
                  aria-label={\`الخيار \${OPTION_LABELS[key]}\`}
                  value={draft.options?.[key] ?? ''}
                  onChange={(event) => setOption(key, event.target.value)}
                />
              </div>
            </div>
          ))}
        </fieldset>
      )}`;

const newChoose = `{draft.type === 'choose' && (
        <fieldset className="space-y-3">
          <div className="flex items-center justify-between">
            <legend className="mb-1 text-sm font-medium text-slate-300">
              الخيارات ({optionCount} خيارات — اختر الإجابة الصحيحة بالدائرة)
            </legend>
            <div className="flex items-center gap-2">
              {optionCount < 6 && (
                <button
                  type="button"
                  onClick={() => setOptionCount((c) => Math.min(6, c + 1))}
                  className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-bold text-gold-400 hover:bg-navy-700"
                >
                  + إضافة خيار
                </button>
              )}
              {optionCount > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const removeKey = OPTION_KEYS[optionCount - 1];
                    setOptionCount((c) => Math.max(2, c - 1));
                    if (draft.options) {
                      const next = { ...draft.options };
                      delete next[removeKey];
                      update({ options: next, answer: draft.answer === removeKey ? 'a' : draft.answer });
                    }
                  }}
                  className="rounded-lg bg-navy-800 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-navy-700"
                >
                  - حذف خيار
                </button>
              )}
            </div>
          </div>
          {OPTION_KEYS.slice(0, optionCount).map((key) => (
            <div key={key} className="flex items-end gap-3">
              <label
                className={cn(
                  'mb-0.5 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border',
                  draft.answer === key
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-navy-700 bg-navy-900 text-slate-400',
                )}
              >
                <input
                  type="radio"
                  name="correct-option"
                  checked={draft.answer === key}
                  onChange={() => update({ answer: key })}
                  className="sr-only"
                  aria-label={\`الإجابة الصحيحة هي الخيار \${OPTION_LABELS[key]}\`}
                />
                <span className="font-bold">{OPTION_LABELS[key]}</span>
              </label>
              <div className="flex-1">
                <Input
                  aria-label={\`الخيار \${OPTION_LABELS[key]}\`}
                  value={draft.options?.[key] ?? ''}
                  onChange={(event) => setOption(key, event.target.value)}
                />
              </div>
            </div>
          ))}
        </fieldset>
      )}`;

const isCrlf = content.includes('\r\n');
const toTarget = (s) => isCrlf ? s.replace(/\n/g, '\r\n') : s.replace(/\r\n/g, '\n');

content = content.replace(toTarget(oldChoose), toTarget(newChoose));
fs.writeFileSync('v2-app/src/components/admin/QuestionForm.tsx', content, 'utf8');
console.log('✔ QuestionForm.tsx updated with 2-6 options support');
