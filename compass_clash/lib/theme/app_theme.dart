import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Primary Colors (الهوية الأساسية الفخمة)
  static const Color darkNavy = Color(0xFF0F172A);
  static const Color deepBlack = Color(0xFF000000);
  static const Color brushedGold = Color(0xFFD4AF37);
  static const Color warmAmber = Color(0xFFFFBF00);
  static const Color textWhite = Color(0xFFF8FAFC);
  static const Color mutedText = Color(0xFF94A3B8);

  static ThemeData get themeData {
    return ThemeData(
      brightness: Brightness.dark,
      primaryColor: darkNavy,
      scaffoldBackgroundColor: deepBlack,
      textTheme: GoogleFonts.cairoTextTheme(ThemeData.dark().textTheme).apply(
        bodyColor: textWhite,
        displayColor: textWhite,
      ),
      colorScheme: const ColorScheme.dark(
        primary: brushedGold,
        secondary: warmAmber,
        background: deepBlack,
        surface: darkNavy,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: brushedGold,
          foregroundColor: deepBlack,
          textStyle: GoogleFonts.cairo(fontWeight: FontWeight.bold, fontSize: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        ),
      ),
    );
  }
}
