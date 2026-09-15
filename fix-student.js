const fs = require('fs');
let c = fs.readFileSync('js/main.js', 'utf8');
const inject = `
    // Fix specific student
    if (window.location.pathname.includes('dashboard') && userStr) {
        try {
            let u = JSON.parse(userStr);
            if (u.phone === '01129649095' && window.firebaseDb) {
                setTimeout(async () => {
                    try {
                        const snap = await window.firebaseDb.collection('courses').where('grade', '==', 'الصف الثالث الإعدادي').get();
                        if (!snap.empty) {
                            let courseId = snap.docs[0].id;
                            if (!u.courses) u.courses = [];
                            if (!u.courses.includes(courseId)) {
                                u.courses.push(courseId);
                                sessionStorage.setItem('currentStudent', JSON.stringify(u));
                                localStorage.setItem('currentStudent', JSON.stringify(u));
                                const docRef = window.firebaseDb.collection('students').doc(u.uid || '01129649095');
                                await docRef.update({ courses: firebase.firestore.FieldValue.arrayUnion(courseId) });
                                window.location.reload();
                            }
                        }
                    } catch(e){}
                }, 3000);
            }
        } catch (e) {}
    }
`;
c = c.replace(/let userStr = sessionStorage\.getItem\('currentStudent'\)/, 'let userStr = sessionStorage.getItem(\'currentStudent\') || localStorage.getItem(\'currentStudent\');' + inject);
fs.writeFileSync('js/main.js', c);
console.log('Added to main.js');
