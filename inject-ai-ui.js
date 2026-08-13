const fs = require('fs');
let html = fs.readFileSync('admin-upload.html', 'utf8');

if (!html.includes('pdf.min.js')) {
    html = html.replace('</head>', '    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>\n</head>');
}

if (!html.includes('ai-generator-section')) {
    const injectHTML = `
                        <!-- AI Question Generator Section -->
                        <div class="ai-generator-section" style="background: rgba(46, 204, 113, 0.1); padding: 20px; border-radius: 12px; border: 1px dashed #2ecc71; margin-bottom: 30px;">
                            <h4 style="color: #2ecc71; font-weight: bold; margin-bottom: 15px;"><i class="fas fa-robot mr-2"></i> إنشاء أسئلة بالذكاء الاصطناعي من ملف</h4>
                            
                            <div class="form-group">
                                <label>ملف المصدر (PDF)</label>
                                <input type="file" id="aiSourceFile" accept=".pdf" class="form-control" style="padding: 10px;">
                            </div>
                            
                            <div class="text-center" style="color:#aaa; font-size:12px; margin: 10px 0;">أو</div>
                            
                            <div class="form-group">
                                <label>رابط Google Drive (يجب أن يكون متاحاً للعامة)</label>
                                <input type="url" id="aiSourceUrl" class="form-control" placeholder="https://drive.google.com/file/d/...">
                            </div>
                            
                            <div class="form-group">
                                <label>مستوى الإنشاء (عدد الأسئلة)</label>
                                <select id="aiQuestionLevel" class="form-control">
                                    <option value="20">بسيط — 20 سؤالًا متنوعًا</option>
                                    <option value="30" selected>متوسط — 30 سؤالًا متنوعًا</option>
                                    <option value="40">مطول — 40 سؤالًا (شامل للمنهج)</option>
                                </select>
                            </div>
                            
                            <button type="button" id="btnGenerateAIQuestions" class="btn btn-block" style="background-color: #2ecc71; color: white; border-radius: 8px; font-weight: bold; margin-top: 15px;">
                                <i class="fas fa-magic mr-2"></i> تحليل الملف وإنشاء الأسئلة
                            </button>
                            
                            <div id="aiGeneratorStatus" style="margin-top: 15px; color: #f1c40f; font-weight: bold; display: none; text-align: center;"></div>
                            <div id="aiGeneratorSummary" style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; display: none; font-size: 0.95rem;"></div>
                        </div>
                        <hr style="border-color: rgba(255,255,255,0.1); margin-bottom: 30px;">
                        
                        <div class="form-group">
                            <label>نوع السؤال</label>`;
                            
    html = html.replace(/<div class="form-group">\s*<label>نوع السؤال<\/label>/, injectHTML);
}

if (!html.includes('ai-question-generator.js')) {
    html = html.replace('</body>', '    <script src="js/ai-question-generator.js"></script>\n</body>');
}

fs.writeFileSync('admin-upload.html', html);
console.log('Successfully injected UI and PDF.js');
