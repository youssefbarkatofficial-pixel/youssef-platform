(function() {
    const optionLabels = ['أ', 'ب', 'ج', 'د'];
    const answerKeys = { 'أ': 'a', 'ب': 'b', 'ج': 'c', 'د': 'd' };
    const questionStartPattern = /^(\d+)\.\s*(.*)$/;

    function createQuestionId(existingQuestions) {
        let id;
        do {
            const randomPart = Math.random().toString(36).slice(2, 10);
            id = 'q_' + Date.now() + '_' + randomPart;
        } while (existingQuestions.some(question => question && question.id === id));
        return id;
    }

    function parseReadyExamQuestions(sourceText) {
        const lines = String(sourceText || '').replace(/^\uFEFF/, '').split(/\r?\n/);
        const blocks = [];
        let current = null;

        function finishQuestion() {
            if (!current) return;
            const questionText = current.questionLines.join('\n').trim();
            const options = {};
            current.options.forEach(option => { options[option.key] = option.text; });
            const reasons = [];
            if (!questionText) reasons.push('نص السؤال غير موجود');
            if (current.options.length < 2) reasons.push('عدد الاختيارات أقل من 2');
            if (!current.answerKey) reasons.push('سطر الإجابة غير موجود');
            else if (!options[current.answerKey]) reasons.push('حرف الإجابة لا يطابق اختياراً مستخرجاً');

            if (reasons.length) {
                blocks.push({ number: current.number, question: null, reason: reasons.join('، ') });
            } else {
                blocks.push({
                    number: current.number,
                    question: {
                        id: createQuestionId([]),
                        type: 'choose',
                        text: questionText,
                        answer: current.answerKey,
                        points: 1,
                        options: options
                    }
                });
            }
            current = null;
        }

        lines.forEach(line => {
            const questionMatch = line.match(questionStartPattern);
            if (questionMatch) {
                finishQuestion();
                current = { number: questionMatch[1], questionLines: [], options: [], expectedOption: 0, answerKey: '' };
                if (questionMatch[2]) current.questionLines.push(questionMatch[2]);
                return;
            }
            if (!current) return;

            const optionMatch = line.match(/^(أ|ب|ج|د)\)\s?(.*)$/);
            if (optionMatch) {
                const labelIndex = optionLabels.indexOf(optionMatch[1]);
                if (labelIndex === current.expectedOption) {
                    current.options.push({ key: answerKeys[optionMatch[1]], text: optionMatch[2] });
                    current.expectedOption += 1;
                }
                return;
            }
            if (line.indexOf('الإجابة:') === 0) {
                const answerMatch = line.match(/^الإجابة:\s*(أ|ب|ج|د)(?:\)|\s|$)/);
                current.answerKey = answerMatch ? answerKeys[answerMatch[1]] : '';
                if (!answerMatch) current.invalidAnswer = true;
                return;
            }
            if (current.options.length === 0) current.questionLines.push(line);
        });
        finishQuestion();
        return blocks;
    }

    window.parseReadyExamQuestions = parseReadyExamQuestions;

    window.addEventListener('load', () => {
        const button = document.getElementById('btnImportReadyQuestions');
        const fileInput = document.getElementById('readyQuestionsFile');
        const status = document.getElementById('readyQuestionsStatus');
        const summary = document.getElementById('readyQuestionsSummary');
        if (!button || !fileInput) return;

        button.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) {
                alert('يرجى اختيار ملف الأسئلة النصي أولاً.');
                return;
            }
            button.disabled = true;
            status.style.display = 'block';
            status.textContent = 'جاري قراءة ملف الأسئلة...';
            summary.style.display = 'none';
            try {
                const parsed = parseReadyExamQuestions(await file.text());
                const skipped = parsed.filter(item => !item.question);
                const existingQuestions = Array.isArray(window.examQuestions) ? window.examQuestions : [];
                const existingTexts = new Set(existingQuestions.map(question => String(question.text || '').replace(/\s+/g, ' ').trim()));
                const imported = [];
                parsed.filter(item => item.question).forEach(item => {
                    const normalizedText = item.question.text.replace(/\s+/g, ' ').trim();
                    if (existingTexts.has(normalizedText)) {
                        skipped.push({ number: item.number, reason: 'السؤال مكرر وتم تجاهله' });
                        return;
                    }
                    existingTexts.add(normalizedText);
                    item.question.id = createQuestionId(existingQuestions.concat(imported));
                    imported.push(item.question);
                });
                if (window.examQuestions && window.renderQuestionsList) {
                    imported.forEach(question => window.examQuestions.push(question));
                    window.renderQuestionsList();
                } else {
                    throw new Error('حدث خطأ في التوافق مع نظام الامتحانات الحالي.');
                }
                const skippedHtml = skipped.length
                    ? '<br><strong>أسئلة لم تُستورد:</strong><ul style="margin:5px 0 0 20px;">' + skipped.map(item => `<li>السؤال ${item.number}: ${item.reason}</li>`).join('') + '</ul>'
                    : '';
                status.textContent = 'اكتملت عملية الاستيراد.';
                summary.innerHTML = `تم استيراد <b>${imported.length}</b> سؤال، وتجاهل <b>${skipped.length}</b> سؤال.${skippedHtml}`;
                summary.style.display = 'block';
            } catch (error) {
                status.textContent = 'تعذر استيراد الملف: ' + error.message;
            } finally {
                button.disabled = false;
            }
        });
    });
})();