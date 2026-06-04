import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../models/rank_system.dart';
import 'battle_screen.dart';

class LobbyScreen extends StatefulWidget {
  const LobbyScreen({super.key});

  @override
  State<LobbyScreen> createState() => _LobbyScreenState();
}

class _LobbyScreenState extends State<LobbyScreen> {
  // Temporary local state to simulate the user profile sync
  final String playerName = 'طالب تجريبي';
  int currentXp = 200; 
  
  @override
  Widget build(BuildContext context) {
    final rank = RankSystem.getRankForXp(currentXp);
    final progress = RankSystem.getProgressToNextRank(currentXp);

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            colors: [Color(0xFF1E293B), AppTheme.deepBlack],
            center: Alignment.center,
            radius: 1.5,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildTopArea(rank, progress),
              const Expanded(
                child: Center(
                  child: Text(
                    'خريطة العالم التفاعلية\n(سيتم إضافة الرسوم المتحركة لاحقاً)',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.mutedText, fontSize: 18),
                  ),
                ),
              ),
              _buildBottomActionArea(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTopArea(Rank rank, double progress) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.darkNavy.withOpacity(0.8),
        border: const Border(bottom: BorderSide(color: AppTheme.brushedGold, width: 2)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: AppTheme.brushedGold,
            child: Text(
              playerName[0],
              style: const TextStyle(color: AppTheme.deepBlack, fontSize: 24, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  playerName,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.textWhite),
                ),
                Text(
                  rank.title,
                  style: const TextStyle(fontSize: 16, color: AppTheme.warmAmber),
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: progress,
                  backgroundColor: AppTheme.deepBlack,
                  color: AppTheme.brushedGold,
                  minHeight: 6,
                ),
                const SizedBox(height: 4),
                Text(
                  '$currentXp نقاط الأثر',
                  style: const TextStyle(fontSize: 12, color: AppTheme.mutedText),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomActionArea() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.darkNavy.withOpacity(0.95),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
      ),
      child: Column(
        children: [
          SizedBox(
            width: double.infinity,
            height: 60,
            child: ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const BattleScreen()),
                );
              },
              child: const Text('مواجهة جديدة (Compass Conflict)'),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.textWhite,
                    side: const BorderSide(color: AppTheme.brushedGold),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('التدريب'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.textWhite,
                    side: const BorderSide(color: AppTheme.mutedText),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('غرفة الأصدقاء'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
