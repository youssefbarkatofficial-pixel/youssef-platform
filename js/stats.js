document.addEventListener('DOMContentLoaded', async () => {
    const userStr = sessionStorage.getItem('currentStudent');
    if (!userStr) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(userStr);
    
    // UI Elements
    const userNameEl = document.getElementById('userNameDisplay');
    const userGradeEl = document.getElementById('userGradeDisplay');
    const userCodeEl = document.getElementById('userCodeDisplay');
    const avatarImg = document.getElementById('userAvatarImg');
    
    if (userNameEl) userNameEl.textContent = user.name;
    if (userCodeEl && user.studentCode) userCodeEl.textContent = user.studentCode;
    
    if (userGradeEl) {
        const effectiveGrade = (window.getEffectiveStudentGrade && window.getGradeLabel)
            ? window.getGradeLabel(window.getEffectiveStudentGrade(user))
            : (user.grade || 'طالب');
        userGradeEl.textContent = effectiveGrade || 'طالب';
    }

    let profilePic = localStorage.getItem(`profilePic_${user.phone}`);
    if (profilePic && avatarImg) {
        avatarImg.src = profilePic;
    }

    // Load Data
    let dbUser = JSON.parse(localStorage.getItem(`db_${user.phone}`)) || {};
    let adminCourses = JSON.parse(localStorage.getItem('adminCourses')) || [];

    // Calculate Real Stats
    let totalVideosWatched = 0;
    let totalExamsCompleted = 0;
    let sumExamScores = 0;
    let examsCountForAvg = 0;
    
    const historyItems = []; // { title, type, date, score, courseName }

    // 1. Process Exams
    if (dbUser.examResults) {
        // Group by exam to get best/official score for average
        const uniqueExams = {};
        dbUser.examResults.forEach(r => {
            const key = `${r.courseId}_${r.examTitle}`;
            if (!uniqueExams[key]) {
                uniqueExams[key] = [];
            }
            uniqueExams[key].push(r);
            
            // Add to history
            historyItems.push({
                title: r.examTitle,
                type: 'exam',
                date: new Date(r.date).getTime(),
                dateStr: new Date(r.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                score: r.effectivePercent || r.percent,
                courseName: r.courseName || 'كورس'
            });
        });

        Object.values(uniqueExams).forEach(results => {
            const official = results.find(r => r.isOfficial || r.attemptNumber === 1) || results[0];
            totalExamsCompleted++;
            sumExamScores += (official.effectivePercent || official.percent);
            examsCountForAvg++;
        });
    }

    // 2. Process Videos from Progress
    if (dbUser.progress) {
        Object.keys(dbUser.progress).forEach(courseId => {
            const course = adminCourses.find(c => c.id == courseId);
            const done = dbUser.progress[courseId].done || [];
            
            if (course && course.sections) {
                course.sections.forEach(sec => {
                    if (sec.items) {
                        sec.items.forEach(item => {
                            if (done.includes(item.id) && item.type === 'video') {
                                totalVideosWatched++;
                                historyItems.push({
                                    title: item.title,
                                    type: 'video',
                                    date: dbUser.progress[courseId].lastWatchTime || Date.now(), // Fallback
                                    dateStr: 'مكتملة',
                                    courseName: course.title
                                });
                            }
                        });
                    }
                });
            }
        });
    }

    // Sort history (newest first)
    historyItems.sort((a, b) => b.date - a.date);

    // Update DOM Stats
    document.getElementById('sVideosCount').textContent = totalVideosWatched;
    document.getElementById('sHwCount').textContent = totalExamsCompleted;
    
    let avg = examsCountForAvg > 0 ? Math.round(sumExamScores / examsCountForAvg) : 0;
    document.getElementById('sExamAvg').textContent = `${avg}%`;

    // Render History
    const historyList = document.getElementById('watchHistoryList');
    if (historyList) {
        if (historyItems.length === 0) {
            historyList.innerHTML = '<div style="text-align:center; padding: 20px; color: rgba(255,255,255,0.5);">لا توجد نشاطات مسجلة حتى الآن</div>';
        } else {
            historyList.innerHTML = historyItems.map(item => `
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 12px 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;">
                            <i class="fas ${item.type === 'video' ? 'fa-video text-cyan' : 'fa-clipboard-check text-gold'}" style="font-size: 1.2rem;"></i>
                        </div>
                        <div>
                            <div style="color: var(--text-primary); font-weight: bold;">${item.title}</div>
                            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.5);">${item.courseName} - ${item.dateStr !== 'مكتملة' ? item.dateStr : 'تم مشاهدة المحاضرة بنجاح'}</div>
                        </div>
                    </div>
                    ${item.type === 'exam' ? `<div style="background: rgba(46, 204, 113, 0.1); color: #2ecc71; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.9rem;">${item.score}%</div>` : `<div style="background: rgba(52, 152, 219, 0.1); color: #3498db; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.9rem;">مكتمل <i class="fas fa-check"></i></div>`}
                </div>
            `).join('');
        }
    }

    // Display / Hide empty state
    if (totalVideosWatched === 0 && totalExamsCompleted === 0) {
        document.getElementById('statsContent').style.display = 'none';
        document.getElementById('noStatsState').style.display = 'block';
    } else {
        document.getElementById('statsContent').style.display = 'block';
        document.getElementById('noStatsState').style.display = 'none';
    }

    // Chart Render
    const ctx = document.getElementById('progressChart');
    if (ctx) {
        let gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(212, 166, 79, 0.5)');
        gradient.addColorStop(1, 'rgba(212, 166, 79, 0)');
        
        // Generate pseudo-data based on total progress for visual feedback (since we don't track per-week yet)
        const weeklyData = [
            Math.floor(totalVideosWatched * 0.1),
            Math.floor(totalVideosWatched * 0.3),
            Math.floor(totalVideosWatched * 0.5),
            Math.floor(totalVideosWatched * 0.7),
            Math.floor(totalVideosWatched * 0.9),
            totalVideosWatched
        ];

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4', 'الأسبوع 5', 'الأسبوع 6'],
                datasets: [{
                    label: 'التقدم (محاضرات)',
                    data: weeklyData,
                    borderColor: '#D4A64F', backgroundColor: gradient, borderWidth: 2,
                    pointBackgroundColor: '#fff', pointBorderColor: '#D4A64F', pointRadius: 4, fill: true, tension: 0.4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', stepSize: 1 } },
                    x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } }
                }
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            sessionStorage.removeItem('currentStudent');
            window.location.href = 'index.html';
        });
    }
});
