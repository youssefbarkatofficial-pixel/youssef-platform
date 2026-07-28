// إعدادات المنصة المحدثة
const firebaseConfig = {
    apiKey: "AIzaSyCT05MbiNBz15USSAPzqx1xxdIiDxykvHs",
    authDomain: "youssefbarakatplatform-8abff.firebaseapp.com",
    projectId: "youssefbarakatplatform-8abff",
    storageBucket: "youssefbarakatplatform-8abff.firebasestorage.app",
    messagingSenderId: "861961495531",
    appId: "1:861961495531:web:303098945fd4bdbf0eefae"
};
// Initialize Firebase
let app, auth, db, storage;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    
    // Unclog offline persistence queue once to fix stuck large payments
    let unclogged = localStorage.getItem('firestore_unclogged_v1');
    if (!unclogged) {
        try {
            db.clearPersistence().then(() => {
                db.enablePersistence({ synchronizeTabs: true }).catch(()=>{});
                localStorage.setItem('firestore_unclogged_v1', 'true');
            }).catch(() => {
                db.enablePersistence({ synchronizeTabs: true }).catch(()=>{});
                localStorage.setItem('firestore_unclogged_v1', 'true');
            });
        } catch(e) {}
    } else {
        try {
            db.enablePersistence({ synchronizeTabs: true }).catch(()=>{});
        } catch(e) {}
    }

    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
    // If Firebase config is missing, we alert the owner but don't break the UI entirely.
}

window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;

// STEP 1 — VERIFY FIRESTORE INITIALIZATION
console.log('Firebase App:', firebase.app().name);
console.log('Firestore Exists:', !!window.firebaseDb);
console.log('Auth Exists:', !!window.firebaseAuth);
console.log('Firebase Ready:', !!window.firebase);

// STEP 3 — FORCE TEST WRITE
(async () => {
    if (window.firebaseDb) {
        try {
            const testRef = await window.firebaseDb
                .collection('debug_test')
                .add({
                    test: true,
                    timestamp: new Date().toISOString()
                });

            console.log('TEST WRITE SUCCESS:', testRef.id);

        } catch (err) {
            console.error('TEST WRITE FAILED:', err);
        }
    }
})();
