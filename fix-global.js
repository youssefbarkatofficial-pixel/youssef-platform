const fs = require('fs');
let c = fs.readFileSync('js/main.js', 'utf8');
const inject = `
    // Global Self-Healing for lost courses
    if (userStr) {
        try {
            let u = JSON.parse(userStr);
            if (u.notifications && Array.isArray(u.notifications) && window.firebaseDb) {
                let missingCourses = [];
                u.notifications.forEach(n => {
                    if (n.title && n.title.includes('تم قبول اشتراكك') && n.courseId) {
                        if (!u.courses) u.courses = [];
                        if (!u.courses.includes(n.courseId)) {
                            missingCourses.push(n.courseId);
                            u.courses.push(n.courseId);
                        }
                    }
                });
                if (missingCourses.length > 0) {
                    sessionStorage.setItem('currentStudent', JSON.stringify(u));
                    localStorage.setItem('currentStudent', JSON.stringify(u));
                    setTimeout(async () => {
                        try {
                            const docRef = window.firebaseDb.collection('students').doc(u.uid || u.phone);
                            for (const cid of missingCourses) {
                                await docRef.update({ courses: firebase.firestore.FieldValue.arrayUnion(cid) });
                            }
                            console.log('Self-healed missing courses:', missingCourses);
                            window.location.reload();
                        } catch(e) {}
                    }, 4000);
                }
            }
        } catch(e){}
    }
`;
c = c.replace(/\/\/ Fix specific student/, inject + '    // Fix specific student');
fs.writeFileSync('js/main.js', c);
console.log('Added global self-healing');
