import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const YpArenaosCustomerApp());
}

class YpArenaosCustomerApp extends StatelessWidget {
  const YpArenaosCustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'YpArenaos Hub',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF060608),
        primaryColor: const Color(0xFF00E5FF),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF00E5FF),
          secondary: Color(0xFFFFB800),
          surface: Color(0xFF14141E),
        ),
        fontFamily: 'Outfit',
      ),
      home: const HomeScreen(),
    );
  }
}
