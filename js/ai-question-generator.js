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

قواعد صارمة جداً (Quality > Quantity):
1. **المصدر هو الحقيقة الوحيدة**: لا تضف أي معلومة خارجية، ولا تخترع أسئلة إذا كان النص لا يكفي. استخرج الحد الأقصى الممكن دون اختلاق.
2. **صيغة JSON فقط**: يجب أن يكون ردك عبارة عن JSON Array حصراً (مصفوفة JSON)، بدون أي نصوص أخرى أو علامات Markdown.
3. **عدم التكرار**: تأكد من أن الأسئلة تغطي أجزاء مختلفة من النص.
4. **تنسيق السؤال الاختياري**:
{
  "type": "choose",
  "text": "السؤال هنا؟",
  "answer": "a", // يجب أن يكون أحد الأحرف a, b, c, d
  "points": 1,
  "id": "q_" + أرقام عشوائية,
  "options": { "a": "الخيار الأول", "b": "الخيار الثاني", "c": "الخيار الثالث", "d": "الخيار الرابع" }
}
5. **تنسيق سؤال صح وخطأ**:
{
  "type": "tf",
  "text": "السؤال هنا",
  "answer": "صح", // أو "خطأ"
  "points": 1,
  "id": "q_" + أرقام عشوائية
}
6. قم بتوزيع الأسئلة بين اختياري وصح وخطأ.
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
                throw new Error("فشل الذكاء الاصطناعي في إرجاع صيغة بيانات صحيحة.");
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
                // Ensure ID is generated correctly if missing or format is wrong
                if (!q.id || !q.id.startsWith('q_')) {
                    q.id = 'q_' + Math.random().toString(36).substr(2, 9);
                }

                // Check basic structure
                if (!q.type || !q.text || !q.answer) continue;

                // Duplicate Check
                const normText = q.text.replace(/\s+/g, ' ').trim();
                if (seenTexts.has(normText)) continue;
                seenTexts.add(normText);

                if (q.type === 'choose') {
                    if (!q.options || !q.options.a || !q.options.b || !q.options.c || !q.options.d) continue;
                    if (!['a', 'b', 'c', 'd'].includes(q.answer)) continue;
                } else if (q.type === 'tf') {
                    if (q.answer !== 'صح' && q.answer !== 'خطأ') continue;
                } else {
                    continue; // Skip unknown types
                }

                valid.push(q);
            }

            return valid;
        }
    });
})();
