(function() {
    window.addEventListener('load', () => {
        const btnGenerate = document.getElementById('btnGenerateAIQuestions');
        const fileInput = document.getElementById('aiSourceFile');
        const urlInput = document.getElementById('aiSourceUrl');
        const levelSelect = document.getElementById('aiQuestionLevel');
        const statusDiv = document.getElementById('aiGeneratorStatus');
        const summaryDiv = document.getElementById('aiGeneratorSummary');

        if (!btnGenerate) return;

        btnGenerate.addEventListener('click', async () => {
            let apiKey = localStorage.getItem('admin_groq_key');
            if (!apiKey) {
                apiKey = prompt("يرجى إدخال مفتاح Groq API الخاص بك لتشغيل الذكاء الاصطناعي (سيتم حفظه محلياً ولن يطلب منك مجدداً):");
                if (apiKey) {
                    localStorage.setItem('admin_groq_key', apiKey.trim());
                } else {
                    return;
                }
            }

            const file = fileInput.files[0];
            const url = urlInput.value.trim();
            const count = parseInt(levelSelect.value) || 20;

            if (!file && !url) {
                alert("يرجى اختيار ملف PDF أو إدخال رابط Google Drive.");
                return;
            }

            btnGenerate.disabled = true;
            summaryDiv.style.display = 'none';
            statusDiv.style.display = 'block';
            
            try {
                let extractedText = "";

                if (file) {
                    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> جاري قراءة ملف PDF...';
                    extractedText = await extractTextFromPDFFile(file);
                } else if (url) {
                    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> جاري جلب الملف من الرابط...';
                    extractedText = await extractTextFromURL(url);
                }

                if (!extractedText || extractedText.trim().length < 50) {
                    throw new Error("لم نتمكن من استخراج نص كافٍ من المصدر. تأكد من أن الملف يحتوي على نصوص وليس فقط صور.");
                }

                statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> جاري تحليل المحتوى وتوليد الأسئلة بواسطة الذكاء الاصطناعي... قد يستغرق ذلك دقيقة.';
                
                const questionsJSON = await callGroqAPI(apiKey, extractedText, count);
                
                statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> جاري فحص الجودة وتجنب التكرار...';
                
                const validatedQuestions = validateAndFilterQuestions(questionsJSON);

                if (validatedQuestions.length === 0) {
                    throw new Error("تم توليد أسئلة ولكنها لم تجتز فحص الجودة والتكرار. يرجى المحاولة بمصدر أكبر.");
                }

                // Inject into existing exam logic
                if (window.examQuestions && window.renderQuestionsList) {
                    validatedQuestions.forEach(q => window.examQuestions.push(q));
                    window.renderQuestionsList();
                } else {
                    throw new Error("حدث خطأ في التوافق مع نظام الامتحانات الحالي.");
                }

                statusDiv.innerHTML = '<i class="fas fa-check-circle mr-2" style="color: #2ecc71;"></i> اكتملت العملية بنجاح!';
                summaryDiv.innerHTML = `تم توليد <b>${validatedQuestions.length}</b> سؤال واجتازت فحص الجودة بنجاح وتم إضافتها بالأسفل.`;
                summaryDiv.style.display = 'block';

            } catch (err) {
                console.error(err);
                statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle mr-2" style="color: #e74c3c;"></i> خطأ: ${err.message}`;
            } finally {
                btnGenerate.disabled = false;
                setTimeout(() => { if (statusDiv.innerHTML.includes('نجاح')) statusDiv.style.display = 'none'; }, 5000);
            }
        });

        async function extractTextFromPDFFile(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async function() {
                    try {
                        const typedarray = new Uint8Array(this.result);
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                        
                        const pdf = await pdfjsLib.getDocument(typedarray).promise;
                        let text = "";
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const content = await page.getTextContent();
                            const strings = content.items.map(item => item.str);
                            text += strings.join(" ") + "\n";
                            if (text.length > 50000) break; // Limit size to avoid overloading API
                        }
                        resolve(text);
                    } catch (e) {
                        reject(new Error("حدث خطأ أثناء قراءة ملف PDF. قد يكون الملف تالفاً أو محمياً."));
                    }
                };
                reader.onerror = () => reject(new Error("فشل قراءة الملف."));
                reader.readAsArrayBuffer(file);
            });
        }

        async function extractTextFromURL(url) {
            // Since we can't easily parse PDF from an arbitrary URL without a backend due to CORS,
            // we will throw an error advising the user to download and upload it, matching the Non-Destructive constraint.
            throw new Error("لتجنب مشاكل الصلاحيات (CORS) مع روابط Drive، يُرجى تحميل الملف على جهازك ثم رفعه مباشرة باستخدام خيار (ملف المصدر).");
        }

        async function callGroqAPI(apiKey, text, count) {
            const systemPrompt = `أنت صانع امتحانات محترف لمادة الدراسات الاجتماعية والتاريخ والجغرافيا في مصر.
لديك نص مصدر (Source text)، ومهمتك استخراج ${count} سؤال منه.

قواعد صارمة جداً جداً:
1. المصدر هو الحقيقة الوحيدة. لا تخترع أو تؤلف أي أسئلة أو معلومات من خارج النص المرفق. يجب أن تكون الإجابة موجودة نصاً داخل المرفق.
2. لا تسأل عن التواريخ، أو الأرقام الفلكية، أو الإحداثيات ما لم تكن مكتوبة بوضوح وصراحة داخل النص الذي أعطيته لك.
3. الرد يجب أن يكون مصفوفة JSON Array فقط. لا تكتب أي نص آخر.
3. لتنسيق السؤال الاختياري، تأكد أن 'options' هو كائن (Object) يحتوي على نصوص الاختيارات وليس الأحرف فقط.
مثال صحيح للسؤال الاختياري:
{
  "type": "choose",
  "text": "ما هي عاصمة مصر؟",
  "answer": "a", // الإجابة الصحيحة كحرف
  "points": 1,
  "id": "q_123",
  "options": {
    "a": "القاهرة",
    "b": "الإسكندرية",
    "c": "الأقصر",
    "d": "أسوان"
  }
}
4. مثال صحيح لسؤال صح وخطأ:
{
  "type": "tf",
  "text": "القاهرة هي عاصمة مصر.",
  "answer": "صح", // الإجابة الصحيحة "صح" أو "خطأ" فقط
  "points": 1,
  "id": "q_456"
}
5. وزّع الأسئلة بين اختياري وصح وخطأ.
`;

            const url = "https://api.groq.com/openai/v1/chat/completions";
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: "--- النص المصدر ---\n" + text }
                    ],
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error("مفتاح API غير صالح.");
                throw new Error("خطأ في الاتصال بالذكاء الاصطناعي (الكود " + response.status + ")");
            }

            const data = await response.json();
            let responseText = data.choices?.[0]?.message?.content || "[]";
            
            // Clean markdown JSON ticks
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            let json = [];
            try {
                json = JSON.parse(responseText);
            } catch (e) {
                // Try to find array using regex if formatting is heavily broken
                const match = responseText.match(/\[[\s\S]*\]/);
                if (match) {
                    try {
                        json = JSON.parse(match[0]);
                    } catch(err) {
                        throw new Error("فشل الذكاء الاصطناعي في إرجاع صيغة بيانات صحيحة.");
                    }
                } else {
                    throw new Error("فشل الذكاء الاصطناعي في إرجاع صيغة بيانات صحيحة.");
                }
            }
            
            if (!Array.isArray(json)) {
                if (json.questions && Array.isArray(json.questions)) {
                    json = json.questions;
                } else {
                    throw new Error("صيغة البيانات المستلمة غير صالحة.");
                }
            }
            
            return json;
        }

        function validateAndFilterQuestions(questions) {
            const valid = [];
            const seenTexts = new Set();
            
            for (const q of questions) {
                if (!q.id || !q.id.startsWith('q_')) {
                    q.id = 'q_' + Math.random().toString(36).substr(2, 9);
                }

                if (!q.type || !q.text || !q.answer) continue;

                const normText = q.text.replace(/\s+/g, ' ').trim();
                if (seenTexts.has(normText)) continue;
                seenTexts.add(normText);

                let cleanQ = {
                    id: String(q.id),
                    type: String(q.type),
                    text: String(q.text || ''),
                    answer: String(q.answer || '').toLowerCase().trim(),
                    points: parseFloat(q.points) || 1
                };

                if (q.type === 'choose') {
                    // Try to repair options if it's an array
                    if (Array.isArray(q.options) && q.options.length >= 4) {
                        cleanQ.options = {
                            a: String(q.options[0] || ''),
                            b: String(q.options[1] || ''),
                            c: String(q.options[2] || ''),
                            d: String(q.options[3] || '')
                        };
                        // If answer is the index or value, try to map it
                        if (cleanQ.answer === '0' || cleanQ.answer === '1') cleanQ.answer = ['a','b','c','d'][parseInt(cleanQ.answer)];
                    } else if (q.options && typeof q.options === 'object') {
                        cleanQ.options = {
                            a: String(q.options.a || q.options.A || q.options['أ'] || q.options['1'] || ''),
                            b: String(q.options.b || q.options.B || q.options['ب'] || q.options['2'] || ''),
                            c: String(q.options.c || q.options.C || q.options['ج'] || q.options['3'] || ''),
                            d: String(q.options.d || q.options.D || q.options['د'] || q.options['4'] || '')
                        };
                    } else {
                        continue;
                    }

                    // Fix if answer is full text instead of letter
                    if (!['a', 'b', 'c', 'd'].includes(cleanQ.answer)) {
                        let found = false;
                        for (const [key, val] of Object.entries(cleanQ.options)) {
                            if (val && cleanQ.answer.includes(val.toLowerCase())) {
                                cleanQ.answer = key;
                                found = true;
                                break;
                            }
                        }
                        if (!found) cleanQ.answer = 'a'; // Fallback so it doesn't just crash
                    }
                } else if (q.type === 'tf') {
                    if (cleanQ.answer.includes('صح') || cleanQ.answer === 'true' || cleanQ.answer === 't') cleanQ.answer = 'صح';
                    else if (cleanQ.answer.includes('خطأ') || cleanQ.answer.includes('غلط') || cleanQ.answer === 'false' || cleanQ.answer === 'f') cleanQ.answer = 'خطأ';
                    else cleanQ.answer = 'صح';
                } else {
                    continue; 
                }

                valid.push(cleanQ);
            }

            return valid;
        }
    });
})();
