import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/services.dart';
import 'dart:math';
import '../theme/app_theme.dart';
import '../models/rank_system.dart';
import '../data/questions_database.dart';
import 'battle_screen.dart';

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key});

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen>
    with SingleTickerProviderStateMixin {
  String playerName = '...';
  int currentXp = 0;
  int wins = 0;
  int losses = 0;
  bool _isLoading = true;
  late AnimationController _animController;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim =
        Tween<double>(begin: 0.95, end: 1.05).animate(_animController);
    _loadPlayerData();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadPlayerData() async {
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(user.uid)
            .get();
        if (doc.exists && mounted) {
          final data = doc.data()!;
          setState(() {
            playerName = data['name'] ?? data['displayName'] ?? user.displayName ?? 'لاعب';
            currentXp = (data['gameXp'] ?? data['xp'] ?? 0) as int;
            wins = (data['gameWins'] ?? 0) as int;
            losses = (data['gameLosses'] ?? 0) as int;
            _isLoading = false;
          });
        } else {
          setState(() {
            playerName = user.displayName ?? 'لاعب';
            _isLoading = false;
          });
        }
      } else {
        setState(() {
          playerName = 'زائر';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        playerName = 'لاعب';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final rank = RankSystem.getRankForXp(currentXp);
    final progress = RankSystem.getProgressToNextRank(currentXp);
    final nextRank = RankSystem.getNextRankTitle(currentXp);
    final totalGames = wins + losses;
    final winRate =
        totalGames > 0 ? ((wins / totalGames) * 100).toStringAsFixed(0) : '0';

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0A0E1A), Color(0xFF1E293B)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    color: AppTheme.brushedGold,
                  ),
                )
              : Column(
                  children: [
                    _buildTopBar(rank, progress, nextRank),
                    Expanded(
                      child: _buildStatsArea(winRate, totalGames),
                    ),
                    _buildBottomActionArea(),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildTopBar(Rank rank, double progress, String nextRank) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A).withOpacity(0.95),
        border: const Border(
            bottom: BorderSide(color: AppTheme.brushedGold, width: 1.5)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              _buildAvatar(),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      playerName,
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textWhite),
                    ),
                    Row(
                      children: [
                        const Icon(Icons.military_tech,
                            color: AppTheme.warmAmber, size: 16),
                        const SizedBox(width: 4),
                        Text(rank.title,
                            style: const TextStyle(
                                fontSize: 14, color: AppTheme.warmAmber)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        backgroundColor: const Color(0xFF334155),
                        color: AppTheme.brushedGold,
                        minHeight: 6,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '$currentXp XP',
                          style: const TextStyle(
                              fontSize: 11, color: AppTheme.mutedText),
                        ),
                        Text(
                          'التالي: $nextRank',
                          style: const TextStyle(
                              fontSize: 11, color: AppTheme.mutedText),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar() {
    final initials = playerName.isNotEmpty
        ? playerName.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join()
        : '؟';
    return CircleAvatar(
      radius: 34,
      backgroundColor: const Color(0xFF1E3A5F),
      child: CircleAvatar(
        radius: 32,
        backgroundColor: AppTheme.brushedGold,
        child: Text(
          initials,
          style: const TextStyle(
              color: AppTheme.deepBlack,
              fontSize: 22,
              fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildStatsArea(String winRate, int totalGames) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Title
          const Text(
            '⚔️ إحصائياتك',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: AppTheme.brushedGold,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 24),
          // Stats Cards Grid
          Row(
            children: [
              Expanded(
                child: _statCard(
                  icon: Icons.emoji_events,
                  iconColor: const Color(0xFFFFD700),
                  label: 'انتصارات',
                  value: '$wins',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _statCard(
                  icon: Icons.close_rounded,
                  iconColor: Colors.redAccent,
                  label: 'هزائم',
                  value: '$losses',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _statCard(
                  icon: Icons.percent,
                  iconColor: Colors.greenAccent,
                  label: 'نسبة الفوز',
                  value: '$winRate%',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _statCard(
                  icon: Icons.sports_esports,
                  iconColor: AppTheme.warmAmber,
                  label: 'إجمالي المباريات',
                  value: '$totalGames',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // XP Big Card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E3A5F), Color(0xFF0F172A)],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.brushedGold.withOpacity(0.5)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ScaleTransition(
                  scale: _pulseAnim,
                  child: const Icon(Icons.bolt,
                      color: AppTheme.brushedGold, size: 36),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$currentXp نقطة XP',
                      style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.brushedGold),
                    ),
                    const Text(
                      'نقاط الأثر المتراكمة',
                      style: TextStyle(
                          fontSize: 13, color: AppTheme.mutedText),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statCard({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        children: [
          Icon(icon, color: iconColor, size: 28),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppTheme.textWhite),
          ),
          const SizedBox(height: 4),
          Text(label,
              style:
                  const TextStyle(fontSize: 12, color: AppTheme.mutedText)),
        ],
      ),
    );
  }

  Widget _buildBottomActionArea() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
      decoration: const BoxDecoration(
        color: Color(0xFF0A0E1A),
        border:
            Border(top: BorderSide(color: AppTheme.brushedGold, width: 1)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Main Battle Button
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (context) => BattleScreen(
                            mode: BattleMode.ranked,
                            playerName: playerName,
                            initialXp: currentXp,
                          )),
                ).then((_) => _loadPlayerData());
              },
              icon: const Icon(Icons.bolt, size: 22),
              label: const Text(
                'مواجهة جديدة (Compass Conflict)',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.brushedGold,
                foregroundColor: AppTheme.deepBlack,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _openTrainingMode(),
                  icon: const Icon(Icons.fitness_center, size: 18),
                  label: const Text('التدريب'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.warmAmber,
                    side: const BorderSide(color: AppTheme.warmAmber),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _openFriendsRoom(),
                  icon: const Icon(Icons.group, size: 18),
                  label: const Text('غرفة الأصدقاء'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.textWhite,
                    side: const BorderSide(color: Color(0xFF334155)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _openTrainingMode() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'اختر مستوى التدريب',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.brushedGold),
            ),
            const SizedBox(height: 24),
            _difficultyButton(ctx, 'سهل 🟢', 'easy', Colors.green),
            const SizedBox(height: 12),
            _difficultyButton(ctx, 'متوسط 🟡', 'medium', AppTheme.warmAmber),
            const SizedBox(height: 12),
            _difficultyButton(ctx, 'صعب 🔴', 'hard', Colors.redAccent),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _difficultyButton(
      BuildContext ctx, String label, String difficulty, Color color) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: () {
          Navigator.pop(ctx);
          Navigator.push(
            context,
            MaterialPageRoute(
                builder: (context) => BattleScreen(
                      mode: BattleMode.training,
                      difficulty: difficulty,
                      playerName: playerName,
                      initialXp: currentXp,
                    )),
          ).then((_) => _loadPlayerData());
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: color.withOpacity(0.15),
          foregroundColor: color,
          side: BorderSide(color: color),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child:
            Text(label, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
      ),
    );
  }

  void _openFriendsRoom() {
    final roomCode = _generateRoomCode();
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.group_add, color: AppTheme.brushedGold, size: 48),
            const SizedBox(height: 16),
            const Text('غرفة الأصدقاء',
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textWhite)),
            const SizedBox(height: 8),
            const Text(
              'شارك هذا الكود مع صديقك ليدخل معك',
              style: TextStyle(color: AppTheme.mutedText, fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: roomCode));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('تم نسخ الكود!'),
                      backgroundColor: AppTheme.brushedGold,
                      duration: Duration(seconds: 2)),
                );
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E3A5F),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                      color: AppTheme.brushedGold.withOpacity(0.8), width: 2),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      roomCode,
                      style: const TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.brushedGold,
                          letterSpacing: 8),
                    ),
                    const SizedBox(width: 12),
                    const Icon(Icons.copy, color: AppTheme.mutedText),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text('اضغط على الكود لنسخه',
                style: TextStyle(color: AppTheme.mutedText, fontSize: 12)),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.orange.withOpacity(0.3)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.orange, size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'وضع غرفة الأصدقاء الكاملة قريباً! حالياً يمكنك مشاركة الكود.',
                      style: TextStyle(color: Colors.orange, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  String _generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final random = Random();
    return List.generate(6, (index) => chars[random.nextInt(chars.length)])
        .join();
  }
}
