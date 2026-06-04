class Rank {
  final String title;
  final int requiredXp;

  const Rank(this.title, this.requiredXp);
}

class RankSystem {
  static const String ownerRankTitle = 'حارس البوصلة الأعظم';
  static const String ownerName = 'يوسف بركات';

  // الرتب الرسمية المطلوبة بالتسلسل مع نقاط الـ XP
  static const List<Rank> ranks = [
    Rank('مستكشف ناشئ', 0),
    Rank('حامل البوصلة', 150),
    Rank('قارئ المسارات', 400),
    Rank('حافظ الخرائط', 900),
    Rank('كاشف الآثار', 1700),
    Rank('مؤرخ الحضارات', 3000),
    Rank('قائد الرحلات', 5000),
    Rank('سيد المسارات', 8000),
    Rank('حارس الأطالس', 12000),
    Rank('وريث البوصلة', 17000),
    Rank('أسطورة الخرائط', 25000),
    Rank('سيد القارات', 40000),
  ];

  static Rank getRankForXp(int xp) {
    Rank currentRank = ranks[0];
    for (var rank in ranks) {
      if (xp >= rank.requiredXp) {
        currentRank = rank;
      } else {
        break;
      }
    }
    return currentRank;
  }

  static double getProgressToNextRank(int xp) {
    for (int i = 0; i < ranks.length - 1; i++) {
      if (xp >= ranks[i].requiredXp && xp < ranks[i + 1].requiredXp) {
        int currentRankXp = ranks[i].requiredXp;
        int nextRankXp = ranks[i + 1].requiredXp;
        return (xp - currentRankXp) / (nextRankXp - currentRankXp);
      }
    }
    // إذا وصل لأعلى رتبة
    return 1.0;
  }
}
