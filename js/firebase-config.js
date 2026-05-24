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

    // Enable offline persistence so data is available even without internet
    db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence failed (multiple tabs open)');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence not supported in this browser');
        }
    });

    // Sign in anonymously so Firestore rules allow read/write
    auth.signInAnonymously().then(function() {
        console.log("✅ Firebase Auth: signed in anonymously");
        window.firebaseReady = true;
        window.dispatchEvent(new Event('firebaseReady'));
    }).catch(function(error) {
        console.warn("Firebase anonymous auth failed:", error.code, error.message);
        // Still mark as ready so localStorage fallback works
        window.firebaseReady = true;
        window.dispatchEvent(new Event('firebaseReady'));
    });

    console.log("✅ Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
    window.firebaseReady = false;
}

window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;
