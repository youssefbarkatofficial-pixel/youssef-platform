const fs = require('fs');
let html = fs.readFileSync('admin-students.html', 'utf8');

const searchStr = "if (window.firebaseDb) {";
let onSnapStart = html.indexOf(searchStr);
// Ensure we find the block that logs '[ADMIN] fetching students'
let searchStart = onSnapStart;
while (onSnapStart > -1) {
    const nextText = html.substring(onSnapStart, onSnapStart + 100);
    if (nextText.includes('[ADMIN] fetching students')) break;
    onSnapStart = html.indexOf(searchStr, onSnapStart + 1);
}

if (onSnapStart > -1) {
    const endStr = "});\n            }";
    const endIdx = html.indexOf(endStr, onSnapStart);
    
    if (endIdx > -1) {
        const replacement = `window.addEventListener('studentsChanged', (e) => {
                const students = e.detail;
                users = students.map(data => {
                    if (!data.phone || data.phone === 'undefined' || String(data.phone).trim() === '') data.phone = data.email || 'بدون هاتف';
                    if (!data.name || data.name === 'undefined' || String(data.name).trim() === '') data.name = 'طالب مسجل بالإيميل';
                    
                    if (String(data.phone).includes('@') && !String(data.phone).includes('.')) {
                        let fixedPhone = String(data.phone);
                        if (fixedPhone.endsWith('com')) fixedPhone = fixedPhone.replace(/com$/, '.com');
                        else if (fixedPhone.endsWith('net')) fixedPhone = fixedPhone.replace(/net$/, '.net');
                        else if (fixedPhone.endsWith('org')) fixedPhone = fixedPhone.replace(/org$/, '.org');
                        else if (fixedPhone.endsWith('eg')) fixedPhone = fixedPhone.replace(/eg$/, '.eg');
                        
                        if (fixedPhone !== data.phone) {
                            data.phone = fixedPhone;
                            if (window.firebaseDb) {
                                try { window.firebaseDb.collection('students').doc(data._uid || data.phone).update({ phone: fixedPhone }); } catch(e){}
                            }
                        }
                    }
                    return data;
                }).filter(u => u.role !== 'admin');
                
                renderStudentsTable(document.getElementById('studentSearch')?.value || '');
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
