const fs = require('fs');
let html = fs.readFileSync('admin-courses.html', 'utf8');

const dumpScript = `
// --- ONE-TIME DATA RESCUE SCRIPT ---
(async function rescueV2Items() {
    try {
        let courses = getAdminCoursesArray();
        let changed = false;
        courses.forEach(c => {
            if (c.contents && c.contents.sections && Array.isArray(c.contents.sections)) {
                const map = {'sec_lectures': 'lectures', 'sec_homeworks': 'homeworks', 'sec_exams': 'exams', 'sec_trainings': 'trainings'};
                c.contents.sections.forEach(sec => {
                    if (map[sec.id] && sec.items && sec.items.length > 0) {
                        let legacyKey = map[sec.id];
                        if (!c.contents[legacyKey]) c.contents[legacyKey] = [];
                        sec.items.forEach(item => {
                            if (!c.contents[legacyKey].find(i => i.id === item.id)) {
                                c.contents[legacyKey].push(item);
                                changed = true;
                            }
                        });
                        sec.items = [];
                    }
                });
            }
        });
        if (changed) {
            saveAdminCoursesArray(courses);
            if (window.FirebaseService && typeof window.FirebaseService.saveCourse === 'function') {
                for(let c of courses) await window.FirebaseService.saveCourse(c);
            }
            console.log("Rescued V2 items back to legacy arrays.");
            if(window.renderFlatContents) window.renderFlatContents();
        }
    } catch(e) { console.error('Rescue error', e); }
})();
// -----------------------------------
`;

if(!html.includes('rescueV2Items')) {
    html = html.replace('window.renderFlatContents = function() {', dumpScript + '\nwindow.renderFlatContents = function() {');
    fs.writeFileSync('admin-courses.html', html);
    console.log("Injected rescue script successfully");
} else {
    console.log("Already injected");
}
