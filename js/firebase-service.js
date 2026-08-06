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

    // Sanitize localStorage immediately to prevent QuotaExceededError from old stuck requests
    try {
        let storedReqs = localStorage.getItem('paymentRequests');
        if (storedReqs) {
            let parsedReqs = JSON.parse(storedReqs);
            let needsSave = false;
            parsedReqs.forEach(r => {
                if (r.proofImage) {
                    delete r.proofImage;
                    needsSave = true;
                }
            });
            if (needsSave) {
                localStorage.setItem('paymentRequests', JSON.stringify(parsedReqs));
                console.log('Sanitized paymentRequests in localStorage');
            }
        }
    } catch(e) {
        console.warn('Failed to sanitize localStorage:', e);
    }
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
                parentPhone: userData.parentPhone || '',
                gov: userData.gov || '',
                grade: userData.grade,
                studentCode: userData.studentCode || ('ST-' + Math.random().toString(36).substring(2, 8).toUpperCase()),
                plainPassword: password || userData.password,
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
    async function loginStudent(phoneOrEmail, password) {
        if (!isFirebaseReady()) throw new Error('Firebase not ready');
        await getAuth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

        // توحيد صيغة الرقم إذا كانت وحدة الإنقاذ محملة
        const normalizedInput = (window.BousalaPhoneFix && !phoneOrEmail.includes('@'))
            ? window.BousalaPhoneFix.normPhone(phoneOrEmail)
            : phoneOrEmail;
        
        let emailsToTry = [];
        if (normalizedInput.includes('@')) {
            // أدخل إيميل كامل — جربه أولاً ثم جرب إضافة اللاحقة
            emailsToTry.push(normalizedInput);
            emailsToTry.push(`${normalizedInput}@student.youssefbarakat.com`);
            
            // إضافة الإيميل التالف القديم (Ghost Accounts Rescue)
            const corruptedInput = normalizedInput.replace(/[\s\-().]/g, "");
            if (corruptedInput !== normalizedInput) {
                emailsToTry.push(`${corruptedInput}@student.youssefbarakat.com`);
            }
        } else {
            // رقم موبايل — حوّله إلى إيميل صناعي
            emailsToTry.push(`${normalizedInput}@student.youssefbarakat.com`);
            // وللأمان جرب الرقم الأصلي أيضاً لحالة القديم
            if (normalizedInput !== phoneOrEmail) {
                emailsToTry.push(`${phoneOrEmail}@student.youssefbarakat.com`);
            }
        }

        let userCredential = null;
        let lastError = null;

        for (const email of emailsToTry) {
            try {
                userCredential = await getAuth().signInWithEmailAndPassword(email, password);
                break; 
            } catch (error) {
                lastError = error;
            }
        }

        if (!userCredential) {
            if (lastError && (lastError.code === 'auth/user-not-found' || lastError.code === 'auth/invalid-credential' || lastError.code === 'auth/wrong-password')) {
                const userError = new Error('بيانات الدخول غير صحيحة، إما رقم الموبايل/الإيميل غير مسجل أو كلمة السر خاطئة.');
                userError.code = 'auth/invalid-credential';
                throw userError;
            }
            throw lastError;
        }

        const uid = userCredential.user.uid;
        const authUser = userCredential.user;

        let doc = null;
        try {
            doc = await getDb().collection('students').doc(uid).get();
        } catch(e) {
            console.warn('[LOGIN] Failed to fetch student document from Firestore:', e);
        }

        let userData;
        if (!doc || !doc.exists) {
            // ⚠️ الملف مش موجود في Firestore — لكن لا نحذف الحساب!
            // السبب يمكن أن يكون: مشكلة شبكة مؤقتة، تأخر Firestore، أو ملف لم يُحفظ وقت التسجيل
            console.warn('[LOGIN] Firestore doc missing for uid:', uid, '— attempting self-healing rebuild.');

            // محاولة إعادة بناء الملف من بيانات Auth المتوفرة
            const rebuildData = {
                uid: uid,
                email: authUser.email,
                phone: normalizedInput,
                role: 'student',
                name: authUser.displayName || normalizedInput,
                courses: [],
                notifications: [],
                createdAt: new Date().toISOString(),
                rebuiltAt: new Date().toISOString()
            };

            try {
                await getDb().collection('students').doc(uid).set(rebuildData, { merge: true });
                console.info('[LOGIN] Self-healed Firestore doc for uid:', uid);
                userData = rebuildData;
            } catch(rebuildErr) {
                console.error('[LOGIN] Could not rebuild Firestore doc:', rebuildErr);
                // في أسوأ الأحوال: دعه يدخل بالبيانات الأساسية من Auth دون حذف حسابه
                userData = rebuildData;
            }
        } else {
            userData = doc.data();
        }

        // تأكد إن role موجود
        if (!userData.role) userData.role = 'student';

        cacheStudentData(normalizedInput, userData);
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
        
        const normPhone = phone ? phone.replace(/^\+20/, '0').replace(/^00201/, '01') : phone;
        
        try {
            if (!studentListeners[phone]) {
                studentListeners[phone] = getDb().collection('students')
                    .where('phone', '==', phone).limit(1)
                    .onSnapshot(snap => {
                        if (!snap.empty) {
                            cacheStudentData(phone, snap.docs[0].data());
                        }
                    }, err => console.warn('Student listener error', err));
            }

            // 1. Direct phone match
            let snap = await getDb().collection('students').where('phone', '==', phone).limit(1).get();
            let data = null;
            
            if (!snap.empty) {
                data = snap.docs[0].data();
            } else {
                // 2. Try doc ID (UID)
                if (phone && phone.length > 10) {
                    const doc = await getDb().collection('students').doc(phone).get();
                    if (doc.exists) data = doc.data();
                }
                // 3. Try normalized phone
                if (!data && normPhone !== phone) {
                    const snap2 = await getDb().collection('students').where('phone', '==', normPhone).limit(1).get();
                    if (!snap2.empty) data = snap2.docs[0].data();
                }
            }

            if (data) {
                cacheStudentData(phone, data);
                return data;
            }
            return cached || { courses: [], notifications: [] };
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
            let docRef = null;
            const normPhone = phone ? phone.replace(/^\+20/, '0').replace(/^00201/, '01') : phone;

            // 1. Direct phone match
            const snap = await getDb().collection('students').where('phone', '==', phone).limit(1).get();
            if (!snap.empty) {
                docRef = snap.docs[0].ref;
            } else {
                // 2. Try doc ID (UID)
                if (phone && phone.length > 10) {
                    const doc = await getDb().collection('students').doc(phone).get();
                    if (doc.exists) docRef = doc.ref;
                }
                // 3. Try normalized phone
                if (!docRef && normPhone !== phone) {
                    const snap2 = await getDb().collection('students').where('phone', '==', normPhone).limit(1).get();
                    if (!snap2.empty) docRef = snap2.docs[0].ref;
                }
            }

            if (docRef) {
                await docRef.update(updates);
                console.log(`[Firebase] Student data updated successfully for ${phone}`);
            } else {
                console.warn(`[Firebase] updateStudentData: User not found for ${phone}`);
            }
        } catch (e) { 
            console.warn('updateStudentData failed', e); 
            throw e;
        }
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
            const newDocRef = getDb().collection('paymentRequests').doc();
            // Await the set operation to catch errors (e.g. Payload too large)
            await newDocRef.set(payload);
            
            const docId = newDocRef.id;
            console.log('[PAYMENT REQUEST QUEUED]', docId);

            // Cache locally
            let reqs = JSON.parse(localStorage.getItem('paymentRequests') || '[]');
            let cachedPayload = { ...payload };
            delete cachedPayload.proofImage;
            reqs.push({ id: docId, ...cachedPayload });
            localStorage.setItem('paymentRequests', JSON.stringify(reqs));

            return {
                success: true,
                id: docId
            };
        } catch(error) {
            console.error(
                '[PAYMENT REQUEST ERROR]',
                error
            );

            let reqs = JSON.parse(localStorage.getItem('paymentRequests') || '[]');
            let cachedPayload = { ...payload };
            delete cachedPayload.proofImage;
            reqs.push({ id: 'local_' + Date.now(), ...cachedPayload });
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
                            let data = { id: doc.id, ...doc.data() };
                            latestReqs.push(data);
                        });
                        try {
                            const cacheReqs = latestReqs.map(r => { const {proofImage, ...rest} = r; return rest; });
                            localStorage.setItem('paymentRequests', JSON.stringify(cacheReqs));
                        } catch(e) {}
                    }, err => console.warn('Payment reqs listener error', err));
            }

            const snap = await getDb().collection('paymentRequests')
                .orderBy('createdAt', 'desc')
                .get();
            reqs = [];
            snap.forEach(doc => {
                let data = { id: doc.id, ...doc.data() };
                reqs.push(data);
            });
            try {
                const cacheReqs = reqs.map(r => { const {proofImage, ...rest} = r; return rest; });
                localStorage.setItem('paymentRequests', JSON.stringify(cacheReqs));
            } catch(e) {}
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
        } catch (e) { 
            console.warn('updatePaymentStatus failed', e); 
            throw e;
        }
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
                    plainPassword: u.password || 'مخفية',
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

    // ============================================================
    // AI LLM INTEGRATION (FUTURE PREPARATION)
    // ============================================================
    
    /**
     * Call the Firebase Cloud Function for LLM proxy.
     * This is infrastructure setup only. Do not hook to UI yet.
     */
    async function askSmartBotCloud(message, history = []) {
        if (!isFirebaseReady()) {
            console.warn("Firebase not ready. Cannot call askSmartBotCloud.");
            return { reply: "الاتصال بالخوادم غير متاح حالياً." };
        }
        
        try {
            const askAlBouslaLLM = window.firebase.functions().httpsCallable('askAlBouslaLLM');
            
            // Add a timeout fallback in case of slow functions
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Cloud Function timeout')), 15000)
            );
            
            const result = await Promise.race([
                askAlBouslaLLM({ message, history }),
                timeoutPromise
            ]);

            return result.data;
        } catch (error) {
            console.error('[AI CLOUD ERROR]', error);
            return { reply: "عذراً، أواجه صعوبة في معالجة رسالتك عبر الخوادم الآن." };
        }
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
        getCachedCourses: getCoursesFromStorage,
        askSmartBotCloud
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
