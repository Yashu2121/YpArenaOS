import 'dart:convert';
import 'package:http/http.dart' as http;

/// YpArenaOS API Service
/// Central HTTP client for all mobile app API calls.
class ApiService {
  static const String baseUrl = 'http://10.0.2.2:4000'; // Android emulator → localhost
  // For physical device: change to your PC's local IP e.g. 'http://192.168.1.100:4000'

  static String? _authToken;
  static Map<String, dynamic>? _currentUser;

  static String? get token => _authToken;
  static Map<String, dynamic>? get currentUser => _currentUser;

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_authToken != null) 'Authorization': 'Bearer $_authToken',
  };

  // ──────────────────────────────────────────────
  // HEALTH CHECK
  // ──────────────────────────────────────────────
  static Future<Map<String, dynamic>> health() async {
    final r = await http.get(Uri.parse('$baseUrl/health'));
    return jsonDecode(r.body);
  }

  // ──────────────────────────────────────────────
  // AUTH
  // ──────────────────────────────────────────────
  static Future<Map<String, dynamic>> login(String email, String password) async {
    final r = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _headers,
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = jsonDecode(r.body);
    if (r.statusCode == 200) {
      _authToken = data['token'];
      _currentUser = data['user'];
    }
    return data;
  }

  static Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    String role = 'customer',
    String? phone,
    String? gamezoneName,
    String? city,
  }) async {
    final r = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: _headers,
      body: jsonEncode({
        'name': name,
        'email': email,
        'password': password,
        'role': role,
        if (phone != null) 'phone': phone,
        if (gamezoneName != null) 'gamezone_name': gamezoneName,
        if (city != null) 'city': city,
      }),
    );
    final data = jsonDecode(r.body);
    if (r.statusCode == 201) {
      _authToken = data['token'];
      _currentUser = data['user'];
    }
    return data;
  }

  static void logout() {
    _authToken = null;
    _currentUser = null;
  }

  // ──────────────────────────────────────────────
  // USERS
  // ──────────────────────────────────────────────
  static Future<Map<String, dynamic>> getUserProfile(String userId) async {
    final r = await http.get(Uri.parse('$baseUrl/users/$userId'), headers: _headers);
    return jsonDecode(r.body);
  }

  // ──────────────────────────────────────────────
  // WALLET
  // ──────────────────────────────────────────────
  static Future<Map<String, dynamic>> topUpWallet({
    required String userId,
    required String gamezoneId,
    required double amount,
    String method = 'UPI',
    String? referenceId,
  }) async {
    final r = await http.post(
      Uri.parse('$baseUrl/users/$userId/wallet/topup'),
      headers: _headers,
      body: jsonEncode({
        'gamezone_id': gamezoneId,
        'amount': amount,
        'method': method,
        if (referenceId != null) 'reference_id': referenceId,
      }),
    );
    return jsonDecode(r.body);
  }

  // ──────────────────────────────────────────────
  // DEVICES
  // ──────────────────────────────────────────────
  static Future<List<dynamic>> getDevices({String? gamezoneId, String? status}) async {
    final params = {
      if (gamezoneId != null) 'gamezone_id': gamezoneId,
      if (status != null) 'status': status,
    };
    final uri = Uri.parse('$baseUrl/clients').replace(queryParameters: params);
    final r = await http.get(uri, headers: _headers);
    final data = jsonDecode(r.body);
    return data['clients'] ?? [];
  }

  // ──────────────────────────────────────────────
  // SESSIONS
  // ──────────────────────────────────────────────
  static Future<Map<String, dynamic>> startSession({
    required String clientId,
    required String gamezoneId,
    String? customerId,
    String paymentMethod = 'wallet',
  }) async {
    final r = await http.post(
      Uri.parse('$baseUrl/sessions/start'),
      headers: _headers,
      body: jsonEncode({
        'client_id': clientId,
        'gamezone_id': gamezoneId,
        if (customerId != null) 'customer_id': customerId,
        'payment_method': paymentMethod,
      }),
    );
    return jsonDecode(r.body);
  }

  static Future<Map<String, dynamic>> stopSession(String sessionId) async {
    final r = await http.post(
      Uri.parse('$baseUrl/sessions/$sessionId/stop'),
      headers: _headers,
    );
    return jsonDecode(r.body);
  }

  static Future<List<dynamic>> getActiveSessions() async {
    final r = await http.get(Uri.parse('$baseUrl/sessions/active'), headers: _headers);
    final data = jsonDecode(r.body);
    return data['sessions'] ?? [];
  }

  // ──────────────────────────────────────────────
  // STATS
  // ──────────────────────────────────────────────
  static Future<Map<String, dynamic>> getStats({String? gamezoneId}) async {
    final uri = Uri.parse('$baseUrl/stats').replace(queryParameters: {
      if (gamezoneId != null) 'gamezone_id': gamezoneId,
    });
    final r = await http.get(uri, headers: _headers);
    return jsonDecode(r.body);
  }

  // ──────────────────────────────────────────────
  // GAMEZONES
  // ──────────────────────────────────────────────
  static Future<List<dynamic>> getGamezones() async {
    final r = await http.get(Uri.parse('$baseUrl/gamezones'), headers: _headers);
    final data = jsonDecode(r.body);
    return data['gamezones'] ?? [];
  }

  // ──────────────────────────────────────────────
  // TOURNAMENTS
  // ──────────────────────────────────────────────
  static Future<List<dynamic>> getTournaments({String? gamezoneId}) async {
    final uri = Uri.parse('$baseUrl/tournaments').replace(queryParameters: {
      if (gamezoneId != null) 'gamezone_id': gamezoneId,
    });
    final r = await http.get(uri, headers: _headers);
    final data = jsonDecode(r.body);
    return data['tournaments'] ?? [];
  }

  static Future<Map<String, dynamic>> registerTournament(String tournamentId, String userId, {String? teamName}) async {
    final r = await http.post(
      Uri.parse('$baseUrl/tournaments/$tournamentId/register'),
      headers: _headers,
      body: jsonEncode({'user_id': userId, if (teamName != null) 'team_name': teamName}),
    );
    return jsonDecode(r.body);
  }

  // ──────────────────────────────────────────────
  // POS
  // ──────────────────────────────────────────────
  static Future<List<dynamic>> getPosItems(String gamezoneId) async {
    final r = await http.get(Uri.parse('$baseUrl/pos?gamezone_id=$gamezoneId'), headers: _headers);
    final data = jsonDecode(r.body);
    return data['items'] ?? [];
  }

  static Future<Map<String, dynamic>> placeOrder({
    required String posId,
    required String gamezoneId,
    String? userId,
    String? sessionId,
    int quantity = 1,
  }) async {
    final r = await http.post(
      Uri.parse('$baseUrl/pos/order'),
      headers: _headers,
      body: jsonEncode({
        'pos_id': posId,
        'gamezone_id': gamezoneId,
        'quantity': quantity,
        if (userId != null) 'user_id': userId,
        if (sessionId != null) 'session_id': sessionId,
      }),
    );
    return jsonDecode(r.body);
  }

  // ──────────────────────────────────────────────
  // GENERIC API CALL
  // ──────────────────────────────────────────────
  static Future<Map<String, dynamic>> apiCall(String path, {String method = 'GET', Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    http.Response r;
    if (method.toUpperCase() == 'POST') {
      r = await http.post(uri, headers: _headers, body: body != null ? jsonEncode(body) : null);
    } else if (method.toUpperCase() == 'PUT') {
      r = await http.put(uri, headers: _headers, body: body != null ? jsonEncode(body) : null);
    } else if (method.toUpperCase() == 'DELETE') {
      r = await http.delete(uri, headers: _headers, body: body != null ? jsonEncode(body) : null);
    } else {
      r = await http.get(uri, headers: _headers);
    }
    try {
      return jsonDecode(r.body);
    } catch (_) {
      return {'status': r.statusCode, 'body': r.body};
    }
  }
}
