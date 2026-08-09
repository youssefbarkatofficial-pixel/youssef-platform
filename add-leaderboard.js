const fs = require('fs');
let content = fs.readFileSync('dashboard.html', 'utf-8');

const leaderboardHTML = `
                <!-- Leaderboard Section (لوحة الشرف) -->
                <div class="glass-panel dash-panel" style="grid-column: 1 / -1; border-color: var(--royal-gold);">
                    <div class="panel-header">
                        <h2 class="panel-title"><i class="fas fa-trophy mr-2" style="color: var(--royal-gold);"></i> لوحة الشرف (أفضل الطلاب)</h2>
                    </div>
                    <div id="leaderboardContainer" style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 10px;">
                        <div style="text-align: center; width: 100%; padding: 20px;">
                            <i class="fas fa-spinner fa-spin" style="color: var(--royal-gold); font-size: 2rem;"></i>
                            <p style="margin-top: 10px; color: rgba(255,255,255,0.7);">جاري تحميل لوحة الشرف...</p>
                        </div>
                    </div>
                </div>
`;

if (!content.includes('leaderboardContainer')) {
    content = content.replace('<div class="dashboard-grid">', '<div class="dashboard-grid">' + leaderboardHTML);
    fs.writeFileSync('dashboard.html', content, 'utf-8');
    console.log("Leaderboard added to dashboard.html");
} else {
    console.log("Leaderboard already exists");
}
