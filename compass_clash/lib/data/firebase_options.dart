import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCT05MbiNBz15USSAPzqx1xxdIiDxykvHs',
    appId: '1:861961495531:web:303098945fd4bdbf0eefae',
    messagingSenderId: '861961495531',
    projectId: 'youssefbarakatplatform-8abff',
    authDomain: 'youssefbarakatplatform-8abff.firebaseapp.com',
    storageBucket: 'youssefbarakatplatform-8abff.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyCT05MbiNBz15USSAPzqx1xxdIiDxykvHs',
    appId: '1:861961495531:android:1234567890abcdef', // TODO: Needs real android appId from google-services.json later
    messagingSenderId: '861961495531',
    projectId: 'youssefbarakatplatform-8abff',
    storageBucket: 'youssefbarakatplatform-8abff.firebasestorage.app',
  );
}
