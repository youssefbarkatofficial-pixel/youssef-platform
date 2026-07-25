const fs = require('fs');

const content = fs.readFileSync('game.html', 'utf8');

const targetStr = `  // خريطة ملخص مصغّرة\n  renderResultMap(result.territories);`;
const replacementStr = `  // Build Leaderboard HTML
  let allScores = {};
  allScores['player'] = { name: ui.playerData?.name || 'أنت', color: 'var(--player-color)', score: result.playerScore || 0, isPlayer: true };
  const s = GameEngine.getState();
  s.bots.forEach((b, idx) => {
    allScores['bot'+idx] = { name: b.name, color: b.color, score: result.botScores[idx] || 0, isPlayer: false };
  });

  const sortedScores = Object.values(allScores).sort((a,b)=> b.score - a.score);
  let lbHtml = '';
  sortedScores.forEach((entry, idx) => {
    const isWinner = idx === 0;
    const rankColor = idx === 0 ? '#FFD700' : (idx === 1 ? '#C0C0C0' : (idx === 2 ? '#CD7F32' : 'var(--text-muted)'));
    const isPlayerClass = entry.isPlayer ? 'background: rgba(212,175,55,0.15); border: 1px solid var(--gold);' : 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05);';
    const crown = isWinner ? '👑' : '';
    
    lbHtml += \`
      <div style="display:flex; align-items:center; gap:12px; padding: 12px; border-radius: 12px; \${isPlayerClass} margin-bottom: 8px;">
        <div style="font-weight:900; color:\${rankColor}; width:24px; text-align:center;">#\${idx+1}</div>
        <div style="width:12px; height:12px; border-radius:50%; background:\${entry.color}; box-shadow: 0 0 8px \${entry.color}"></div>
        <div style="flex:1; text-align:right; font-weight:700; color:var(--text-white);">\${entry.name} \${crown}</div>
        <div style="font-weight:900; color:var(--gold); font-size:1.1rem;">\${entry.score}</div>
      </div>
    \`;
  });
  document.getElementById('leaderboard-list').innerHTML = lbHtml;

  // خريطة ملخص مصغّرة
  renderResultMap(result.territories);`;

// Handle possible \r\n differences
const targetRegex = new RegExp('  // خريطة ملخص مصغّرة\\r?\\n  renderResultMap\\(result\\.territories\\);');

if (targetRegex.test(content)) {
  const newContent = content.replace(targetRegex, replacementStr);
  fs.writeFileSync('game.html', newContent, 'utf8');
  console.log('Successfully injected leaderboard logic!');
} else {
  console.error('Target string not found in game.html');
}
