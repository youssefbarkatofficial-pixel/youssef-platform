class Question {
  final String id;
  final String text;
  final List<String> options;
  final String correctAnswer;
  final String category; // e.g., 'history' or 'geography'
  final String difficulty; // e.g., 'easy', 'medium', 'hard'

  Question({
    required this.id,
    required this.text,
    required this.options,
    required this.correctAnswer,
    required this.category,
    required this.difficulty,
  });
}

class QuestionsDatabase {
  /// هذه الدالة مصممة خصيصاً لتسهيل استبدال الأسئلة مستقبلاً.
  /// يمكنك في أي وقت طلب استبدال هذا المتغير بأسئلة (الدرس الأول - الوحدة الأولى) وسنستبدلها جراحياً.
  static List<Question> getActiveQuestions() {
    return _demoSocialStudiesQuestions;
  }

  // أسئلة دراسات اجتماعية (تاريخ وجغرافيا) مصرية عامة لاختبار اللعبة
  static final List<Question> _demoSocialStudiesQuestions = [
    Question(
      id: 'q1',
      text: 'من هو الملك الفرعوني الذي وحد القطرين (مملكتي الشمال والجنوب)؟',
      options: ['أحمس', 'مينا (نعرمر)', 'توت عنخ آمون', 'رمسيس الثاني'],
      correctAnswer: 'مينا (نعرمر)',
      category: 'history',
      difficulty: 'easy',
    ),
    Question(
      id: 'q2',
      text: 'أي بحر يقع في شرق مصر؟',
      options: ['البحر المتوسط', 'البحر الأحمر', 'بحر العرب', 'البحر الميت'],
      correctAnswer: 'البحر الأحمر',
      category: 'geography',
      difficulty: 'easy',
    ),
    Question(
      id: 'q3',
      text: 'متى تم افتتاح قناة السويس القديمة للملاحة؟',
      options: ['1869', '1882', '1956', '1973'],
      correctAnswer: '1869',
      category: 'history',
      difficulty: 'medium',
    ),
    Question(
      id: 'q4',
      text: 'ما هي عاصمة مصر في عصر الدولة الأيوبية؟',
      options: ['الفسطاط', 'القطائع', 'العسكر', 'القاهرة'],
      correctAnswer: 'القاهرة',
      category: 'history',
      difficulty: 'hard',
    ),
    Question(
      id: 'q5',
      text: 'أين توجد بحيرة ناصر؟',
      options: ['شمال مصر', 'شرق مصر', 'جنوب مصر', 'غرب مصر'],
      correctAnswer: 'جنوب مصر',
      category: 'geography',
      difficulty: 'easy',
    ),
  ];
}
