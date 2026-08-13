const fs = require('fs');
let html = fs.readFileSync('admin-students.html', 'utf8');

const searchStr = "window.firebaseDb.collection('students').onSnapshot(snapshot => {";
const onSnapStart = html.indexOf(searchStr);

if (onSnapStart > -1) {
    // Find the end of the onSnapshot block. 
    // It ends with renderStudentsTable(); and then });
    const endStr = "renderStudentsTable();\n                });";
    const endIdx = html.indexOf(endStr, onSnapStart);
    
    if (endIdx > -1) {
        const replacement = `window.addEventListener('studentsChanged', (e) => {
                    const leanStudents = JSON.parse(localStorage.getItem('strictUsers') || '[]');
                    users = leanStudents;
                    renderStudentsTable();
                });
                if (window.FirebaseService && typeof window.FirebaseService.setupGlobalListeners === 'function') {
                    window.FirebaseService.setupGlobalListeners();
                }`;
        html = html.substring(0, onSnapStart) + replacement + html.substring(endIdx + endStr.length);
        fs.writeFileSync('admin-students.html', html);
        console.log('Fixed admin-students.html');
    } else {
        console.log('Could not find end of onSnapshot block');
    }
} else {
    console.log('Could not find onSnapshot start');
}
