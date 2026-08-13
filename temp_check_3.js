
window.injectVideoWatermark = function(container) {
    try {
        const studentStr = sessionStorage.getItem('currentUser');
        if (!studentStr) return;
        const student = JSON.parse(studentStr);
        if (!student || !student.phone) return;
        
        container.style.position = 'relative';

        const wm = document.createElement('div');
        wm.className = 'moving-watermark';
        wm.style.cssText = 'position: absolute; color: rgba(255,255,255,0.25); font-size: 1.2rem; font-weight: bold; pointer-events: none; z-index: 999999; white-space: nowrap; text-shadow: 1px 1px 2px rgba(0,0,0,0.8); transition: all 10s linear; user-select: none; direction: rtl;';
        
        const updateText = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('ar-EG');
            wm.textContent = `${student.name || ''} - ${student.studentCode || student.phone} - ${timeStr}`;
        };
        updateText();
        setInterval(updateText, 10000);

        container.appendChild(wm);

        const moveWatermark = () => {
            if(!container.contains(wm)) return;
            const maxX = Math.max(0, container.clientWidth - wm.clientWidth - 20);
            const maxY = Math.max(0, container.clientHeight - wm.clientHeight - 20);
            const randomX = Math.floor(Math.random() * maxX);
            const randomY = Math.floor(Math.random() * maxY);
            const rot = Math.floor(Math.random() * 10 - 5);
            wm.style.transform = `translate(${randomX}px, ${randomY}px) rotate(${rot}deg)`;
            setTimeout(moveWatermark, 10000);
        };
        
        setTimeout(moveWatermark, 100);
    } catch(e) {}
};

window.enrollFreeCourse = async function(courseId) {
    if(!sessionStorage.getItem('currentStudent')) return;
    const user = JSON.parse(sessionStorage.getItem('currentStudent'));
    
    // Add to local DB
    let dbUser = JSON.parse(localStorage.getItem('db_' + user.phone)) || {courses:[]};
    if (window.FirebaseService && typeof window.FirebaseService.getUser === 'function') {
        const remoteUser = await window.FirebaseService.getUser(user.phone);
        if(remoteUser) dbUser = remoteUser;
    }
    
    if(!dbUser.courses) dbUser.courses = [];
    if(!dbUser.courses.includes(courseId)) {
        dbUser.courses.push(courseId);
        localStorage.setItem('db_' + user.phone, JSON.stringify(dbUser));
        
        if (window.FirebaseService && typeof window.FirebaseService.addCourseToStudent === 'function') {
            await window.FirebaseService.addCourseToStudent(user.phone, courseId);
        } else if (window.FirebaseService && typeof window.FirebaseService.updateStudentData === 'function') {
            await window.FirebaseService.updateStudentData(user.phone, { courses: dbUser.courses });
        }
    }
    
    if(window.showToast) window.showToast('مرحباً بك في الكورس المجاني!', 'success');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
};

// Global Countdown Timer for Discounts in course details
setInterval(() => {
    const countdowns = document.querySelectorAll('.discount-countdown');
    countdowns.forEach(el => {
        const expiryStr = el.getAttribute('data-expiry');
        if (!expiryStr) return;
        const expiry = parseInt(expiryStr);
        const remaining = expiry - Date.now();
        
        if (remaining <= 0) {
            el.innerHTML = 'انتهى الخصم';
            el.style.animation = 'none';
            el.style.opacity = '0.5';
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            let seconds = Math.floor(remaining / 1000);
            let d = Math.floor(seconds / (3600 * 24));
            let h = Math.floor((seconds % (3600 * 24)) / 3600);
            let m = Math.floor((seconds % 3600) / 60);
            let s = Math.floor(seconds % 60);
            
            let parts = [];
            if (d > 0) parts.push(`${d} يوم`);
            if (h > 0) parts.push(`${h} ساعة`);
            if (m > 0) parts.push(`${m} دقيقة`);
            parts.push(`${s} ثانية`);
            
            const timerSpan = el.querySelector('.cd-timer');
            if (timerSpan) {
                timerSpan.textContent = parts.join(' و ');
            }
        }
    });
}, 1000);
