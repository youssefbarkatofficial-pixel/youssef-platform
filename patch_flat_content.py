import sys

with open('admin-courses.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add "إدارة المرفوعات" button to course actions
button_code = """<button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.8rem; border-color: #9b59b6; color: #9b59b6;" onclick="openFlatContentManager('${c.id}')"><i class="fas fa-list"></i> إدارة المرفوعات</button>"""

if 'openCourseSubscribers' in content and 'إدارة المرفوعات' not in content:
    content = content.replace(
        `<button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.8rem; border-color: var(--royal-gold); color: var(--royal-gold);" onclick="openCourseSubscribers('${c.id}')"><i class="fas fa-users"></i> المشتركين</button>`,
        `<button class="btn btn-outline" style="padding: 5px 10px; font-size: 0.8rem; border-color: var(--royal-gold); color: var(--royal-gold);" onclick="openCourseSubscribers('${c.id}')"><i class="fas fa-users"></i> المشتركين</button>\n                        ` + button_code
    )

# 2. Add the modal for Flat Content Manager
modal_code = """
    <!-- Flat Content Manager Modal -->
    <div class="modal-overlay" id="flatContentModal">
        <div class="glass-panel modal-content" style="max-width: 800px; padding: 25px;">
            <button class="close-modal" onclick="document.getElementById('flatContentModal').style.display='none'"><i class="fas fa-times"></i></button>
            <h2 class="text-gold mb-3"><i class="fas fa-list-ul mr-2"></i> إدارة المحتويات المرفوعة للكورس</h2>
            <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom: 20px;">هنا يمكنك حذف أو تعديل أي فيديو أو امتحان تم رفعه لهذا الكورس بشكل مباشر من قاعدة البيانات.</p>
            
            <div id="flatContentContainer" style="max-height: 500px; overflow-y: auto; padding-right: 10px;">
                <!-- Content injected here -->
            </div>
        </div>
    </div>
"""

if 'id="flatContentModal"' not in content:
    content = content.replace('<!-- Subscriptions Modal -->', modal_code + '\n    <!-- Subscriptions Modal -->')

# 3. Add JS functions for Flat Content Manager
js_code = """
// --- FLAT CONTENT MANAGER ---
window.openFlatContentManager = function(courseId) {
    const courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    window.currentFlatCourseId = courseId;
    renderFlatContents();
    document.getElementById('flatContentModal').style.display = 'flex';
};

window.renderFlatContents = function() {
    const courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
    const course = courses.find(c => c.id === window.currentFlatCourseId);
    if (!course || !course.contents) return;
    
    const container = document.getElementById('flatContentContainer');
    container.innerHTML = '';
    
    const lists = [
        { key: 'lectures', name: 'المحاضرات (فيديو/ملفات/عناوين)' },
        { key: 'homeworks', name: 'الواجبات' },
        { key: 'exams', name: 'الامتحانات' },
        { key: 'trainings', name: 'التدريبات' }
    ];
    
    let html = '';
    
    lists.forEach(list => {
        if (course.contents[list.key] && course.contents[list.key].length > 0) {
            html += `<h4 style="color:var(--accent-cyan); margin-top:20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom:5px;">${list.name}</h4>`;
            
            course.contents[list.key].forEach((item, idx) => {
                let details = '';
                if(item.type === 'video') details = `<span style="color:#2ecc71;font-size:0.8rem;">(فيديو)</span>`;
                else if(item.type === 'pdf') details = `<span style="color:#e74c3c;font-size:0.8rem;">(PDF)</span>`;
                else if(item.type === 'quiz') details = `<span style="color:#f1c40f;font-size:0.8rem;">(امتحان)</span>`;
                
                html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:10px 15px; margin-bottom:5px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <div>
                        <strong style="color:#fff;">${item.title || 'بدون عنوان'}</strong> ${details}
                        <div style="font-size:0.75rem; color:#aaa; margin-top:3px;">ID: ${item.id || 'N/A'}</div>
                    </div>
                    <div>
                        <button class="btn btn-outline" style="padding:4px 8px; border-color:#e74c3c; color:#e74c3c; font-size:0.8rem;" onclick="deleteFlatItem('${list.key}', ${idx})"><i class="fas fa-trash"></i> مسح</button>
                    </div>
                </div>
                `;
                
                // Show children if it's a header
                if (item.children && item.children.length > 0) {
                    html += `<div style="padding-right: 20px; border-right: 2px solid rgba(255,255,255,0.1); margin-bottom:10px;">`;
                    item.children.forEach((child, cIdx) => {
                        let cDetails = '';
                        if(child.type === 'video') cDetails = `<span style="color:#2ecc71;font-size:0.8rem;">(فيديو)</span>`;
                        else if(child.type === 'pdf') cDetails = `<span style="color:#e74c3c;font-size:0.8rem;">(PDF)</span>`;
                        else if(child.type === 'quiz') cDetails = `<span style="color:#f1c40f;font-size:0.8rem;">(امتحان)</span>`;
                        
                        html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); padding:8px 12px; margin-bottom:5px; border-radius:6px; border:1px solid rgba(255,255,255,0.02);">
                            <div>
                                <strong style="color:#eee; font-size:0.9rem;">- ${child.title || 'بدون عنوان'}</strong> ${cDetails}
                            </div>
                            <div>
                                <button class="btn btn-outline" style="padding:2px 6px; border-color:#e74c3c; color:#e74c3c; font-size:0.75rem;" onclick="deleteFlatChildItem('${list.key}', ${idx}, ${cIdx})"><i class="fas fa-trash"></i> مسح</button>
                            </div>
                        </div>
                        `;
                    });
                    html += `</div>`;
                }
            });
        }
    });
    
    if(!html) {
        html = '<div style="text-align:center; padding:20px; color:#aaa;">لا يوجد أي محتوى مرفوع لهذا الكورس بعد.</div>';
    }
    
    container.innerHTML = html;
};

window.deleteFlatItem = async function(listKey, idx) {
    const pwd = await window.requireAdminPassword();
    if(pwd !== '0000') return alert('كلمة المرور خاطئة');
    
    if(!confirm('هل أنت متأكد من مسح هذا العنصر نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    const courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
    const courseIndex = courses.findIndex(c => c.id === window.currentFlatCourseId);
    if(courseIndex === -1) return;
    
    courses[courseIndex].contents[listKey].splice(idx, 1);
    
    localStorage.setItem('adminCourses', JSON.stringify(courses));
    if (window.FirebaseService && window.FirebaseService.isReady()) {
        window.FirebaseService.saveCourse(courses[courseIndex]);
    }
    window.renderFlatContents();
    if(window.showToast) window.showToast('تم مسح العنصر بنجاح', 'success');
};

window.deleteFlatChildItem = async function(listKey, parentIdx, childIdx) {
    const pwd = await window.requireAdminPassword();
    if(pwd !== '0000') return alert('كلمة المرور خاطئة');
    
    if(!confirm('هل أنت متأكد من مسح هذا العنصر الفرعي نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    const courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
    const courseIndex = courses.findIndex(c => c.id === window.currentFlatCourseId);
    if(courseIndex === -1) return;
    
    courses[courseIndex].contents[listKey][parentIdx].children.splice(childIdx, 1);
    
    localStorage.setItem('adminCourses', JSON.stringify(courses));
    if (window.FirebaseService && window.FirebaseService.isReady()) {
        window.FirebaseService.saveCourse(courses[courseIndex]);
    }
    window.renderFlatContents();
    if(window.showToast) window.showToast('تم مسح العنصر الفرعي بنجاح', 'success');
};
// --- END FLAT CONTENT MANAGER ---
"""

if 'openFlatContentManager' not in content:
    content = content.replace('// --- GLOBALS & UTILS ---', js_code + '\n// --- GLOBALS & UTILS ---')

with open('admin-courses.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Flat Content Manager injected successfully.")
