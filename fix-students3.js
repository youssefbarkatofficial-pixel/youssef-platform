const fs = require('fs');
let html = fs.readFileSync('admin-students.html', 'utf8');

const searchStr = "if (window.firebaseDb) {\n                console.log('[ADMIN] fetching students');";
let onSnapStart = html.indexOf(searchStr);

if (onSnapStart > -1) {
    const endStr = "function renderStudentsTable(filter = '') {";
    const nextFunc = html.indexOf(endStr, onSnapStart);
    
    if (nextFunc > -1) {
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
            }

            `;
        html = html.substring(0, onSnapStart) + replacement + html.substring(nextFunc);
        fs.writeFileSync('admin-students.html', html);
        console.log('Fixed admin-students.html');
    } else {
        console.log('Could not find next function');
    }
} else {
    console.log('Could not find onSnapshot start');
}
