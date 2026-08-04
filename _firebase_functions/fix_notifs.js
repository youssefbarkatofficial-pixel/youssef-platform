const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixNotifications() {
    console.log("Starting notification fix...");
    const snapshot = await db.collection('students').get();
    let updatedCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        let changed = false;
        
        if (data.notifications && Array.isArray(data.notifications)) {
            const newNotifs = data.notifications.map(n => {
                if (n.title && n.title.includes('تعديل درجة')) {
                    changed = true;
                    let type = 'امتحان';
                    if (n.title.includes('تدريب')) type = 'تدريب';
                    if (n.title.includes('واجب')) type = 'واجب';
                    
                    return {
                        title: `تم إعادة تصحيح ${type}`,
                        message: n.body || n.message || `تم إعادة تصحيح ${type} الخاص بك وتعديل درجتك.`,
                        timestamp: n.ts || n.timestamp || Date.now(),
                        read: false,
                        link: 'exams.html'
                    };
                }
                return n;
            });

            if (changed) {
                await doc.ref.update({ notifications: newNotifs });
                updatedCount++;
                console.log(`Updated user ${doc.id}`);
            }
        }
    }
    console.log(`Done. Updated ${updatedCount} users.`);
}

fixNotifications().catch(console.error).finally(() => process.exit(0));
