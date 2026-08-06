// js/flow-system.js

window.LearningFlowSystem = (function() {

    // Helper: Find attached items to a lecture
    function getAttachedItems(courseContents, lectureId) {
        let attached = [];
        if (!courseContents) return attached;
        ['trainings', 'homeworks', 'exams', 'tasks'].forEach(key => {
            if (courseContents[key] && Array.isArray(courseContents[key])) {
                courseContents[key].forEach(item => {
                    if (item.attachedToLectureId === lectureId) {
                        attached.push(item);
                    }
                });
            }
        });
        return attached;
    }

    // Helper: Verify if item is completed
    function isItemCompleted(itemId, dbUser) {
        if (!dbUser || !dbUser.completedItems) return false;
        return dbUser.completedItems.includes(itemId);
    }

    // Is it a legacy item?
    function isLegacyContent(item, dbUser) {
        if (!dbUser || !dbUser.createdAt) return false; // If we can't tell, assume strict
        if (!item.createdAt && !item.availableFrom) return false; // If content has no date, assume new strict

        let userDate = new Date(dbUser.createdAt).getTime();
        let itemDate = item.createdAt ? new Date(item.createdAt).getTime() : new Date(item.availableFrom).getTime();

        // If the item was published BEFORE the user registered, it's legacy (optional)
        return itemDate < userDate;
    }

    // Normalize item type to strict types
    function normalizeType(type, title) {
        type = type || '';
        title = title || '';
        if (type === 'video' || type === 'pdf') return 'lecture';
        if (type === 'training' || type === 'تدريب' || title.includes('تدريب')) return 'training';
        if (type === 'homework' || type === 'واجب' || type === 'task' || title.includes('واجب')) return 'homework';
        if (type === 'quiz' || type === 'امتحان' || title.includes('امتحان')) return 'exam';
        return type;
    }

    function checkItemAccess(targetItem, dbUser, course) {
        const isLegacy = isLegacyContent(targetItem, dbUser);
        
        let result = {
            allowed: true,
            isLegacy: isLegacy,
            missing: [],
            completed: []
        };

        if (!course || !course.contents) return result;

        let nType = normalizeType(targetItem.type, targetItem.title);
        
        // Lectures are always allowed if timing is right, the rest depend on parents
        if (nType === 'lecture') return result;

        let parentId = targetItem.attachedToLectureId;
        if (!parentId) return result; // No parent lecture? Just allow it based on timing

        let parentLec = course.contents.lectures?.find(l => l.id === parentId);
        if (!parentLec) return result; // Parent not found

        // Get all siblings attached to the same lecture
        let siblings = getAttachedItems(course.contents, parentId);
        let training = siblings.find(s => normalizeType(s.type, s.title) === 'training');
        let homework = siblings.find(s => normalizeType(s.type, s.title) === 'homework');

        // Check Lecture
        if (isItemCompleted(parentId, dbUser)) {
            result.completed.push('مشاهدة المحاضرة');
        } else {
            result.missing.push('مشاهدة المحاضرة');
        }

        // Check Training
        if (training) {
            if (isItemCompleted(training.id, dbUser)) {
                if (nType !== 'training') result.completed.push('حل التدريب');
            } else {
                if (nType === 'homework' || nType === 'exam') result.missing.push('حل التدريب');
            }
        }

        // Check Homework
        if (homework) {
            if (isItemCompleted(homework.id, dbUser)) {
                if (nType === 'exam') result.completed.push('حل الواجب');
            } else {
                if (nType === 'exam') result.missing.push('حل الواجب');
            }
        }

        if (result.missing.length > 0) {
            result.allowed = isLegacy; // Only allowed if it's legacy content
        }

        return result;
    }

    function showSmartModal(result, targetTitle) {
        let missingHtml = result.missing.map(m => `<div style="color:var(--accent-red); margin-bottom: 8px;"><i class="fas fa-times-circle"></i> ${m}</div>`).join('');
        let completedHtml = result.completed.map(c => `<div style="color:var(--accent-green); margin-bottom: 8px;"><i class="fas fa-check-circle"></i> ${c}</div>`).join('');
        
        let html = `
        <div class="modal-overlay active" id="strictFlowModal" style="z-index: 99999;">
            <div class="glass-panel modal-content" style="padding: 30px; max-width: 450px; text-align: center;">
                <i class="fas fa-lock" style="font-size: 3rem; color: var(--accent-red); margin-bottom: 20px;"></i>
                <h2 style="margin-bottom: 15px; color: var(--accent-red);">محتوى مغلق</h2>
                <p style="margin-bottom: 20px;">لا يمكنك الدخول إلى <strong>${targetTitle}</strong> الآن. يجب عليك إكمال الخطوات السابقة بالترتيب.</p>
                
                <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; text-align: right;">
                    ${completedHtml}
                    ${missingHtml}
                </div>
                
                <div style="margin-top: 25px;">
                    <button class="btn btn-outline" onclick="document.getElementById('strictFlowModal').remove()">حسناً، فهمت</button>
                </div>
            </div>
        </div>`;

        // Remove old if exists
        let old = document.getElementById('strictFlowModal');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', html);
    }

    function showPracticeModal(practiceCallback) {
        let html = `
        <div class="modal-overlay active" id="practicePromptModal" style="z-index: 99999; backdrop-filter: blur(10px); background: rgba(0,0,0,0.8);">
            <div class="glass-panel modal-content" style="padding: 40px; max-width: 500px; text-align: center;">
                <i class="fas fa-graduation-cap" style="font-size: 4rem; color: var(--royal-gold); margin-bottom: 20px;"></i>
                <h2 style="margin-bottom: 15px; color: var(--royal-gold);">اكتملت المحاضرة!</h2>
                <p style="margin-bottom: 30px; font-size: 1.1rem; line-height: 1.6;">لقد أنهيت مشاهدة المحاضرة بنجاح. يوجد تدريب قصير لتثبيت المعلومات، هل أنت مستعد للبدء الآن؟</p>
                
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button class="btn btn-outline" onclick="document.getElementById('practicePromptModal').remove()">لاحقاً</button>
                    <button class="btn btn-gold" id="btnStartPractice">ابدأ التدريب الآن</button>
                </div>
            </div>
        </div>`;

        let old = document.getElementById('practicePromptModal');
        if (old) old.remove();

        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('btnStartPractice').addEventListener('click', () => {
            document.getElementById('practicePromptModal').remove();
            if (practiceCallback) practiceCallback();
        });
    }

    return {
        checkItemAccess,
        showSmartModal,
        showPracticeModal,
        isLegacyContent,
        normalizeType
    };

})();
