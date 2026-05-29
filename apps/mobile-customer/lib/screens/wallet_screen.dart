import 'dart:ui';
import 'package:flutter/material.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF030305),
      body: Stack(
        children: [
          // Animated glowing background orbs
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x3300E5FF),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x33FFB800),
              ),
            ),
          ),
          // Blur layer for glassmorphism background
          BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 80, sigmaY: 80),
            child: Container(color: Colors.transparent),
          ),
          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Text('DIGITAL WALLET', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 3.0, fontSize: 24, color: Colors.white)),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(20.0),
                    children: [
                      // Wallet Card
                      Container(
                        padding: const EdgeInsets.all(32),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0x8000E5FF), Color(0x3300E5FF)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(32),
                          border: Border.all(color: const Color(0x4D00E5FF), width: 1.5),
                          boxShadow: const [BoxShadow(color: Color(0x4D00E5FF), blurRadius: 30, offset: Offset(0, 10))],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('AVAILABLE BALANCE', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, letterSpacing: 2.0, fontSize: 12)),
                            const SizedBox(height: 8),
                            const Text('₹1,450.00', style: TextStyle(color: Colors.white, fontSize: 48, fontWeight: FontWeight.w900)),
                            const SizedBox(height: 32),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.black45,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white10),
                              ),
                              child: const Text('LOYALTY POINTS: 320', style: TextStyle(color: Color(0xFFFFB800), fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 1.5)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 40),
                      const Text('ADD FUNDS', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 2.0, color: Colors.white54, fontSize: 12)),
                      const SizedBox(height: 16),
                      _buildPaymentButton('PAY VIA UPI (GPay/PhonePe)', const Color(0x1AFFFFFF), Colors.white, const Color(0x33FFFFFF)),
                      const SizedBox(height: 12),
                      _buildPaymentButton('PAY VIA CREDIT/DEBIT CARD', const Color(0x1AFFFFFF), Colors.white, const Color(0x33FFFFFF)),
                      const SizedBox(height: 12),
                      _buildPaymentButton('RAZORPAY SECURE CHECKOUT', const Color(0x3300E5FF), const Color(0xFF00E5FF), const Color(0xFF00E5FF)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentButton(String text, Color bgColor, Color textColor, Color borderColor) {
    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: borderColor, width: 1.5),
        boxShadow: bgColor == const Color(0x3300E5FF) ? const [BoxShadow(color: Color(0x3300E5FF), blurRadius: 20)] : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () {},
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text(text, style: TextStyle(color: textColor, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
            ),
          ),
        ),
      ),
    );
  }
}
