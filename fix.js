const fs = require('fs');
let html = fs.readFileSync('admin-dashboard.html', 'utf8');

// Find the end of the good block
const calcStart = html.indexOf('calculateStats();');
// We added the listeners block right after calculateStats();
const listenersEnd = html.indexOf('            function calculateStats() {');
const endOfCalcBlock = html.indexOf('            calculateStats();', listenersEnd);

const corruptedStart = html.indexOf('                    } catch(e) { console.warn(\'Cache error:\', e); }');
const renderComplaints = html.indexOf('            function renderComplaints() {');

if (corruptedStart > -1 && renderComplaints > -1) {
    html = html.substring(0, endOfCalcBlock + 29) + '\n\n' + html.substring(renderComplaints);
    fs.writeFileSync('admin-dashboard.html', html);
    console.log('Fixed admin-dashboard.html');
} else {
    console.log('Could not find markers');
}
