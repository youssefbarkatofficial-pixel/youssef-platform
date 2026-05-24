
$srcFile = 'course-details.html'
$content = [System.IO.File]::ReadAllText($srcFile, [System.Text.Encoding]::UTF8)

$startTag = '// Add exam modal UI (additive, non-destructive)'
$endTag = '            })();'

$si = $content.IndexOf($startTag)
if ($si -lt 0) { Write-Host 'START NOT FOUND'; exit 1 }
$ei = $content.IndexOf($endTag, $si) + $endTag.Length
Write-Host "Found block: start=$si end=$ei len=$($ei - $si)"

$before = $content.Substring(0, $si)
$after  = $content.Substring($ei)

$newCode = @"
// Add exam modal UI — Full Featured (Timer, Auto-Submit, Strict Mode, Encouragement, Attempts)
            (function(){
                const examModalHtml = `
                <div class="modal-overlay" id="examModal">
                  <div class="glass-panel modal-content" style="padding: 20px; max-width: 800px; position:relative;">
                    <button class="close-modal" id="examModalCloseBtn"><i class="fas fa-times"></i></button>
                    <h2 id="examModalTitle" style="margin-bottom:10px;">امتحان</h2>
                    <div id="examQuestionsContainer" style="display:block; max-height:50vh; overflow:auto; gap:10px; margin-bottom:12px;"></div>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                      <button class="btn btn-outline" id="examCancelBtn">إلغاء</button>
                      <button class="btn btn-green" id="submitExamBtn">تسليم الإجابات</button>
                    </div>
                    <div id="examResultContainer" style="margin-top:12px; display:none;"></div>
                  </div>
                </div>`;
                const wrapper = document.createElement('div'); wrapper.innerHTML = examModalHtml;
                document.body.appendChild(wrapper);

                let _examTimerInterval = null;
                let _examStrictBeforeUnload = null;
                let _examStrictVisibility = null;

                function _stopTimer() { if(_examTimerInterval){ clearInterval(_examTimerInterval); _examTimerInterval = null; } }
                function _deactivateStrict() {
                    if(_examStrictBeforeUnload){ window.removeEventListener('beforeunload', _examStrictBeforeUnload); _examStrictBeforeUnload = null; }
                    if(_examStrictVisibility){ document.removeEventListener('visibilitychange', _examStrictVisibility); _examStrictVisibility = null; }
                }

                window.openExamModal = function(courseId, examIndex) {
                    _stopTimer(); _deactivateStrict();
                    const adminCourses = JSON.parse(localStorage.getItem('adminCourses')||'[]');
                    const course = adminCourses.find(c=>c.id===courseId);
                    let exam = null;
                    if(course && course.contents) {
                        if(typeof examIndex === 'number' && Array.isArray(course.contents.exams)) exam = course.contents.exams[examIndex];
                    }
                    if(!exam) { if(window.showToast) window.showToast('لا يوجد امتحان قابل للتشغيل','error'); else alert('لا يوجد امتحان.'); return; }

                    // Check availability window
                    const nowMs = Date.now();
                    if(exam.availableFrom && new Date(exam.availableFrom).getTime() > nowMs) {
                        const fromStr = new Date(exam.availableFrom).toLocaleString('ar-EG');
                        if(window.showToast) window.showToast('الامتحان لم يفتح بعد. يفتح في: ' + fromStr, 'error');
                        else alert('الامتحان لم يفتح بعد. يفتح في: ' + fromStr);
                        return;
                    }
                    if(exam.availableUntil && new Date(exam.availableUntil).getTime() < nowMs) {
                        if(window.showToast) window.showToast('انتهى وقت هذا الامتحان ولا يمكن الدخول إليه.', 'error');
                        else alert('انتهى وقت هذا الامتحان ولا يمكن الدخول إليه.');
                        return;
                    }

                    const modal = document.getElementById('examModal');
                    document.getElementById('examModalTitle').textContent = exam.title || 'امتحان';

                    const container = document.getElementById('examQuestionsContainer');
                    container.innerHTML = '';
                    ['examTimer','examStrictBadge'].forEach(id => { const el = document.getElementById(id); if(el) el.remove(); });

                    const questions = exam.questions || [];
                    questions.forEach((q, idx) => {
                        const qDiv = document.createElement('div');
                        qDiv.style.cssText = 'background: rgba(0,0,0,0.06); padding:14px; margin-bottom:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.08);';
                        let inputHtml = '';
                        if(q.type === 'choose'){
                            inputHtml = '<div>' + ['a','b','c','d'].map(k => '<label style="display:block;margin-bottom:8px;cursor:pointer;"><input type=radio name=qa_' + idx + ' value="' + k + '"/> ' + (q.options && q.options[k] ? q.options[k] : k) + '</label>').join('') + '</div>';
                        } else if(q.type === 'tf'){
                            inputHtml = '<label style="cursor:pointer;"><input type=radio name=qa_' + idx + ' value="صح"/> صح</label><label style="margin-right:15px;cursor:pointer;"><input type=radio name=qa_' + idx + ' value="خطأ"/> خطأ</label>';
                        } else {
                            inputHtml = '<textarea name=qa_' + idx + ' rows=3 style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:6px;padding:8px;" placeholder="اكتب إجابتك هنا"></textarea>';
                        }
                        qDiv.innerHTML = '<p style="margin:0 0 10px 0;font-weight:600;"><span style="color:var(--royal-gold);">س' + (idx+1) + ':</span> ' + q.text + '</p>' + inputHtml;
                        container.appendChild(qDiv);
                    });

                    const submitBtn = document.getElementById('submitExamBtn');
                    const cancelBtn = document.getElementById('examCancelBtn');
                    const resultBox = document.getElementById('examResultContainer');
                    resultBox.style.display = 'none'; resultBox.innerHTML = '';
                    submitBtn.disabled = false; submitBtn.innerHTML = 'تسليم الإجابات';

                    function doSubmit(autoSubmit) {
                        _stopTimer();
                        const studentStr = sessionStorage.getItem('currentStudent');
                        if(!studentStr){ alert('يجب تسجيل الدخول لتسليم الإجابة'); return; }
                        const student = JSON.parse(studentStr);
                        const answers = [];
                        questions.forEach((q, idx) => {
                            const name = 'qa_' + idx;
                            const els = document.getElementsByName(name);
                            let val = '';
                            if(els && els.length) {
                                if(els[0].tagName === 'TEXTAREA') { val = els[0].value || ''; }
                                else { for(const el of els) if(el.checked){ val = el.value; break; } }
                            }
                            answers.push({ q, answer: val });
                        });

                        const results = answers.map(item => {
                            try {
                                if(window.PF_Grader && typeof window.PF_Grader.scoreAnswer === 'function') {
                                    const res = window.PF_Grader.scoreAnswer(item.answer, item.q.answer, item.q.type || 'explain');
                                    return { question: item.q.text, rawAnswer: item.answer, score: res.score || 0, feedback: res.feedback || (res.score === 1 ? 'إجابة صحيحة تمامًا ✅' : 'راجع الإجابة') };
                                }
                            } catch(e) {}
                            const correct = (item.q.answer || '').toString().trim().toLowerCase();
                            const given = String(item.answer || '').trim().toLowerCase();
                            const ok = given !== '' && given === correct;
                            return { question: item.q.text, rawAnswer: item.answer, score: ok ? 1 : 0, feedback: ok ? 'إجابة صحيحة ✅' : ('إجابة غير صحيحة ❌ — الإجابة الصحيحة: ' + item.q.answer) };
                        });

                        const total = results.reduce((s, r) => s + (r.score || 0), 0);
                        const percent = Math.round((total / (results.length || 1)) * 100);

                        let penaltyApplied = false;
                        if(exam.availableUntil && new Date(exam.availableUntil).getTime() < Date.now()) { penaltyApplied = true; }
                        const effectivePercent = penaltyApplied ? Math.max(0, percent - 20) : percent;
                        const dispPct = penaltyApplied ? effectivePercent : percent;

                        let encouragement = '', encColor = '', encIcon = '';
                        if(dispPct >= 85) { encouragement = 'برافو! أداء ممتاز، استمر! 🎉'; encColor = '#2ecc71'; encIcon = '🏆'; }
                        else if(dispPct >= 60) { encouragement = 'عاش! أداء كويس، راجع الأخطاء وهتوصل! 👏'; encColor = '#f39c12'; encIcon = '👍'; }
                        else { encouragement = 'كمل! مش ناقصك غير مذاكرة أكتر، هتقدر إن شاء الله! 💪'; encColor = '#e74c3c'; encIcon = '📚'; }

                        resultBox.style.display = 'block';
                        let rHtml = '<div style="background:rgba(255,255,255,0.04);padding:20px;border-radius:14px;border:1px solid rgba(255,255,255,0.1);">';
                        rHtml += '<div style="font-size:2.5rem;margin-bottom:6px;">' + encIcon + '</div>';
                        rHtml += '<div style="font-size:1.3rem;font-weight:bold;color:' + encColor + ';margin-bottom:10px;">' + encouragement + '</div>';
                        rHtml += '<div style="font-size:1.1rem;"><strong>درجتك: ' + percent + '%</strong>' + (penaltyApplied ? ' <span style="color:#e74c3c;">(بعد خصم التأخير: ' + effectivePercent + '%)</span>' : '') + '</div>';
                        if(autoSubmit) rHtml += '<div style="margin-top:8px;color:#e74c3c;font-size:0.9rem;">⏰ تم التسليم التلقائي بعد انتهاء الوقت.</div>';
                        if(penaltyApplied) rHtml += '<div style="margin-top:10px;padding:10px;background:rgba(231,76,60,0.15);border-radius:8px;color:#e74c3c;font-size:0.9rem;">⚠️ <strong>تم خصم درجتين بسبب التأخر في التسليم بعد الموعد النهائي.</strong></div>';
                        rHtml += '<hr style="border-color:rgba(255,255,255,0.08);margin:14px 0;"><div id="_examResDetails"></div></div>';
                        resultBox.innerHTML = rHtml;

                        const detEl = document.getElementById('_examResDetails');
                        results.forEach((r, i) => {
                            const p = document.createElement('div');
                            p.style.cssText = 'padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.9rem;line-height:1.6;';
                            p.innerHTML = '<strong>س' + (i+1) + ':</strong> ' + r.question + '<br/><em style="color:rgba(255,255,255,0.6);">إجابتك:</em> <span style="color:' + (r.score >= 0.5 ? '#2ecc71' : '#e74c3c') + ';">' + (r.rawAnswer || '(بدون إجابة)') + '</span><br/><em style="color:rgba(255,255,255,0.6);">التعليق:</em> ' + r.feedback;
                            detEl.appendChild(p);
                        });

                        container.querySelectorAll('input, textarea').forEach(el => el.disabled = true);
                        submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> تم التسليم';
                        _deactivateStrict();
                        markItemCompleted(exam.id || ('exam_' + examIndex));

                        try {
                            const dbKey = 'db_' + student.phone;
                            const dbRec = JSON.parse(localStorage.getItem(dbKey) || '{}') || {};
                            dbRec.examResults = dbRec.examResults || [];
                            const prev = dbRec.examResults.filter(r => r.courseId === courseId && r.examTitle === (exam.title || ''));
                            const aNum = prev.length + 1;
                            dbRec.examResults.push({ courseId, examTitle: exam.title||'', percent, effectivePercent, penalized: penaltyApplied, attemptNumber: aNum, isOfficial: aNum===1, autoSubmit:!!autoSubmit, ts:Date.now(), details:results });
                            localStorage.setItem(dbKey, JSON.stringify(dbRec));
                            if(aNum > 1) {
                                const ntc = document.createElement('div');
                                ntc.style.cssText = 'margin-top:12px;padding:12px;background:rgba(212,166,79,0.12);border-radius:8px;color:var(--royal-gold);font-size:0.9rem;';
                                ntc.innerHTML = '<i class="fas fa-info-circle"></i> <strong>تنبيه:</strong> هذه المحاولة رقم ' + aNum + '. <strong>المحاولة الأولى هي الدرجة المعتمدة رسمياً.</strong> المحاولات اللاحقة محفوظة للمراجعة.';
                                resultBox.appendChild(ntc);
                            }
                        } catch(e) { console.error('save exam result failed', e); }
                    }

                    submitBtn.onclick = function() { doSubmit(false); };
                    cancelBtn.onclick = function() {
                        if(exam.strictMode && !submitBtn.disabled) {
                            if(confirm('⚠️ الامتحان في الوضع الصارم. هل تريد الخروج وتسليم إجاباتك الحالية؟')) { doSubmit(true); setTimeout(() => modal.classList.remove('active'), 700); }
                        } else { _stopTimer(); _deactivateStrict(); modal.classList.remove('active'); }
                    };
                    document.getElementById('examModalCloseBtn').onclick = cancelBtn.onclick;

                    // ===== TIMER =====
                    if(exam.duration && parseInt(exam.duration) > 0) {
                        let secsLeft = parseInt(exam.duration) * 60;
                        const timerEl = document.createElement('div');
                        timerEl.id = 'examTimer';
                        timerEl.style.cssText = 'text-align:center;font-size:1.5rem;font-weight:bold;color:var(--royal-gold);padding:12px 16px;background:rgba(212,166,79,0.1);border-radius:10px;margin-bottom:14px;border:1px solid rgba(212,166,79,0.2);';
                        container.parentElement.insertBefore(timerEl, container);

                        function updTm() {
                            const m = Math.floor(secsLeft / 60), s = secsLeft % 60;
                            const urg = secsLeft <= 60;
                            timerEl.style.color = urg ? '#e74c3c' : 'var(--royal-gold)';
                            timerEl.style.borderColor = urg ? 'rgba(231,76,60,0.4)' : 'rgba(212,166,79,0.2)';
                            timerEl.innerHTML = '⏱️ الوقت المتبقي: <span>' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '</span>';
                            if(secsLeft <= 0) { _stopTimer(); timerEl.innerHTML = '⏰ <span style="color:#e74c3c;">انتهى الوقت! جاري التسليم التلقائي...</span>'; setTimeout(() => doSubmit(true), 500); }
                            secsLeft--;
                        }
                        updTm(); _examTimerInterval = setInterval(updTm, 1000);
                    }

                    // ===== STRICT MODE =====
                    if(exam.strictMode) {
                        _examStrictBeforeUnload = function(e) { e.preventDefault(); e.returnValue = '⚠️ لو غلقت الصفحة هيتم تسليم الامتحان تلقائياً!'; return e.returnValue; };
                        _examStrictVisibility = function() { if(document.hidden && !submitBtn.disabled) { if(window.showToast) window.showToast('⚠️ تحذير: تغيير التبويب محظور أثناء الامتحان الصارم!', 'error'); } };
                        window.addEventListener('beforeunload', _examStrictBeforeUnload);
                        document.addEventListener('visibilitychange', _examStrictVisibility);
                        const sb = document.createElement('div');
                        sb.id = 'examStrictBadge';
                        sb.style.cssText = 'background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.3);color:#e74c3c;padding:10px 14px;border-radius:8px;font-size:0.9rem;margin-bottom:12px;';
                        sb.innerHTML = '🔒 <strong>وضع الامتحان الصارم مفعّل</strong> — الخروج أو تغيير التبويب محظور أثناء الامتحان.';
                        container.parentElement.insertBefore(sb, container);
                    }

                    modal.classList.add('active');
                };
            })();
"@

$newContent = $before + $newCode + $after
[System.IO.File]::WriteAllText($srcFile, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done. New file size: $((Get-Item $srcFile).Length)"
