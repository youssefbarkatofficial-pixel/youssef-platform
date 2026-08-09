const fs = require('fs');
let content = fs.readFileSync('js/dashboard.js', 'utf-8');

const leaderboardLogic = `
// --- LEADERBOARD LOGIC ---
async function loadLeaderboard(currentGrade) {
    const container = document.getElementById('leaderboardContainer');
    if (!container) return;

    try {
        let students = [];
        if (window.FirebaseService && typeof window.FirebaseService.getStudents === 'function') {
            students = await window.FirebaseService.getStudents();
        } else {
            students = JSON.parse(localStorage.getItem('strictUsers') || '[]');
        }

        // Filter by grade
        const sameGrade = students.filter(s => {
            const sGrade = (window.getEffectiveStudentGrade && window.getGradeLabel) 
                ? window.getGradeLabel(window.getEffectiveStudentGrade(s)) 
                : (s.grade || '');
            return sGrade === currentGrade && s.role !== 'admin';
        });

        // Calculate score
        sameGrade.forEach(s => {
            let score = 0;
            if (s.stats) {
                score += (s.stats.homeworkCompleted || 0) * 10;
                score += (s.stats.videosWatched || 0) * 5;
                score += (s.stats.commitment || 0);
            }
            s._leaderboardScore = score;
        });

        // Sort descending
        sameGrade.sort((a, b) => b._leaderboardScore - a._leaderboardScore);
        
        // Take top 5
        const topStudents = sameGrade.slice(0, 5);

        if (topStudents.length === 0) {
            container.innerHTML = '<div style="text-align: center; width: 100%; padding: 20px; color: #94A3B8;">لا يوجد طلاب في لوحة الشرف بعد</div>';
            return;
        }

        let html = '';
        topStudents.forEach((student, index) => {
            let rankIcon = index === 0 ? '<i class="fas fa-crown" style="color: gold; font-size: 1.5rem; margin-bottom: 5px;"></i>' :
                           index === 1 ? '<i class="fas fa-medal" style="color: silver; font-size: 1.2rem; margin-bottom: 5px;"></i>' :
                           index === 2 ? '<i class="fas fa-medal" style="color: #cd7f32; font-size: 1.2rem; margin-bottom: 5px;"></i>' :
                           '<div style="font-weight: bold; font-size: 1.2rem; margin-bottom: 5px; color: #94A3B8;">#' + (index + 1) + '</div>';
            
            const avatar = student.profilePic || 'https://via.placeholder.com/80/071326/D4A64F?text=' + (student.name ? student.name.charAt(0) : '?');

            html += \`
                <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(212,175,55,0.3); border-radius: 15px; padding: 15px; min-width: 120px; text-align: center; display: flex; flex-direction: column; align-items: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    \${rankIcon}
                    <img src="\${avatar}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid var(--royal-gold);">
                    <div style="font-weight: bold; font-size: 0.9rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">\${student.name || 'طالب مجهول'}</div>
                    <div style="font-size: 0.8rem; color: var(--accent-cyan); margin-top: 5px;">\${student._leaderboardScore} نقطة</div>
                </div>
            \`;
        });

        container.innerHTML = html;

    } catch(err) {
        console.error('Error loading leaderboard:', err);
        container.innerHTML = '<div style="text-align: center; width: 100%; padding: 20px; color: #ef4444;">حدث خطأ في تحميل لوحة الشرف</div>';
    }
}
`;

if (!content.includes('loadLeaderboard')) {
    content += '\n' + leaderboardLogic;
    
    // Inject the call inside DOMContentLoaded
    const targetCall = "userGradeEl.textContent = effectiveGrade || 'طالب';";
    if (content.includes(targetCall)) {
        content = content.replace(targetCall, targetCall + '\n\n      // Load Leaderboard\n      loadLeaderboard(effectiveGrade || user.grade);');
    }
    
    fs.writeFileSync('js/dashboard.js', content, 'utf-8');
    console.log('Leaderboard injected to dashboard.js');
} else {
    console.log('Leaderboard already injected');
}
