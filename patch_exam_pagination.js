const fs = require('fs');
let html = fs.readFileSync('course-details.html', 'utf8');

// The goal is to modify the generated HTML inside `renderExam` to wrap questions in a carousel.
// Currently, questions are rendered as a loop and appended to `qHtml`.
// We will wrap each question div in a `.exam-question-slide` that is hidden by default.

// First, inject CSS for slides
if (!html.includes('.exam-question-slide')) {
    html = html.replace('</style>', `
.exam-question-slide { display: none; animation: fadeIn 0.3s; }
.exam-question-slide.active { display: block; }
.exam-nav-buttons { display: flex; justify-content: space-between; margin-top: 20px; gap: 10px; }
.exam-nav-buttons button { flex: 1; padding: 12px; font-weight: bold; }
.exam-progress { text-align: center; margin-bottom: 15px; font-weight: bold; color: var(--accent-cyan); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>`);
}

// Modify the question rendering loop to add `.exam-question-slide` class
if (html.includes('<div class="question-item" style="')) {
    html = html.replace(
        /<div class="question-item" style="[^"]*"/g,
        '$& class="question-item exam-question-slide"'
    );
}

// Modify the doSubmit function / structure to handle pagination navigation
// I'll inject a script block at the end of the file to override `renderExam` slightly or attach the logic dynamically after it's rendered.
// Actually, it's safer to inject logic right after `examContent.innerHTML = ...`
const injectionTarget = /examContent\.innerHTML\s*=\s*qHtml;/;
const injectionScript = `examContent.innerHTML = qHtml;
                    
                    // --- EXAM PAGINATION LOGIC ---
                    const slides = Array.from(examContent.querySelectorAll('.question-item'));
                    if (slides.length > 0) {
                        slides.forEach(s => s.classList.add('exam-question-slide'));
                        let currentSlide = 0;
                        
                        const progressEl = document.createElement('div');
                        progressEl.className = 'exam-progress';
                        examContent.insertBefore(progressEl, examContent.firstChild);
                        
                        const navContainer = document.createElement('div');
                        navContainer.className = 'exam-nav-buttons';
                        
                        const prevBtn = document.createElement('button');
                        prevBtn.className = 'btn btn-outline';
                        prevBtn.innerHTML = '<i class="fas fa-arrow-right"></i> السؤال السابق';
                        
                        const nextBtn = document.createElement('button');
                        nextBtn.className = 'btn btn-green';
                        nextBtn.innerHTML = 'السؤال التالي <i class="fas fa-arrow-left"></i>';
                        
                        navContainer.appendChild(prevBtn);
                        navContainer.appendChild(nextBtn);
                        
                        // Move submit button into the nav container or hide it until the last slide
                        const submitBox = document.querySelector('.exam-submit-box');
                        if (submitBox) submitBox.style.display = 'none';
                        
                        examContent.appendChild(navContainer);
                        
                        const updateSlides = () => {
                            slides.forEach((s, i) => {
                                if (i === currentSlide) s.classList.add('active');
                                else s.classList.remove('active');
                            });
                            progressEl.innerHTML = \`السؤال \${currentSlide + 1} من \${slides.length}\`;
                            
                            prevBtn.style.display = currentSlide === 0 ? 'none' : 'block';
                            
                            if (currentSlide === slides.length - 1) {
                                nextBtn.style.display = 'none';
                                if (submitBox) submitBox.style.display = 'block';
                            } else {
                                nextBtn.style.display = 'block';
                                if (submitBox) submitBox.style.display = 'none';
                            }
                        };
                        
                        prevBtn.onclick = () => {
                            if (currentSlide > 0) {
                                currentSlide--;
                                updateSlides();
                                document.getElementById('examModal').scrollTo({top: 0, behavior: 'smooth'});
                            }
                        };
                        
                        nextBtn.onclick = () => {
                            if (currentSlide < slides.length - 1) {
                                currentSlide++;
                                updateSlides();
                                document.getElementById('examModal').scrollTo({top: 0, behavior: 'smooth'});
                            }
                        };
                        
                        updateSlides();
                    }
                    // ---------------------------
`;

if (!html.includes('EXAM PAGINATION LOGIC')) {
    html = html.replace(injectionTarget, injectionScript);
}

fs.writeFileSync('course-details.html', html, 'utf8');
console.log('Fixed pagination in course-details.html');
