import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _serverController = TextEditingController(text: 'http://192.168.1.100:5000');
  final _emailController = TextEditingController(text: 'admin@yparenaos.com');
  final _passwordController = TextEditingController(text: 'admin123');
  bool _isLoading = false;

  void _login() async {
    setState(() => _isLoading = true);
    
    // Set the dynamic server URL
    String url = _serverController.text.trim();
    if (url.endsWith('/')) url = url.substring(0, url.length - 1);
    if (!url.startsWith('http')) url = 'http://$url';
    if (!url.endsWith('/api')) url = '$url/api'; // Append /api if not present
    
    ApiService.setBaseUrl(url);

    try {
      final response = await ApiService.login(
        _emailController.text.trim(),
        _passwordController.text,
      );

      setState(() => _isLoading = false);

      if (response['token'] != null) {
        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const DashboardScreen()),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['error'] ?? 'Authentication failed.'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Server unreachable: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'YPARENAOS',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 4.0,
                  color: Color(0xFF00E5FF),
                  shadows: [
                    Shadow(color: Color(0x6600E5FF), blurRadius: 15)
                  ]
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'OWNER COMMAND CENTER',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 3.0,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 48),
              TextField(
                controller: _serverController,
                decoration: InputDecoration(
                  labelText: 'SERVER IP / URL',
                  labelStyle: const TextStyle(fontSize: 12, letterSpacing: 2.0),
                  filled: true,
                  fillColor: const Color(0xFF14141E),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  prefixIcon: const Icon(Icons.dns_rounded, color: Colors.white54),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: 'AUTHORIZED EMAIL',
                  labelStyle: const TextStyle(fontSize: 12, letterSpacing: 2.0),
                  filled: true,
                  fillColor: const Color(0xFF14141E),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  prefixIcon: const Icon(Icons.person_rounded, color: Colors.white54),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'SECURITY CLEARANCE',
                  labelStyle: const TextStyle(fontSize: 12, letterSpacing: 2.0),
                  filled: true,
                  fillColor: const Color(0xFF14141E),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  prefixIcon: const Icon(Icons.lock_rounded, color: Colors.white54),
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _login,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFB800),
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isLoading 
                    ? const CircularProgressIndicator(color: Colors.black)
                    : const Text(
                        'INITIATE SYNC',
                        style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2.0),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
