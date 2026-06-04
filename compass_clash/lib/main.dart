import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'theme/app_theme.dart';
import 'data/firebase_options.dart';
import 'screens/lobby_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const CompassClashGame());
}

class CompassClashGame extends StatelessWidget {
  const CompassClashGame({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'صِراع البوصلة',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.themeData,
      home: const LobbyScreen(),
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl, // دعم كامل للغة العربية
          child: child!,
        );
      },
    );
  }
}
