/**
 * ==========================================
 * Firebase Service Layer - يوسف بركات منصة
 * ==========================================
 * يستخدم Firestore كمصدر أساسي للبيانات مع
 * localStorage كـ cache محلي للسرعة
 */

window.FirebaseService = (function () {

    // --- Realtime Listeners ---
    let coursesListenerUnsubscribe = null;
    let paymentRequestsListenerUnsubscribe = null;
    let studentListeners = {};

    // --- Helpers ---
    function getDb() { return window.firebaseDb || null; }
    function getAuth() { return window.firebaseAuth || null; }

    function isFirebaseReady() {
        try {
            return !!(getDb() && getAuth() && window.firebase);
        } catch (e) { return false; }
    }

    // --- Safe localStorage helpers (handle quota exceeded) ---
    function safeStorageSaveCourses(courses) {
        var lightCourses = courses.map(function(c) {
            var light = Object.assign({}, c);
            if (light.image && light.image.startsWith('data:')) {
                try { localStorage.setItem('img_' + light.id, light.image); } catch(e) {}
                light.image = '__local__' + light.id;
            }
            return light;
        });
        try {
            localStorage.setItem('adminCourses', JSON.stringify(lightCourses));
        } catch(e) {
            // Fallback: save without contents
            var minimal = lightCourses.map(function(c) {
                return { id: c.id, title: c.title, price: c.price, desc: c.desc,
                         grade: c.grade, image: c.image, hidden: c.hidden, finished: c.finished,
                         contents: { lectures: [], homeworks: [], exams: [], trainings: [], customSections: [] } };
            });
            try {
                localStorage.setItem('adminCourses', JSON.stringify(minimal));
                courses.forEach(function(c) {
                    try { localStorage.setItem('contents_' + c.id, JSON.stringify(c.contents || {})); } catch(e2) {}
                });
            } catch(e3) { console.error('Cannot save courses to localStorage', e3); }
        }
    }

    function getCoursesFromStorage() {
        var raw = JSON.parse(localStorage.getItem('adminCourses') || '[]');
        return raw.map(function(c) {
            if (c.image && c.image.startsWith('__local__')) {
                var img = localStorage.getItem('img_' + c.id);
                c.image = img || 'https://via.placeholder.com/400x250/071326/D4A64F?text=Course';
            }
            if (!c.contents || (!c.contents.lectures && !c.contents.homeworks)) {
                var stored = localStorage.getItem('contents_' + c.id);
                if (stored) { try { c.contents = JSON.parse(stored); } catch(e) {} }
            }
            return c;
        });
    }

    // ============================================================
    // AUTH - تسجيل الدخول وإنشاء الحسابات
    // ============================================================

    /**
     * تسجيل طالب جديد — Firebase Auth + Firestore
     */
    function cacheStudentData(phone, data) {
        try {
            localStorage.setItem(`db_${phone}`, JSON.stringify(data));
            let users = JSON.parse(localStorage.getItem('strictUsers') || '[]');
            const idx = users.findIndex(u => u.phone === phone);
            if (idx > -1) users[idx] = { ...users[idx], ...data };
            else users.push(data);
            localStorage.setItem('strictUsers', JSON.stringify(users));
        } catch(e) {
            console.warn('Local cache full or disabled', e);
        }
    }

    async function saveStudentProfile(user, extraData) {
        try {
            await getDb().collection('students').doc(user.uid).set({
                uid: user.uid,
                email: user.email,
                ...extraData,
                role: 'student',
                createdAt: new Date().toISOString()
            }, { merge: true });
            return true;
        } catch(error) {
            console.error(
                '[FIRESTORE SAVE ERROR]',
                error.code,
                error.message,
                error
            );
            return false;
        }
    }

    async function registerStudent(userData, password) {
        if (!isFirebaseReady()) throw new Error("Firebase is not ready");
        try {
            await getAuth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            const userCredential = await getAuth().createUserWithEmailAndPassword(userData.email, password || userData.password);
            const user = userCredential.user;
            
            const extraData = {
                name: userData.name,
                phone: userData.phone,
                grade: userData.grade,
                courses: [],
                notifications: []
            };
            
            const saved = await saveStudentProfile(user, extraData);
            console.log('SAVE RESULT:', saved);

            if (!saved) {
                try {
                    await user.delete();
                } catch(e) {}
                throw new Error('فشل حفظ بيانات الطالب على السحابة');
            }

            // Verify document exists
            const verifyDoc = await getDb()
                .collection('students')
                .doc(user.uid)
                .get();

            console.log('VERIFY EXISTS:', verifyDoc.exists);

            if (!verifyDoc.exists) {
                try {
                    await user.delete();
                } catch(e) {}
                throw new Error('Student profile verification failed');
            }
            
            const fullData = {
                uid: user.uid,
                email: user.email,
                ...extraData,
                role: 'student',
                createdAt: new Date().toISOString()
            };
            
            cacheStudentData(userData.phone, fullData);
            return fullData;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    /**
     * تسجيل الدخول
     */
    async function loginStudent(phone, password) {
        if (!isFirebaseReady()) throw new Error('Firebase not ready');
        await getAuth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        const email = `${phone}@student.youssefbarakat.com`;

        // Check if email exists in Firebase Auth to give a helpful "user not found" error
        try {
            const methods = await getAuth().fetchSignInMethodsForEmail(email);
            if (methods.length === 0) {
                const userError = new Error('هذا الحساب غير مسجل على المنصة، اضغط إنشاء حساب جديد للدخول');
                userError.code = 'custom/user-not-found';
                throw userError;
            }
        } catch(e) {
            if (e.code === 'custom/user-not-found') throw e;
            // Ignore if fetchSignInMethodsForEmail fails and let it proceed
        }

        // Check if student actually exists in Firestore first to give a helpful error
        try {
            const querySnapshot = await getDb().collection('students').where('phone', '==', phone).limit(1).get();
            if (querySnapshot.empty) {
                const userError = new Error('هذا الحساب غير مسجل على المنصة، اضغط إنشاء حساب جديد للدخول');
                userError.code = 'custom/user-not-found';
                throw userError;
            }
        } catch(e) {
            if(e.code === 'custom/user-not-found') throw e;
            // Ignore other firestore errors and let auth try
        }

        const userCredential = await getAuth().signInWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        let doc = null;
        try {
            doc = await getDb().collection('students').doc(uid).get();
        } catch(e) {
            console.warn('Failed to fetch student document', e);
        }

        let userData;
        if (!doc || !doc.exists) {
            console.warn('[LOGIN] Student document missing, this account was deleted by admin.');
            // Sign them out of Firebase Auth
            try { await getAuth().signOut(); } catch(e) {}
            // Optionally try to delete their Firebase Auth account since their data is gone
            try { await userCredential.user.delete(); } catch(e) {}
            
            throw new Error('تم مسح هذا الحساب نهائياً من قبل الإدارة. يرجى إنشاء حساب جديد.');
        } else {
            userData = doc.data();
        }

        cacheStudentData(phone, userData);
        return userData;
    }

    /**
     * جلب بيانات طالب عن طريق رقم الموبايل
     */
    async function getStudentByPhone(phone) {
        if (!isFirebaseReady()) return null;
        try {
            const snap = await getDb().collection('students')
                .where('phone', '==', phone).limit(1).get();
            if (snap.empty) return null;
            const data = snap.docs[0].data();
            cacheStudentData(phone, data);
            return data;
        } catch (e) {
            console.warn('getStudentByPhone failed', e);
            return null;
        }
    }

    // ============================================================
    // COURSES - الكورسات
    // ============================================================

    /**
     * جلب كل الكورسات
     */
    async function getCourses() {
        if (!isFirebaseReady()) {
            return getCoursesFromStorage();
        }
        
        function stripContentsIfNotAdmin(coursesArr) {
            const adminStr = sessionStorage.getItem('currentAdmin');
            let isAdmin = false;
            if(adminStr) {
                try { if(JSON.parse(adminStr).role === 'admin') isAdmin = true; } catch(e){}
            }
            if(!isAdmin) {
                return coursesArr.map(c => {
                    const { contents, ...rest } = c;
                    return rest;
                });
            }
            return coursesArr;
        }

        try {
            if (!coursesListenerUnsubscribe) {
                coursesListenerUnsubscribe = getDb().collection('courses').onSnapshot(snap => {
                    let courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    courses = stripContentsIfNotAdmin(courses);
                    safeStorageSaveCourses(courses);
                }, err => console.warn('Courses listener error', err));
            }

            const snap = await getDb().collection('courses').get();
            let serverCourses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Check if server is empty but local has courses (prevent wiping unsynced data)
            const localCourses = getCoursesFromStorage();
            if (serverCourses.length === 0 && localCourses.length > 0) {
                console.warn('Firestore has no courses, but local has data. Syncing local to Firestore...');
                for (let c of localCourses) {
                    await saveCourse(c);
                }
                return stripContentsIfNotAdmin(localCourses);
            }

            serverCourses = stripContentsIfNotAdmin(serverCourses);
            safeStorageSaveCourses(serverCourses);
            return serverCourses;
        } catch (e) {
            console.warn('getCourses Firestore failed, using cache', e);
            return getCoursesFromStorage();
        }
    }

    /**
     * حفظ / تعديل كورس
     */
    async function saveCourse(course) {
        const id = course.id || ('c' + Date.now());
        const data = { ...course, id };

        // local cache first (for speed) — using safe save to avoid quota errors
        let courses = getCoursesFromStorage();
        const idx = courses.findIndex(c => c.id === id);
        if (idx > -1) courses[idx] = data; else courses.push(data);
        safeStorageSaveCourses(courses);

        if (!isFirebaseReady()) throw new Error("Firebase is not ready. Course saved locally but not to cloud.");
        try {
            await getDb().collection('courses').doc(id).set(data, { merge: true });
        } catch (e) { 
            console.error('saveCourse Firestore failed', e);
            throw e;
        }
        return data;
    }

    /**
     * حذف كورس
     */
    async function deleteCourse(id) {
        let courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
        courses = courses.filter(c => c.id !== id);
        localStorage.setItem('adminCourses', JSON.stringify(courses));

        if (!isFirebaseReady()) throw new Error("Firebase is not ready. Course deleted locally but not from cloud.");
        try {
            await getDb().collection('courses').doc(id).delete();
        } catch (e) { 
            console.error('deleteCourse Firestore failed', e);
            throw e;
        }
    }

    // ============================================================
    // STUDENT DATA - بيانات الطلاب (كورسات، إشعارات)
    // ============================================================

    /**
     * جلب بيانات الطالب من Firestore
     */
    async function getStudentData(phone) {
        const cached = JSON.parse(localStorage.getItem(`db_${phone}`) || 'null');
        if (!isFirebaseReady()) return cached || { courses: [], notifications: [] };
        try {
            if (!studentListeners[phone]) {
                studentListeners[phone] = getDb().collection('students')
                    .where('phone', '==', phone).limit(1)
                    .onSnapshot(snap => {
                        if (!snap.empty) {
                            const data = snap.docs[0].data();
                            cacheStudentData(phone, data);
                        }
                    }, err => console.warn('Student listener error', err));
            }

            const snap = await getDb().collection('students')
                .where('phone', '==', phone).limit(1).get();
            if (snap.empty) return cached || { courses: [], notifications: [] };
            const data = snap.docs[0].data();
            cacheStudentData(phone, data);
            return data;
        } catch (e) {
            console.warn('getStudentData failed', e);
            return cached || { courses: [], notifications: [] };
        }
    }

    /**
     * تحديث بيانات الطالب
     */
    async function updateStudentData(phone, updates) {
        let cached = JSON.parse(localStorage.getItem(`db_${phone}`) || '{}');
        cached = { ...cached, ...updates };
        cacheStudentData(phone, cached);

        if (!isFirebaseReady()) return cached;
        try {
            const snap = await getDb().collection('students')
                .where('phone', '==', phone).limit(1).get();
            if (!snap.empty) {
                await snap.docs[0].ref.update(updates);
            }
        } catch (e) { console.warn('updateStudentData failed', e); }
        return cached;
    }

    /**
     * إضافة كورس للطالب بعد قبول الدفع
     */
    async function addCourseToStudent(phone, courseId) {
        const data = await getStudentData(phone);
        const courses = data.courses || [];
        if (!courses.includes(courseId)) courses.push(courseId);
        return await updateStudentData(phone, { courses });
    }

    /**
     * إضافة إشعار للطالب
     */
    async function addNotificationToStudent(phone, notification) {
        const data = await getStudentData(phone);
        const notifications = data.notifications || [];
        notifications.push({
            ...notification,
            id: 'n' + Date.now(),
            read: false,
            timestamp: new Date().toISOString()
        });
        return await updateStudentData(phone, { notifications });
    }

    // ============================================================
    // PAYMENT REQUESTS - طلبات الدفع
    // ============================================================

    /**
     * إضافة طلب دفع جديد
     */
    async function addPaymentRequest(data) {
        const payload = {
            ...data,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        if (!isFirebaseReady()) {
            let reqs = JSON.parse(localStorage.getItem('paymentRequests') || '[]');
            reqs.push({ id: 'local_' + Date.now(), ...payload });
            localStorage.setItem('paymentRequests', JSON.stringify(reqs));
            return { success: false, error: new Error("لا يوجد اتصال بخوادم المنصة. تم الحفظ محليا.") };
        }

        try {
            const docRef = await getDb()
                .collection('paymentRequests')
                .add(payload);

            console.log('[PAYMENT REQUEST SAVED]', docRef.id);

            // Cache locally
            let reqs = JSON.parse(localStorage.getItem('paymentRequests') || '[]');
            reqs.push({ id: docRef.id, ...payload });
            localStorage.setItem('paymentRequests', JSON.stringify(reqs));

            return {
                success: true,
                id: docRef.id
            };
        } catch(error) {
            console.error(
                '[PAYMENT REQUEST ERROR]',
                error
            );

            let reqs = JSON.parse(localStorage.getItem('paymentRequests') || '[]');
            reqs.push({ id: 'local_' + Date.now(), ...payload });
            localStorage.setItem('paymentRequests', JSON.stringify(reqs));

            return {
                success: false,
                error
            };
        }
    }

    /**
     * جلب كل طلبات الدفع (للأدمن)
     */
    async function getPaymentRequests() {
        let reqs = JSON.parse(localStorage.getItem('paymentRequests') || '[]');
        if (!isFirebaseReady()) return reqs;

        try {
            if (!paymentRequestsListenerUnsubscribe) {
                paymentRequestsListenerUnsubscribe = getDb().collection('paymentRequests')
                    .orderBy('createdAt', 'desc')
                    .onSnapshot(snap => {
                        let latestReqs = [];
                        snap.forEach(doc => {
                            latestReqs.push({ id: doc.id, ...doc.data() });
                        });
                        localStorage.setItem('paymentRequests', JSON.stringify(latestReqs));
                    }, err => console.warn('Payment reqs listener error', err));
            }

            const snap = await getDb().collection('paymentRequests')
                .orderBy('createdAt', 'desc')
                .get();
            reqs = [];
            snap.forEach(doc => {
                reqs.push({ id: doc.id, ...doc.data() });
            });
            localStorage.setItem('paymentRequests', JSON.stringify(reqs));
            return reqs;
        } catch(e) {
            console.warn('getPaymentRequests failed', e);
            return reqs;
        }
    }

    /**
     * تحديث حالة طلب الدفع (قبول/رفض)
     */
    async function updatePaymentStatus(id, status) {
        // local cache
        let reqs = JSON.parse(localStorage.getItem('paymentRequests') || '[]');
        const idx = reqs.findIndex(r => r.id === id);
        if (idx > -1) reqs[idx].status = status;
        localStorage.setItem('paymentRequests', JSON.stringify(reqs));

        if (!isFirebaseReady()) return;
        try {
            await getDb().collection('paymentRequests').doc(id).update({ status });
        } catch (e) { console.warn('updatePaymentStatus failed', e); }
    }

    // ============================================================
    // SETTINGS - إعدادات المنصة
    // ============================================================

    async function saveSettings(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        if (!isFirebaseReady()) return;
        try {
            await getDb().collection('settings').doc(key).set(data, { merge: true });
        } catch (e) { console.warn('saveSettings failed', e); }
    }

    async function getSettings(key) {
        if (!isFirebaseReady()) {
            return JSON.parse(localStorage.getItem(key) || 'null');
        }
        try {
            const doc = await getDb().collection('settings').doc(key).get();
            if (doc.exists) {
                const data = doc.data();
                localStorage.setItem(key, JSON.stringify(data));
                return data;
            }
        } catch (e) { console.warn('getSettings failed', e); }
        return JSON.parse(localStorage.getItem(key) || 'null');
    }

    // ============================================================
    // SYNC - مزامنة البيانات المحلية لـ Firestore (للرفع الأول)
    // ============================================================

    /**
     * رفع كل البيانات المحلية لـ Firestore مرة واحدة
     * استخدمها مرة واحدة بس من console الأدمن
     */
    async function syncLocalToFirestore() {
        if (!isFirebaseReady()) {
            console.error('Firebase not ready for sync');
            return;
        }
        console.log('🚀 بدء مزامنة البيانات المحلية لـ Firestore...');

        // Sync Courses
        const courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
        for (const course of courses) {
            try {
                await getDb().collection('courses').doc(course.id).set(course, { merge: true });
                console.log('✅ كورس:', course.title);
            } catch (e) { console.warn('❌ فشل كورس:', course.id, e); }
        }

        // Sync Students
        const users = JSON.parse(localStorage.getItem('strictUsers') || '[]');
        for (const u of users) {
            try {
                const uidFallback = u.uid || 'sync_' + u.phone;
                const userDataToSync = {
                    ...u,
                    plainPassword: u.password || 'غير معروف',
                    role: 'student'
                };
                await getDb().collection('students').doc(uidFallback).set(userDataToSync, { merge: true });
                console.log('✅ طالب:', u.name);
            } catch (e) { console.warn('❌ فشل طالب:', u.phone, e); }
        }

        // Sync Payment Requests
        const payReqs = JSON.parse(localStorage.getItem('paymentRequests') || '[]');
        for (const req of payReqs) {
            try {
                await getDb().collection('paymentRequests').doc(req.id).set(req, { merge: true });
                console.log('✅ طلب دفع:', req.id);
            } catch (e) { console.warn('❌ فشل طلب دفع:', req.id, e); }
        }

        // Sync Settings
        const paySettings = JSON.parse(localStorage.getItem('paymentSettings') || 'null');
        if (paySettings) {
            try {
                await getDb().collection('settings').doc('paymentSettings').set(paySettings);
                console.log('✅ إعدادات الدفع');
            } catch (e) { console.warn('❌ فشل إعدادات الدفع', e); }
        }

        const genSettings = JSON.parse(localStorage.getItem('generalSettings') || 'null');
        if (genSettings) {
            try {
                await getDb().collection('settings').doc('generalSettings').set(genSettings);
                console.log('✅ الإعدادات العامة');
            } catch (e) { console.warn('❌ فشل الإعدادات العامة', e); }
        }

        console.log('✅ انتهت المزامنة!');
    }

    // Aliases used by pages (getUser, getCourse)
    async function getUser(phone) {
        return getStudentByPhone(phone);
    }

    async function getCourse(courseId) {
        // Try Firebase first
        if (isFirebaseReady()) {
            try {
                const doc = await getDb().collection('courses').doc(courseId).get();
                if (doc.exists) return { id: doc.id, ...doc.data() };
            } catch (e) { console.warn('getCourse Firebase failed', e); }
        }
        // Fallback to local cache
        const courses = getCoursesFromStorage();
        return courses.find(c => c.id === courseId) || null;
    }

    // Public API
    return {
        isReady: isFirebaseReady,
        registerStudent,
        loginStudent,
        getStudentByPhone,
        getUser,
        getCourse,
        getCourses,
        saveCourse,
        deleteCourse,
        getStudentData,
        updateStudentData,
        addCourseToStudent,
        addNotificationToStudent,
        addPaymentRequest,
        getPaymentRequests,
        updatePaymentStatus,
        saveSettings,
        getSettings,
        syncLocalToFirestore,
        getCachedCourses: getCoursesFromStorage
    };

})();


// Make safe storage helpers globally available for all pages
window.getCoursesFromStorage = function() {
    var raw = JSON.parse(localStorage.getItem('adminCourses') || '[]');
    return raw.map(function(c) {
        if (c.image && c.image.startsWith('__local__')) {
            var img = localStorage.getItem('img_' + c.id);
            c.image = img || 'https://via.placeholder.com/400x250/071326/D4A64F?text=Course';
        }
        if (!c.contents || (!c.contents.lectures && !c.contents.homeworks)) {
            var stored = localStorage.getItem('contents_' + c.id);
            if (stored) { try { c.contents = JSON.parse(stored); } catch(e) {} }
        }
        return c;
    });
};

console.log('🔥 FirebaseService loaded');

// ============================================================
// ANTI-COPY & SECURITY PROTECTION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    let isAdmin = false;
    try {
        const adminStr = sessionStorage.getItem('currentAdmin');
        if (adminStr && JSON.parse(adminStr).role === 'admin') {
            isAdmin = true;
        }
    } catch (e) {}

    // Apply strict protections if NOT admin
    if (!isAdmin) {
        // Prevent context menu (right click)
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        // Prevent copy event
        document.addEventListener('copy', e => {
            e.preventDefault();
            if(window.showToast) window.showToast('عفواً، النسخ غير مسموح به في هذه المنصة', 'error');
        });
        
        // Prevent selection via keyboard shortcuts (Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+P)
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'a' || e.key === 'A' || e.key === 'x' || e.key === 'X' || e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
            }
        });

        // Add CSS to disable selection globally
        const style = document.createElement('style');
        style.textContent = `
            * {
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
            }
            input, textarea {
                -webkit-user-select: auto !important;
                -moz-user-select: auto !important;
                -ms-user-select: auto !important;
                user-select: auto !important;
            }
        `;
        document.head.appendChild(style);
        
        // Global Encoded ID (Anti-Piracy)
        try {
            const studentStr = sessionStorage.getItem('currentUser');
            if (studentStr) {
                const student = JSON.parse(studentStr);
                if (student && student.phone) {
                    const rawString = `${student.name || 'Student'}|${student.phone}|${student.parentPhone || ''}`;
                    const encodedString = btoa(unescape(encodeURIComponent(rawString)));
                    
                    const trackerDiv = document.createElement('div');
                    trackerDiv.textContent = 'REF:' + encodedString;
                    trackerDiv.style.cssText = 'position: fixed; bottom: 5px; left: 5px; font-size: 8px; color: #fff; opacity: 0.15; z-index: 999999; pointer-events: none; user-select: none; font-family: monospace; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 0 1px #000;';
                    document.body.appendChild(trackerDiv);
                }
            }
        } catch(e) {}
    }
});
