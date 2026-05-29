import 'dart:ui';
import 'dart:async';
import 'package:flutter/material.dart';
import 'wallet_screen.dart';
import '../services/api_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with TickerProviderStateMixin {
  int _selectedTab = 0;
  bool _loading = true;
  
  // Data
  Map<String, dynamic>? _user;
  List<dynamic> _gamezones = [];
  List<dynamic> _recentSessions = [];
  List<dynamic> _tournaments = [];
  List<dynamic> _posItems = [];
  List<dynamic> _devices = [];
  
  String? _selectedGamezoneId;
  Timer? _refreshTimer;
  late AnimationController _fadeCtrl;
  late AnimationController _orbCtrl;

  static const _cyan  = Color(0xFF00E5FF);
  static const _gold  = Color(0xFFFFB800);
  static const _green = Color(0xFF00FF66);
  static const _purple= Color(0xFFB300FF);
  static const _bg    = Color(0xFF020204);
  static const _panel = Color(0x7314141E);

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700))..forward();
    _orbCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 12))..repeat(reverse: true);
    _loadAll();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadData());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _fadeCtrl.dispose();
    _orbCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    await _loadData();
  }

  Future<void> _loadData() async {
    try {
      final gzRes = await ApiService.getGamezones();
      final defaultGz = gzRes.isNotEmpty ? gzRes[0]['gamezone_id'] : 'b0000000-0000-0000-0000-000000000001';
      _selectedGamezoneId ??= defaultGz;

      final results = await Future.wait([
        ApiService.getTournaments(gamezoneId: _selectedGamezoneId),
        ApiService.getPosItems(_selectedGamezoneId!),
        ApiService.getDevices(gamezoneId: _selectedGamezoneId),
      ]);

      // Mock user profile since we might not have logged in
      final mockUser = {
        'name': 'Yash Kumar',
        'loyalty_points': 1450,
        'active_session': null
      };

      if (mounted) {
        setState(() {
          _gamezones = gzRes.isEmpty ? [{'gamezone_id': 'gz1', 'name': 'YpArenaos Downtown'}] : gzRes;
          _tournaments = results[0] as List<dynamic>;
          _posItems = results[1] as List<dynamic>;
          _devices = results[2] as List<dynamic>;
          _user = mockUser;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _gamezones = [{'gamezone_id': 'gz1', 'name': 'YpArenaos Downtown'}];
          _tournaments = [{'tournament_id': 't1', 'name': 'Valorant Championship', 'game': 'Valorant', 'prize_pool': 10000, 'status': 'upcoming', 'entry_fee': 100}];
          _posItems = [{'pos_id': 'p1', 'item_name': 'Energy Drink', 'price': 100, 'category': 'beverage'}, {'pos_id': 'p2', 'item_name': 'Burger', 'price': 150, 'category': 'food'}];
          _devices = [
            {'client_id': 'd1', 'name': 'PC-01', 'device_type': 'PC', 'status': 'online', 'hourly_rate': 60},
            {'client_id': 'd2', 'name': 'PC-02', 'device_type': 'PC', 'status': 'in_use', 'hourly_rate': 60},
            {'client_id': 'd3', 'name': 'PS5-VIP', 'device_type': 'PS5', 'status': 'online', 'hourly_rate': 80},
          ];
          _user = {'name': 'Gamer', 'loyalty_points': 450};
          _loading = false;
        });
      }
    }
  }

  Widget _glassBox({required Widget child, Color border = Colors.white10, EdgeInsets padding = const EdgeInsets.all(24), double radius = 28}) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 24, offset: Offset(0, 12))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft, end: Alignment.bottomRight,
                colors: [_panel, _panel.withOpacity(0.3)],
              ),
              borderRadius: BorderRadius.circular(radius),
              border: Border.all(color: border, width: 0.5),
            ),
            child: child,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: Stack(children: [
        AnimatedBuilder(
          animation: _orbCtrl,
          builder: (context, child) {
            return Stack(
              children: [
                Positioned(
                  top: -50 - (20 * _orbCtrl.value), right: -50 + (20 * _orbCtrl.value),
                  child: Container(width: 400, height: 400, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x1A00E5FF), boxShadow: [BoxShadow(color: Color(0x1A00E5FF), blurRadius: 100)])),
                ),
                Positioned(
                  bottom: -100 + (30 * _orbCtrl.value), left: -100 - (10 * _orbCtrl.value),
                  child: Container(width: 350, height: 350, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x1AFFB800), boxShadow: [BoxShadow(color: Color(0x1AFFB800), blurRadius: 100)])),
                ),
                Positioned(
                  top: MediaQuery.of(context).size.height / 3, left: 150 * _orbCtrl.value,
                  child: Container(width: 250, height: 250, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x1A00FF66), boxShadow: [BoxShadow(color: Color(0x1A00FF66), blurRadius: 100)])),
                ),
              ],
            );
          }
        ),

        SafeArea(child: Column(children: [
          _buildAppBar(),
          if (_loading) const Expanded(child: Center(child: CircularProgressIndicator(color: _cyan)))
          else Expanded(child: FadeTransition(opacity: _fadeCtrl, child: _buildTabContent())),
        ])),

        Positioned(bottom: 20, left: 20, right: 20, child: _buildBottomNav()),
      ]),
    );
  }

  Widget _buildAppBar() => Padding(
    padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      const Text('GAMERS HUB', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2.5, fontSize: 22, color: Colors.white)),
      Row(children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(gradient: LinearGradient(colors: [_gold.withOpacity(0.2), _gold.withOpacity(0.05)]), borderRadius: BorderRadius.circular(20), border: Border.all(color: _gold.withOpacity(0.4))),
          child: Row(children: [
            const Icon(Icons.stars_rounded, color: _gold, size: 16),
            const SizedBox(width: 6),
            Text('${_user?['loyalty_points'] ?? 0} pts', style: const TextStyle(color: _gold, fontWeight: FontWeight.w900, fontSize: 13)),
          ]),
        ),
        const SizedBox(width: 12),
        GestureDetector(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const WalletScreen())),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(gradient: LinearGradient(colors: [_cyan.withOpacity(0.2), _cyan.withOpacity(0.05)]), shape: BoxShape.circle, border: Border.all(color: _cyan.withOpacity(0.4)), boxShadow: const [BoxShadow(color: Color(0x4000E5FF), blurRadius: 12)]),
            child: const Icon(Icons.account_balance_wallet_rounded, color: _cyan, size: 22),
          ),
        ),
      ]),
    ]),
  );

  Widget _buildBottomNav() {
    final tabs = [
      {'icon': Icons.home_rounded, 'label': 'HOME', 'color': _cyan},
      {'icon': Icons.desktop_windows_rounded, 'label': 'BOOK', 'color': _green},
      {'icon': Icons.sports_esports_rounded, 'label': 'EVENTS', 'color': _purple},
      {'icon': Icons.storefront_rounded, 'label': 'STORE', 'color': _gold},
    ];
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
        child: Container(
          height: 75,
          decoration: BoxDecoration(
            color: const Color(0x800A0A10),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.1)),
            boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 20)],
          ),
          child: Row(children: List.generate(tabs.length, (i) {
            final active = _selectedTab == i;
            final c = tabs[i]['color'] as Color;
            return Expanded(child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() {
                if (_selectedTab != i) {
                  _selectedTab = i;
                  _fadeCtrl.forward(from: 0);
                }
              }),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOutCirc,
                decoration: BoxDecoration(
                  color: active ? c.withOpacity(0.1) : Colors.transparent,
                  borderRadius: BorderRadius.circular(20),
                ),
                margin: const EdgeInsets.all(6),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(tabs[i]['icon'] as IconData, size: active ? 26 : 22, color: active ? c : Colors.white38, shadows: active ? [Shadow(color: c, blurRadius: 12)] : null),
                  if (active) const SizedBox(height: 4),
                  if (active) Text(tabs[i]['label'] as String, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: c, letterSpacing: 1.0)),
                ]),
              ),
            ));
          })),
        ),
      ),
    );
  }

  Widget _buildTabContent() {
    return [_buildHome(), _buildBook(), _buildEvents(), _buildStore()][_selectedTab];
  }

  // ─── TAB 0: HOME ────────────────────────────────
  Widget _buildHome() => ListView(padding: const EdgeInsets.fromLTRB(24, 20, 24, 120), children: [
    const Text('WELCOME BACK,', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 2.5, color: Colors.white54)),
    const SizedBox(height: 4),
    Text(_user?['name']?.toUpperCase() ?? 'GAMER', style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 1.5)),
    const SizedBox(height: 32),

    // QR Check-in
    _glassBox(
      border: _cyan.withOpacity(0.4),
      padding: const EdgeInsets.all(28),
      child: Column(children: [
        const Icon(Icons.qr_code_scanner_rounded, size: 56, color: _cyan, shadows: [Shadow(color: Color(0x8000E5FF), blurRadius: 16)]),
        const SizedBox(height: 20),
        const Text('QUICK CHECK-IN', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2.5, fontSize: 18, color: Colors.white)),
        const SizedBox(height: 12),
        const Text('Scan QR code at any terminal to instantly log in and start your session.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white54, fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(backgroundColor: _cyan.withOpacity(0.15), foregroundColor: _cyan, side: BorderSide(color: _cyan.withOpacity(0.5)), padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
          child: const Text('SCAN QR CODE', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.5, fontSize: 14)),
        ),
      ]),
    ),
    const SizedBox(height: 32),

    // Active Session (if any)
    const Text('CURRENT STATUS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 2.5, color: Colors.white54)),
    const SizedBox(height: 16),
    _glassBox(
      border: Colors.white.withOpacity(0.15),
      child: Row(children: [
        Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), shape: BoxShape.circle), child: const Icon(Icons.videogame_asset_off_rounded, color: Colors.white38, size: 28)),
        const SizedBox(width: 20),
        const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('No Active Session', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 16)),
          SizedBox(height: 4),
          Text('Book a PC or scan to play', style: TextStyle(color: Colors.white54, fontSize: 13, fontWeight: FontWeight.w600)),
        ])),
      ]),
    ),
  ]);

  // ─── TAB 1: BOOKING ─────────────────────────────
  Widget _buildBook() => Column(children: [
    Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Row(children: [
      const Icon(Icons.location_on_rounded, color: _cyan, size: 20),
      const SizedBox(width: 10),
      Text(_gamezones.isNotEmpty ? _gamezones[0]['name'] : 'YpArenaos', style: const TextStyle(color: _cyan, fontWeight: FontWeight.w900, fontSize: 15)),
    ])),
    const SizedBox(height: 20),
    Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(24, 0, 24, 120), children: [
      const Text('AVAILABLE RIGS', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 2.5, color: Colors.white)),
      const SizedBox(height: 20),
      GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 16, crossAxisSpacing: 16, childAspectRatio: 0.8),
        itemCount: _devices.length,
        itemBuilder: (_, i) {
          final d = _devices[i];
          final isAvail = d['status'] == 'online';
          final c = isAvail ? _green : Colors.white24;
          return _glassBox(
            border: c.withOpacity(0.3), padding: const EdgeInsets.all(20), radius: 24,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(d['device_type'] == 'PS5' ? '🎮' : '🖥️', style: const TextStyle(fontSize: 32)),
                Container(width: 10, height: 10, decoration: BoxDecoration(shape: BoxShape.circle, color: c, boxShadow: [BoxShadow(color: c, blurRadius: 8)])),
              ]),
              const SizedBox(height: 16),
              Text(d['name'], style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18)),
              const SizedBox(height: 4),
              Text('₹${d['hourly_rate']}/hr', style: const TextStyle(color: _gold, fontWeight: FontWeight.w900, fontSize: 13)),
              const Spacer(),
              SizedBox(width: double.infinity, child: ElevatedButton(
                onPressed: isAvail ? () => _showBookDialog(d) : null,
                style: ElevatedButton.styleFrom(backgroundColor: isAvail ? _green.withOpacity(0.15) : Colors.white10, foregroundColor: isAvail ? _green : Colors.white38, side: BorderSide(color: isAvail ? _green.withOpacity(0.5) : Colors.transparent), padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: Text(isAvail ? 'BOOK NOW' : 'IN USE', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1.0)),
              )),
            ]),
          );
        },
      )
    ])),
  ]);

  // ─── TAB 2: EVENTS/TOURNAMENTS ──────────────────
  Widget _buildEvents() => ListView(padding: const EdgeInsets.fromLTRB(24, 20, 24, 120), children: [
    const Text('UPCOMING EVENTS', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 2.5, color: Colors.white)),
    const SizedBox(height: 20),
    if (_tournaments.isEmpty) const Text('No upcoming events.', style: TextStyle(color: Colors.white54))
    else ..._tournaments.map((t) => Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: _glassBox(border: _purple.withOpacity(0.4), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), decoration: BoxDecoration(gradient: LinearGradient(colors: [_purple.withOpacity(0.3), _purple.withOpacity(0.1)]), borderRadius: BorderRadius.circular(10)), child: Text(t['game'] ?? '', style: const TextStyle(color: _purple, fontWeight: FontWeight.w900, fontSize: 11))),
          Text((t['status'] ?? '').toUpperCase(), style: const TextStyle(color: _green, fontWeight: FontWeight.w900, fontSize: 11, letterSpacing: 1.5)),
        ]),
        const SizedBox(height: 16),
        Text(t['name'] ?? '', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white)),
        const SizedBox(height: 20),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('PRIZE POOL', style: TextStyle(fontSize: 10, color: Colors.white54, letterSpacing: 1.5, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('₹${t['prize_pool']}', style: const TextStyle(color: _gold, fontWeight: FontWeight.w900, fontSize: 20)),
          ])),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('ENTRY FEE', style: TextStyle(fontSize: 10, color: Colors.white54, letterSpacing: 1.5, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text('₹${t['entry_fee']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20)),
          ])),
        ]),
        const SizedBox(height: 24),
        SizedBox(width: double.infinity, child: ElevatedButton(
          onPressed: () {},
          style: ElevatedButton.styleFrom(backgroundColor: _purple.withOpacity(0.8), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 16), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
          child: const Text('REGISTER NOW', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 2.0, fontSize: 13)),
        )),
      ])),
    )),
  ]);

  // ─── TAB 3: STORE/POS ───────────────────────────
  Widget _buildStore() => Column(children: [
    Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      const Text('CAFE STORE', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 2.5, color: Colors.white)),
      Text('Order to your seat', style: TextStyle(color: _gold, fontSize: 12, fontWeight: FontWeight.w800)),
    ])),
    const SizedBox(height: 20),
    Expanded(child: GridView.builder(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 120),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 16, crossAxisSpacing: 16, childAspectRatio: 0.85),
      itemCount: _posItems.length,
      itemBuilder: (_, i) {
        final item = _posItems[i];
        final icon = item['category'] == 'food' ? '🍔' : item['category'] == 'beverage' ? '🥤' : '📦';
        return _glassBox(
          border: _gold.withOpacity(0.3), padding: const EdgeInsets.all(20), radius: 24,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(icon, style: const TextStyle(fontSize: 36)),
            const SizedBox(height: 16),
            Text(item['item_name'], style: const TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 15)),
            const Spacer(),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text('₹${item['price']}', style: const TextStyle(color: _gold, fontWeight: FontWeight.w900, fontSize: 18)),
              GestureDetector(
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${item['item_name']} added to cart!', style: const TextStyle(fontWeight: FontWeight.w800)), backgroundColor: _green)),
                child: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(gradient: LinearGradient(colors: [_gold.withOpacity(0.2), _gold.withOpacity(0.05)]), borderRadius: BorderRadius.circular(10), border: Border.all(color: _gold.withOpacity(0.4))), child: const Icon(Icons.add_rounded, color: _gold, size: 20)),
              ),
            ]),
          ]),
        );
      },
    )),
  ]);

  void _showBookDialog(Map d) {
    showDialog(context: context, builder: (_) => AlertDialog(
      backgroundColor: const Color(0xFF14141E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: BorderSide(color: _cyan.withOpacity(0.3))),
      title: Text('BOOK ${d['name']}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
      content: Text('Rate: ₹${d['hourly_rate']}/hr\nSelect time slot to confirm booking.', style: const TextStyle(color: Colors.white54, fontWeight: FontWeight.w600, height: 1.5)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('CANCEL', style: TextStyle(color: Colors.white54, fontWeight: FontWeight.w800))),
        ElevatedButton(
          onPressed: () { Navigator.pop(context); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Booking Confirmed!', style: TextStyle(fontWeight: FontWeight.w800)), backgroundColor: _green)); },
          style: ElevatedButton.styleFrom(backgroundColor: _cyan, foregroundColor: Colors.black, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          child: const Text('CONFIRM', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.0)),
        ),
      ],
    ));
  }
}
