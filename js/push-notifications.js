/**
 * Real FCM Web Push Notifications System (with Polling Fallback)
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Only run for logged-in students
    const userStr = sessionStorage.getItem('currentStudent');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
    if (user.role !== 'student') return;

    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
        return;
    }

    let fcmActive = false;

    // Ask for FCM Push if Firebase is ready
    async function setupFCM() {
        if (!firebase.messaging.isSupported()) {
            console.warn('FCM is not supported in this browser.');
            return false;
        }
        try {
            const messaging = firebase.messaging();
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const currentToken = await messaging.getToken({ vapidKey: 'YOUR_VAPID_KEY_HERE' }).catch(()=>null); // We need a real VAPID key in prod, but let's try without it if Firebase defaults it
                if (currentToken) {
                    console.log('FCM Token received.');
                    // Save to Firestore
                    if (window.FirebaseService && window.FirebaseService.updateStudentData) {
                        await window.FirebaseService.updateStudentData(user.phone, { fcmToken: currentToken });
                    }
                    
                    // Listen for foreground messages
                    messaging.onMessage((payload) => {
                        console.log('Foreground message received: ', payload);
                        const push = new Notification(payload.notification.title, {
                            body: payload.notification.body,
                            icon: payload.notification.icon || '/favicon.ico'
                        });
                        push.onclick = () => { window.focus(); push.close(); };
                    });
                    
                    return true;
                }
            }
        } catch(e) {
            console.warn('FCM Setup failed:', e);
        }
        return false;
    }

    if (Notification.permission === "default") {
        setTimeout(async () => {
            if (confirm("هل تسمح لنا بإرسال إشعارات لتبلغك بفتح الكورسات والرسائل المهمة؟")) {
                fcmActive = await setupFCM();
            }
        }, 5000);
    } else if (Notification.permission === "granted") {
        fcmActive = await setupFCM();
    }

    // Track notified IDs to avoid spamming
    const notifiedIds = new Set(JSON.parse(localStorage.getItem('notified_push_ids') || '[]'));

    // FALLBACK POLLING (Only if FCM failed to activate but Notification is somehow granted, e.g. Safari old)
    setInterval(() => {
        if (!fcmActive && Notification.permission === "granted") {
            const dbUser = JSON.parse(localStorage.getItem(db_ + user.phone) || '{}');
            const notifications = dbUser.notifications || [];
            
            notifications.forEach(n => {
                if (!n.read && !notifiedIds.has(n.notifId || n.id)) {
                    const push = new Notification("إشعار جديد", {
                        body: n.title + "\n" + (n.message || ""),
                        icon: "/favicon.ico",
                        dir: "rtl"
                    });
                    push.onclick = () => { window.focus(); push.close(); };
                    
                    notifiedIds.add(n.notifId || n.id);
                    localStorage.setItem('notified_push_ids', JSON.stringify(Array.from(notifiedIds)));
                }
            });
        }
    }, 10000);
});
