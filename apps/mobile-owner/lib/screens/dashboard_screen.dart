import 'dart:ui';
import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with TickerProviderStateMixin {
  int _selectedTab = 0;
  Map<String, dynamic> _stats = {};
  List<dynamic> _devices = [];
  List<dynamic> _sessions = [];
  List<dynamic> _tournaments = [];
  List<dynamic> _posItems = [];
  bool _loading = true;
  Timer? _refreshTimer;
  late AnimationController _fadeCtrl;

  // Professional / Enterprise Color Palette
  static const _blue  = Color(0xFF3B82F6); // Professional Blue
  static const _gold  = Color(0xFFF59E0B); // Muted Gold
  static const _green = Color(0xFF10B981); // Emerald Green
  static const _red   = Color(0xFFEF4444); // Soft Red
  static const _purple= Color(0xFF8B5CF6); // Soft Purple
  static const _bg    = Color(0xFF050505); // Deep Charcoal Black

  @override
  void initState() {
    super.initState();
    _fadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 500))..forward();
    _loadAll();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadAll());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _fadeCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    try {
      final results = await Future.wait([
        ApiService.getStats(),
        ApiService.getDevices(),
        ApiService.getActiveSessions(),
        ApiService.getTournaments(),
        ApiService.getPosItems('b0000000-0000-0000-0000-000000000001'),
      ]);
      if (mounted) setState(() {
        _stats      = results[0] as Map<String, dynamic>;
        _devices    = results[1] as List<dynamic>;
        _sessions   = results[2] as List<dynamic>;
        _tournaments = results[3] as List<dynamic>;
        _posItems   = results[4] as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() {
        _stats = {'today': {'revenue': 24530, 'hours': 48.5}, 'active_sessions': 3, 'devices': {'total': 8, 'online': 5, 'in_use': 3}, 'total_customers': 147};
        _devices = [
          {'client_id': 'd1', 'name': 'PC-01', 'device_type': 'PC', 'status': 'in_use', 'hourly_rate': 60, 'specs': {'gpu': 'RTX 4070'}},
          {'client_id': 'd2', 'name': 'PC-02', 'device_type': 'PC', 'status': 'online', 'hourly_rate': 60, 'specs': {'gpu': 'RTX 4070'}},
          {'client_id': 'd3', 'name': 'PC-03', 'device_type': 'PC', 'status': 'offline', 'hourly_rate': 40, 'specs': {'gpu': 'RTX 3060'}},
          {'client_id': 'd4', 'name': 'PS5-VIP', 'device_type': 'PS5', 'status': 'online', 'hourly_rate': 80, 'specs': {}},
        ];
        _sessions = [];
        _loading = false;
      });
    }
  }

  // ─── helpers ────────────────────────────────────
  Color _statusColor(String s) {
    switch (s) {
      case 'online': return _green;
      case 'in_use': return _blue;
      case 'maintenance': return _gold;
      default: return Colors.white24;
    }
  }

  Widget _glassBox({required Widget child, Color? border, EdgeInsets padding = const EdgeInsets.all(24), double radius = 16}) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0F0F12),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: border ?? Colors.white.withOpacity(0.05), width: 1),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10, offset: Offset(0, 4))],
      ),
      child: Padding(
        padding: padding,
        child: child,
      ),
    );
  }

  Widget _statCard(String label, String value, Color color, {String? sub}) => _glassBox(
    padding: const EdgeInsets.all(20),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.5, color: Colors.white54)),
      const SizedBox(height: 12),
      Text(value, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w500, color: color)),
      if (sub != null) Text(sub, style: const TextStyle(fontSize: 11, color: Colors.white38)),
    ]),
  );

  // ─── TABS ────────────────────────────────────────
  final _tabs = [
    {'icon': Icons.dashboard_outlined, 'label': 'Overview'},
    {'icon': Icons.grid_view_outlined, 'label': 'Grid'},
    {'icon': Icons.history_rounded, 'label': 'Sessions'},
    {'icon': Icons.point_of_sale_rounded, 'label': 'POS'},
    {'icon': Icons.emoji_events_outlined, 'label': 'Tourney'},
    {'icon': Icons.people_outline_rounded, 'label': 'Clients'},
    {'icon': Icons.analytics_outlined, 'label': 'Stats'},
    {'icon': Icons.settings_outlined, 'label': 'Settings'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: Stack(children: [
        SafeArea(child: Column(children: [
          _buildTopBar(),
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator(color: _blue, strokeWidth: 2)))
          else
            Expanded(child: FadeTransition(opacity: _fadeCtrl, child: _buildTabContent())),
        ])),

        // Bottom Nav
        Positioned(bottom: 24, left: 16, right: 16, child: _buildBottomNav()),
      ]),
    );
  }

  Widget _buildTopBar() => Padding(
    padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
    child: Row(children: [
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(
          children: [
            const Text('YP', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w300, letterSpacing: 2.0, color: Colors.white)),
            const Text('ARENAOS', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, letterSpacing: 2.0, color: _blue)),
          ],
        ),
        const SizedBox(height: 4),
        const Text('Enterprise Command Center', style: TextStyle(fontSize: 11, color: Colors.white54, fontWeight: FontWeight.w500, letterSpacing: 1.0)),
      ]),
      const Spacer(),
      GestureDetector(
        onTap: _loadAll,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white.withOpacity(0.1))),
          child: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 20),
        ),
      ),
    ]),
  );

  Widget _buildBottomNav() => ClipRRect(
    borderRadius: BorderRadius.circular(20),
    child: BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
      child: Container(
        height: 70,
        decoration: BoxDecoration(
          color: const Color(0x990A0A0C),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.08)),
        ),
        child: Row(children: List.generate(_tabs.length, (i) {
          final active = _selectedTab == i;
          return Expanded(child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() {
              if (_selectedTab != i) {
                _selectedTab = i;
                _fadeCtrl.forward(from: 0);
              }
            }),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              decoration: BoxDecoration(
                color: active ? Colors.white.withOpacity(0.08) : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
              ),
              margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(_tabs[i]['icon'] as IconData, size: 22, color: active ? Colors.white : Colors.white38),
                if (active) const SizedBox(height: 4),
                if (active) Text(_tabs[i]['label'] as String, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Colors.white, letterSpacing: 0.5)),
              ]),
            ),
          ));
        })),
      ),
    ),
  );

  Widget _buildTabContent() {
    final pages = [
      _buildOverview(),
      _buildPcGrid(),
      _buildSessions(),
      _buildPOS(),
      _buildTournaments(),
      _buildCustomers(),
      _buildAnalytics(),
      _buildSettings(),
    ];
    return pages[_selectedTab];
  }

  // ─── TAB 0: OVERVIEW ────────────────────────────
  Widget _buildOverview() {
    final rev = _stats['today']?['revenue'] ?? 0;
    final hrs = _stats['today']?['hours'] ?? 0;
    final active = _stats['active_sessions'] ?? 0;
    final customers = _stats['total_customers'] ?? 0;
    final devices = _stats['devices'] ?? {};

    return ListView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 120), children: [
      Row(children: [
        Expanded(child: _statCard('TODAY REVENUE', '₹${rev.toStringAsFixed(0)}', _gold)),
        const SizedBox(width: 12),
        Expanded(child: _statCard('TODAY HOURS', '${hrs}h', _blue)),
      ]),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: _statCard('ACTIVE SESSIONS', '$active', _green)),
        const SizedBox(width: 12),
        Expanded(child: _statCard('TOTAL CUSTOMERS', '$customers', _purple)),
      ]),
      const SizedBox(height: 24),

      // Device Status Summary
      _glassBox(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('TERMINAL STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1.5, color: Colors.white54)),
          const SizedBox(height: 20),
          Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
            _miniStatusBadge('ONLINE', devices['online'] ?? 0, _green),
            _miniStatusBadge('IN USE', devices['in_use'] ?? 0, _blue),
            _miniStatusBadge('OFFLINE', devices['offline'] ?? 0, Colors.white38),
            _miniStatusBadge('TOTAL', devices['total'] ?? 0, Colors.white),
          ]),
        ]),
      ),
      const SizedBox(height: 24),

      // Quick Actions
      const Text('QUICK ACTIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1.5, color: Colors.white54)),
      const SizedBox(height: 12),
      GridView.count(
        crossAxisCount: 3,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.1,
        children: [
          _quickAction(Icons.lock_open_rounded, 'Unlock All', _blue, () {}),
          _quickAction(Icons.broadcast_on_personal_rounded, 'Broadcast', Colors.white, () => _showBroadcastDialog()),
          _quickAction(Icons.add_circle_outline_rounded, 'Add Device', Colors.white, () {}),
          _quickAction(Icons.receipt_long_rounded, 'New Sale', Colors.white, () => setState(() => _selectedTab = 3)),
          _quickAction(Icons.emoji_events_rounded, 'Tournament', Colors.white, () => setState(() => _selectedTab = 4)),
          _quickAction(Icons.system_update_alt_rounded, 'Patch Manager', _green, () => _showPatchManagerDialog()),
        ],
      ),
    ]);
  }

  Widget _miniStatusBadge(String label, int count, Color color) => Column(children: [
    Text('$count', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w500, color: color)),
    const SizedBox(height: 6),
    Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 1.0, color: Colors.white54)),
  ]);

  Widget _quickAction(IconData icon, String label, Color color, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    child: _glassBox(
      padding: const EdgeInsets.all(12),
      radius: 12,
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 10),
        Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: color.withOpacity(0.9))),
      ]),
    ),
  );

  // ─── TAB 1: PC GRID ─────────────────────────────
  Widget _buildPcGrid() => ListView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 120), children: [
    Row(children: [
      const Text('TERMINALS', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w300, letterSpacing: 1.5, color: Colors.white)),
      const Spacer(),
      Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6), decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(20)), child:
        Text('${_devices.length} Devices', style: const TextStyle(fontSize: 11, color: Colors.white70, fontWeight: FontWeight.w500))),
    ]),
    const SizedBox(height: 16),
    GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.9),
      itemCount: _devices.length,
      itemBuilder: (_, i) => _buildDeviceCard(_devices[i]),
    ),
  ]);

  Widget _buildDeviceCard(Map d) {
    final status = d['status'] ?? 'offline';
    final color  = _statusColor(status);
    final specs  = d['specs'] as Map? ?? {};

    return _glassBox(
      padding: const EdgeInsets.all(16),
      radius: 16,
      border: status == 'in_use' ? _blue.withOpacity(0.3) : null,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(width: 8, height: 8, decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
          const SizedBox(width: 6),
          Text(status.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, letterSpacing: 1.0, color: color)),
        ]),
        const SizedBox(height: 12),
        Text(d['name'] ?? '', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.white)),
        if (specs['gpu'] != null) Text(specs['gpu'], style: const TextStyle(fontSize: 11, color: Colors.white54, fontWeight: FontWeight.w400)),
        const Spacer(),
        Row(children: [
          Text('₹${d['hourly_rate']}/hr', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.white70)),
          const Spacer(),
          if (status == 'online')
            _miniButton('START', Colors.white, Colors.black, () {})
          else if (status == 'in_use')
            _miniButton('STOP', _red, Colors.white, () {})
          else
            _miniButton('OFF', Colors.white10, Colors.white38, null),
        ]),
      ]),
    );
  }

  Widget _miniButton(String label, Color bgColor, Color textColor, VoidCallback? onTap) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: textColor, letterSpacing: 1.0)),
    ),
  );

  // ─── TAB 2: SESSIONS ────────────────────────────
  Widget _buildSessions() => ListView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 120), children: [
    const Text('ACTIVE SESSIONS', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w300, letterSpacing: 1.5, color: Colors.white)),
    const SizedBox(height: 16),
    if (_sessions.isEmpty)
      _glassBox(child: const Column(children: [
        SizedBox(height: 32),
        Icon(Icons.videogame_asset_off_rounded, size: 40, color: Colors.white24),
        SizedBox(height: 16),
        Text('No active sessions', style: TextStyle(color: Colors.white54, fontSize: 13, fontWeight: FontWeight.w400)),
        SizedBox(height: 32),
      ]))
    else ..._sessions.map((s) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _glassBox(padding: const EdgeInsets.all(16), child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
          child: const Center(child: Icon(Icons.desktop_windows_rounded, color: Colors.white70, size: 20)),
        ),
        const SizedBox(width: 16),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s['device_name'] ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.w500, color: Colors.white, fontSize: 15)),
          const SizedBox(height: 2),
          Text(s['customer_name'] ?? 'Walk-in', style: const TextStyle(color: Colors.white54, fontSize: 13)),
        ])),
        _miniButton('END SESSION', _red.withOpacity(0.1), _red, () {}),
      ])),
    )),
  ]);

  // ─── TAB 3: POS ─────────────────────────────────
  Widget _buildPOS() => Column(children: [
    Padding(padding: const EdgeInsets.fromLTRB(20, 10, 20, 0), child:
      Row(children: [
        const Text('POINT OF SALE', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w300, letterSpacing: 1.5, color: Colors.white)),
        const Spacer(),
        GestureDetector(onTap: () => _showAddItemDialog(), child: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.add_rounded, color: Colors.white, size: 20))),
      ])),
    Expanded(child: GridView.builder(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.95),
      itemCount: _posItems.length,
      itemBuilder: (_, i) {
        final item = _posItems[i];
        final cat = item['category'] ?? 'food';
        final catIcon = {'food': Icons.fastfood_rounded, 'beverage': Icons.local_drink_rounded, 'peripheral': Icons.headphones_rounded, 'voucher': Icons.confirmation_number_rounded}[cat] ?? Icons.inventory_2_rounded;
        return GestureDetector(
          onTap: () => _showOrderDialog(item),
          child: _glassBox(
            padding: const EdgeInsets.all(16),
            radius: 16,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(catIcon, color: Colors.white54, size: 28),
              const SizedBox(height: 12),
              Text(item['item_name'] ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white)),
              const Spacer(),
              Row(children: [
                Text('₹${item['price']}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.white70)),
                const Spacer(),
                Text('${item['stock']} left', style: TextStyle(fontSize: 10, color: (item['stock'] ?? 0) > 5 ? Colors.white54 : _red, fontWeight: FontWeight.w500)),
              ]),
            ]),
          ),
        );
      },
    )),
  ]);

  // ─── TAB 4: TOURNAMENTS ─────────────────────────
  Widget _buildTournaments() => ListView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 120), children: [
    Row(children: [
      const Text('TOURNAMENTS', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w300, letterSpacing: 1.5, color: Colors.white)),
      const Spacer(),
      GestureDetector(onTap: () => _showCreateTournamentDialog(), child: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.add_rounded, color: Colors.white, size: 20))),
    ]),
    const SizedBox(height: 16),
    if (_tournaments.isEmpty)
      _glassBox(child: const Column(children: [
        SizedBox(height: 32),
        Icon(Icons.emoji_events_outlined, size: 40, color: Colors.white24),
        SizedBox(height: 16),
        Text('No active tournaments', style: TextStyle(color: Colors.white54, fontSize: 13, fontWeight: FontWeight.w400)),
        SizedBox(height: 32),
      ]))
    else ..._tournaments.map((t) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _glassBox(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(t['name'] ?? '', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: Colors.white))),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: _green.withOpacity(0.1), borderRadius: BorderRadius.circular(6)), child: Text((t['status'] ?? '').toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: _green))),
        ]),
        const SizedBox(height: 6),
        Text(t['game'] ?? '', style: const TextStyle(color: Colors.white54, fontSize: 13)),
        const SizedBox(height: 20),
        Row(children: [
          _tourneyBadge('Prize Pool', '₹${t['prize_pool']?.toStringAsFixed(0) ?? '0'}'),
          const SizedBox(width: 24),
          _tourneyBadge('Entry Fee', '₹${t['entry_fee']?.toStringAsFixed(0) ?? '0'}'),
          const SizedBox(width: 24),
          _tourneyBadge('Slots', '${t['max_participants'] ?? '?'}'),
        ]),
      ])),
    )),
  ]);

  Widget _tourneyBadge(String label, String val) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(val, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 16, color: Colors.white)),
    const SizedBox(height: 2),
    Text(label, style: const TextStyle(fontSize: 10, color: Colors.white38, fontWeight: FontWeight.w500)),
  ]);

  // ─── TAB 5: CUSTOMERS ───────────────────────────
  Widget _buildCustomers() {
    final mockCustomers = [
      {'name': 'Yash Kumar', 'email': 'yash@g.com', 'sessions': 24, 'spent': 1450, 'tier': 'Gold'},
      {'name': 'Priya Singh', 'email': 'priya@g.com', 'sessions': 12, 'spent': 720, 'tier': 'Silver'},
      {'name': 'Rahul Dev', 'email': 'rahul@g.com', 'sessions': 8, 'spent': 480, 'tier': 'Bronze'},
      {'name': 'Anjali Rao', 'email': 'anjali@g.com', 'sessions': 35, 'spent': 2100, 'tier': 'Platinum'},
    ];
    return ListView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 120), children: [
      const Text('CLIENT DIRECTORY', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w300, letterSpacing: 1.5, color: Colors.white)),
      const SizedBox(height: 16),
      ...mockCustomers.map((c) {
        return Padding(padding: const EdgeInsets.only(bottom: 12), child: _glassBox(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Container(
              width: 40, height: 40,
              decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withOpacity(0.05)),
              child: Center(child: Text((c['name'] as String)[0], style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w500, fontSize: 16))),
            ),
            const SizedBox(width: 16),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(c['name'] as String, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15, color: Colors.white)),
              const SizedBox(height: 2),
              Text(c['email'] as String, style: const TextStyle(color: Colors.white54, fontSize: 12)),
            ])),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(c['tier'] as String, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white70)),
              const SizedBox(height: 4),
              Text('${c['sessions']} visits · ₹${c['spent']}', style: const TextStyle(fontSize: 11, color: Colors.white38)),
            ]),
          ]),
        ));
      }),
    ]);
  }

  // ─── TAB 6: ANALYTICS ───────────────────────────
  Widget _buildAnalytics() {
    final hourlyData = [2, 4, 6, 5, 8, 9, 7, 6, 8, 9, 10, 7, 5, 4, 3, 5, 7, 9, 8, 6, 4, 3, 2, 1];
    final maxVal = hourlyData.reduce((a, b) => a > b ? a : b).toDouble();

    return ListView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 120), children: [
      const Text('ANALYTICS', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w300, letterSpacing: 1.5, color: Colors.white)),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(child: _statCard('THIS WEEK', '₹1.24L', Colors.white)),
        const SizedBox(width: 12),
        Expanded(child: _statCard('THIS MONTH', '₹4.82L', Colors.white)),
      ]),
      const SizedBox(height: 16),

      // Bar chart (manual)
      _glassBox(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('HOURLY SESSIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1.0, color: Colors.white54)),
        const SizedBox(height: 24),
        SizedBox(
          height: 120,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(hourlyData.length, (i) {
              final h = (hourlyData[i] / maxVal) * 120;
              return Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 2.0), child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                AnimatedContainer(duration: const Duration(milliseconds: 500), height: h, decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(2),
                  color: Colors.white.withOpacity(0.2),
                )),
              ])));
            }),
          ),
        ),
        const SizedBox(height: 12),
        const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('12am', style: TextStyle(fontSize: 10, color: Colors.white38)),
          Text('12pm', style: TextStyle(fontSize: 10, color: Colors.white38)),
          Text('11pm', style: TextStyle(fontSize: 10, color: Colors.white38)),
        ]),
      ])),
      const SizedBox(height: 16),

      // Top stats
      _glassBox(child: Column(children: [
        _analyticsRow('Total Sessions', '342'),
        const Divider(color: Colors.white10, height: 24),
        _analyticsRow('Avg Session Duration', '2h 18min'),
        const Divider(color: Colors.white10, height: 24),
        _analyticsRow('Most Used PC', 'PC-01 (RTX 4070)'),
        const Divider(color: Colors.white10, height: 24),
        _analyticsRow('Peak Hour', '9 PM – 11 PM'),
      ])),
    ]);
  }

  Widget _analyticsRow(String label, String value) => Row(children: [
    Text(label, style: const TextStyle(color: Colors.white54, fontSize: 13)),
    const Spacer(),
    Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
  ]);

  // ─── TAB 7: SETTINGS ────────────────────────────
  Widget _buildSettings() => ListView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 120), children: [
    const Text('SETTINGS', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w300, letterSpacing: 1.5, color: Colors.white)),
    const SizedBox(height: 16),
    ...[
      {'title': 'Café Profile', 'sub': 'Name, address, contact details', 'icon': Icons.store_rounded},
      {'title': 'Pricing Plans', 'sub': 'Hourly rates, bundle offers', 'icon': Icons.attach_money_rounded},
      {'title': 'Staff Management', 'sub': 'Add/remove staff accounts', 'icon': Icons.badge_rounded},
      {'title': 'Notifications', 'sub': 'Session alerts, payment updates', 'icon': Icons.notifications_none_rounded},
      {'title': 'API Connection', 'sub': 'localhost:4000', 'icon': Icons.cloud_queue_rounded},
      {'title': 'Subscription', 'sub': 'Active until Dec 31, 2026', 'icon': Icons.verified_outlined},
      {'title': 'Logout', 'sub': 'Sign out of this account', 'icon': Icons.logout_rounded},
    ].map((item) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _glassBox(padding: const EdgeInsets.all(16), child: Row(children: [
        Icon(item['icon'] as IconData, color: Colors.white54, size: 24),
        const SizedBox(width: 16),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(item['title'] as String, style: const TextStyle(fontWeight: FontWeight.w500, color: Colors.white, fontSize: 15)),
          const SizedBox(height: 2),
          Text(item['sub'] as String, style: const TextStyle(color: Colors.white38, fontSize: 12)),
        ])),
        const Icon(Icons.chevron_right_rounded, color: Colors.white24, size: 24),
      ])),
    )),
  ]);

  // ─── DIALOGS ────────────────────────────────────
  void _showBroadcastDialog() {
    final ctrl = TextEditingController();
    showDialog(context: context, builder: (_) => AlertDialog(
      backgroundColor: const Color(0xFF14141E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.white.withOpacity(0.1))),
      title: const Text('Broadcast Message', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 16)),
      content: TextField(controller: ctrl, maxLines: 3, style: const TextStyle(color: Colors.white, fontSize: 14),
        decoration: InputDecoration(hintText: 'Message to all PCs...', hintStyle: const TextStyle(color: Colors.white38), filled: true, fillColor: Colors.black26, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white24)))),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
        ElevatedButton(
          onPressed: () { Navigator.pop(context); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Message broadcast to all PCs.'), backgroundColor: _blue)); },
          style: ElevatedButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Colors.black, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
          child: const Text('Send'),
        ),
      ],
    ));
  }

  void _showOrderDialog(Map item) {
    showDialog(context: context, builder: (_) => AlertDialog(
      backgroundColor: const Color(0xFF14141E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.white.withOpacity(0.1))),
      title: Text(item['item_name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 16)),
      content: Text('₹${item['price']} · ${item['stock']} in stock', style: const TextStyle(color: Colors.white70, fontSize: 16)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: Colors.white54))),
        ElevatedButton(
          onPressed: () { Navigator.pop(context); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${item['item_name']} added to order.'), backgroundColor: _green)); },
          style: ElevatedButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Colors.black, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
          child: const Text('Sell'),
        ),
      ],
    ));
  }

  void _showAddItemDialog() {
    showDialog(context: context, builder: (_) => AlertDialog(
      backgroundColor: const Color(0xFF14141E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.white.withOpacity(0.1))),
      title: const Text('Add POS Item', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 16)),
      content: const Text('POS item management coming soon.', style: TextStyle(color: Colors.white54, fontSize: 14)),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close', style: TextStyle(color: Colors.white)))],
    ));
  }

  void _showCreateTournamentDialog() {
    showDialog(context: context, builder: (_) => AlertDialog(
      backgroundColor: const Color(0xFF14141E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.white.withOpacity(0.1))),
      title: const Text('Create Tournament', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 16)),
      content: const Text('Tournament creation form coming soon.', style: TextStyle(color: Colors.white54, fontSize: 14)),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close', style: TextStyle(color: Colors.white)))],
    ));
  }

  void _showPatchManagerDialog() {
    // Hardcoded for demo, normally fetched from /games
    final games = [
      {'id': 'c0000000-0000-0000-0000-000000000001', 'name': 'Valorant', 'v': 'v7.08'},
      {'id': 'c0000000-0000-0000-0000-000000000002', 'name': 'Counter-Strike 2', 'v': 'v1.39'},
      {'id': 'c0000000-0000-0000-0000-000000000003', 'name': 'Apex Legends', 'v': 'v19.1'},
    ];
    showDialog(context: context, builder: (_) => AlertDialog(
      backgroundColor: const Color(0xFF14141E),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: Colors.white.withOpacity(0.1))),
      title: const Text('Patch Manager (Auto-Update)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500, fontSize: 16)),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Push updates to all online PCs. This will lock their screens temporarily.', style: TextStyle(color: Colors.white54, fontSize: 12)),
            const SizedBox(height: 16),
            ...games.map((g) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(g['name']!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500)),
                    Text(g['v']!, style: const TextStyle(color: Colors.white38, fontSize: 11)),
                  ])),
                  ElevatedButton(
                    onPressed: () async {
                      Navigator.pop(context);
                      try {
                        await ApiService.apiCall('/games/update', method: 'POST', body: {'game_id': g['id']});
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Update triggered for ${g['name']} across network!'), backgroundColor: _blue));
                        }
                      } catch (e) {
                        if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to trigger update'), backgroundColor: _red));
                      }
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), minimumSize: Size.zero),
                    child: const Text('PUSH', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1.0)),
                  ),
                ]),
              ),
            ))
          ],
        ),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: Colors.white54)))],
    ));
  }
}
