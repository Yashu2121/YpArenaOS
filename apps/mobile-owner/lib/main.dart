import 'package:flutter/material.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(const YpArenaosOwnerApp());
}

class YpArenaosOwnerApp extends StatelessWidget {
  const YpArenaosOwnerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'YpArenaos Owner',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF060608),
        primaryColor: const Color(0xFFFFB800),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFFB800),
          secondary: Color(0xFF00E5FF),
          surface: Color(0xFF14141E),
        ),
        fontFamily: 'Outfit',
      ),
      home: const LoginScreen(),
    );
  }
}
