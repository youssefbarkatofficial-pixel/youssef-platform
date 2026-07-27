/**
 * Local-first Web Push Notifications System
 * Prompts user for permission and displays native OS notifications for new unread messages.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Only run for logged-in students
    const userStr = sessionStorage.getItem('currentUser');
    if (!userStr) return;
    
    const user = JSON.parse(userStr);
    if (user.role !== 'student') return;

    // Check if browser supports notifications
    if (!("Notification" in window)) {
        console.warn("This browser does not support desktop notification");
        return;
    }

    // Request permission if not granted/denied yet
    if (Notification.permission === "default") {
        setTimeout(() => {
            if (confirm("هل ترغب في تفعيل الإشعارات لتصلك تنبيهات الكورسات الهامة حتى وأنت تتصفح نوافذ أخرى؟")) {
                Notification.requestPermission().then(permission => {
                    console.log("Notification permission:", permission);
                });
            }
        }, 5000); // Ask after 5 seconds
    }

    // Track notified IDs to avoid spamming
    const notifiedIds = new Set(JSON.parse(localStorage.getItem('notified_push_ids') || '[]'));

    // Check for new notifications periodically (since we don't have a background Service Worker for FCM)
    // The Firebase snapshot in firebase-service.js updates db_${phone} automatically when app is open.
    setInterval(() => {
        if (Notification.permission === "granted") {
            const dbUser = JSON.parse(localStorage.getItem(`db_${user.phone}`) || '{}');
            const notifications = dbUser.notifications || [];
            
            notifications.forEach(n => {
                // If it's not read, and we haven't already pushed it natively
                if (!n.read && !notifiedIds.has(n.notifId || n.id)) {
                    // Show OS notification
                    const push = new Notification("منصة يوسف بركات", {
                        body: n.title + "\n" + (n.message || ""),
                        icon: "https://via.placeholder.com/128/071326/D4A64F?text=Y",
                        dir: "rtl"
                    });
                    
                    push.onclick = () => {
                        window.focus();
                        push.close();
                    };
                    
                    // Mark as notified
                    notifiedIds.add(n.notifId || n.id);
                    localStorage.setItem('notified_push_ids', JSON.stringify(Array.from(notifiedIds)));
                }
            });
        }
    }, 10000); // Check every 10 seconds
});
