const fs = require('fs');
let c = fs.readFileSync('admin-dashboard.html', 'utf8');
const inject = `
    <script>
    // FORCE FIX FOR 01129649095
    document.addEventListener('DOMContentLoaded', async () => {
        if (localStorage.getItem('force_fix_01129649095_done')) return;
        setTimeout(async () => {
            try {
                if(!window.firebaseDb) return;
                console.log('Running force fix for Youssef...');
                const snap = await window.firebaseDb.collection('courses').where('grade', '==', 'الصف الثالث الإعدادي').get();
                if (!snap.empty) {
                    const courseId = snap.docs[0].id;
                    const courseName = snap.docs[0].data().title || 'الكورس';
                    
                    const updateCourseAndNotify = async (ref, userData) => {
                        const notifications = userData.notifications || [];
                        notifications.push({
                            id: 'n' + Date.now(),
                            title: 'تم قبول اشتراكك بنجاح 🎉',
                            message: \`تم تفعيل \${courseName} لك بنجاح. نتمنى لك التوفيق، يمكنك الآن بدء المذاكرة من قسم كورساتي.\`,
                            timestamp: new Date().toISOString(),
                            read: false,
                            courseId: courseId,
                            proofImageKey: null
                        });
                        await ref.update({ 
                            courses: firebase.firestore.FieldValue.arrayUnion(courseId),
                            notifications: notifications
                        });
                    };

                    const docRef = window.firebaseDb.collection('students').doc('01129649095');
                    const doc = await docRef.get();
                    if(doc.exists) {
                        await updateCourseAndNotify(docRef, doc.data());
                        localStorage.setItem('force_fix_01129649095_done', 'true');
                        if(window.showToast) window.showToast('تم إرجاع كورس 3 اعدادي ليوسف مصطفى بنجاح', 'success');
                    } else {
                        const snap2 = await window.firebaseDb.collection('students').where('phone', '==', '01129649095').limit(1).get();
                        if(!snap2.empty) {
                            await updateCourseAndNotify(snap2.docs[0].ref, snap2.docs[0].data());
                            localStorage.setItem('force_fix_01129649095_done', 'true');
                            if(window.showToast) window.showToast('تم إرجاع كورس 3 اعدادي ليوسف مصطفى بنجاح', 'success');
                        }
                    }
                }
            } catch(e) { console.error(e); }
        }, 5000);
    });
    </script>
`;
c = c.replace('</body>', inject + '</body>');
fs.writeFileSync('admin-dashboard.html', c);
console.log('Injected force fix in admin-dashboard.html');
