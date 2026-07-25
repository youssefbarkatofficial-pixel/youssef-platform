class Question {
  final String id;
  final String text;
  final List<String> options;
  final String correctAnswer;
  final String category;
  final String difficulty;

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
  static List<Question> getActiveQuestions() {
    final list = [..._allQuestions];
    list.shuffle();
    return list.take(10).toList(); // 10 أسئلة عشوائية في كل جولة
  }

  static List<Question> getTrainingQuestions(String difficulty) {
    return _allQuestions
        .where((q) => q.difficulty == difficulty)
        .toList()
      ..shuffle();
  }

  static final List<Question> _allQuestions = [
    // === تاريخ - سهل ===
    Question(
      id: 'h1',
      text: 'من هو الملك الفرعوني الذي وحّد القطرين (مملكتي الشمال والجنوب)؟',
      options: ['أحمس', 'مينا (نعرمر)', 'توت عنخ آمون', 'رمسيس الثاني'],
      correctAnswer: 'مينا (نعرمر)',
      category: 'history',
      difficulty: 'easy',
    ),
    Question(
      id: 'h2',
      text: 'في أي عام تمت تأسيس الدولة المصرية الحديثة على يد محمد علي؟',
      options: ['1805', '1820', '1798', '1840'],
      correctAnswer: '1805',
      category: 'history',
      difficulty: 'easy',
    ),
    Question(
      id: 'h3',
      text: 'من قاد الجيش المصري في معركة عين جالوت عام 1260 م؟',
      options: ['صلاح الدين الأيوبي', 'قطز وبيبرس', 'نور الدين زنكي', 'المعز لدين الله'],
      correctAnswer: 'قطز وبيبرس',
      category: 'history',
      difficulty: 'easy',
    ),
    Question(
      id: 'h4',
      text: 'متى بدأت الحملة الفرنسية على مصر بقيادة نابليون بونابرت؟',
      options: ['1798', '1801', '1805', '1820'],
      correctAnswer: '1798',
      category: 'history',
      difficulty: 'easy',
    ),
    Question(
      id: 'h5',
      text: 'ما اسم الأسرة الفرعونية التي بنت أهرام الجيزة؟',
      options: ['الأسرة الرابعة', 'الأسرة الثانية عشرة', 'الأسرة الثامنة عشرة', 'الأسرة الحادية والعشرين'],
      correctAnswer: 'الأسرة الرابعة',
      category: 'history',
      difficulty: 'easy',
    ),
    Question(
      id: 'h6',
      text: 'من أسس مدينة الإسكندرية؟',
      options: ['بطليموس الأول', 'الإسكندر الأكبر', 'يوليوس قيصر', 'كليوباترا'],
      correctAnswer: 'الإسكندر الأكبر',
      category: 'history',
      difficulty: 'easy',
    ),
    // === تاريخ - متوسط ===
    Question(
      id: 'h7',
      text: 'متى تم افتتاح قناة السويس للملاحة لأول مرة؟',
      options: ['1869', '1882', '1956', '1973'],
      correctAnswer: '1869',
      category: 'history',
      difficulty: 'medium',
    ),
    Question(
      id: 'h8',
      text: 'ما عاصمة مصر في عصر الدولة الأيوبية؟',
      options: ['الفسطاط', 'القطائع', 'العسكر', 'القاهرة'],
      correctAnswer: 'القاهرة',
      category: 'history',
      difficulty: 'medium',
    ),
    Question(
      id: 'h9',
      text: 'من أصدر وعد بلفور عام 1917 م؟',
      options: ['وزير الخارجية البريطاني', 'الرئيس الأمريكي', 'الاتحاد السوفيتي', 'عصبة الأمم'],
      correctAnswer: 'وزير الخارجية البريطاني',
      category: 'history',
      difficulty: 'medium',
    ),
    Question(
      id: 'h10',
      text: 'في أي معركة هزم العرب البيزنطيين وفتحوا بلاد الشام؟',
      options: ['معركة بدر', 'معركة اليرموك', 'معركة القادسية', 'معركة حطين'],
      correctAnswer: 'معركة اليرموك',
      category: 'history',
      difficulty: 'medium',
    ),
    Question(
      id: 'h11',
      text: 'في أي عام تأسست جامعة القاهرة (المصرية سابقاً)؟',
      options: ['1908', '1919', '1925', '1952'],
      correctAnswer: '1908',
      category: 'history',
      difficulty: 'medium',
    ),
    Question(
      id: 'h12',
      text: 'من قاد ثورة 1919 في مصر؟',
      options: ['مصطفى كامل', 'محمد فريد', 'سعد زغلول', 'أحمد عرابي'],
      correctAnswer: 'سعد زغلول',
      category: 'history',
      difficulty: 'medium',
    ),
    // === تاريخ - صعب ===
    Question(
      id: 'h13',
      text: 'ما لقب الملك المصري الذي وقع معاهدة قادش مع الحيثيين؟',
      options: ['رمسيس الثاني', 'تحتمس الثالث', 'أمنحوتب الثالث', 'سيتي الأول'],
      correctAnswer: 'رمسيس الثاني',
      category: 'history',
      difficulty: 'hard',
    ),
    Question(
      id: 'h14',
      text: 'أيُّ خليفة عباسي أرسل الجيوش لهزيمة الدولة الأموية في الأندلس؟',
      options: ['هارون الرشيد', 'المنصور', 'المأمون', 'المتوكل'],
      correctAnswer: 'المنصور',
      category: 'history',
      difficulty: 'hard',
    ),
    Question(
      id: 'h15',
      text: 'ما اسم المعركة التي أوقفت الزحف العثماني في أوروبا عام 1683 م؟',
      options: ['معركة موهاكس', 'معركة فيينا', 'معركة ليبانتو', 'معركة ألبا ريجيا'],
      correctAnswer: 'معركة فيينا',
      category: 'history',
      difficulty: 'hard',
    ),
    // === جغرافيا - سهل ===
    Question(
      id: 'g1',
      text: 'أي بحر يقع في شرق مصر؟',
      options: ['البحر المتوسط', 'البحر الأحمر', 'بحر العرب', 'البحر الميت'],
      correctAnswer: 'البحر الأحمر',
      category: 'geography',
      difficulty: 'easy',
    ),
    Question(
      id: 'g2',
      text: 'أين توجد بحيرة ناصر؟',
      options: ['شمال مصر', 'شرق مصر', 'جنوب مصر', 'غرب مصر'],
      correctAnswer: 'جنوب مصر',
      category: 'geography',
      difficulty: 'easy',
    ),
    Question(
      id: 'g3',
      text: 'ما هو أطول نهر في العالم؟',
      options: ['نهر الأمازون', 'نهر النيل', 'نهر المسيسيبي', 'نهر اليانغتسي'],
      correctAnswer: 'نهر النيل',
      category: 'geography',
      difficulty: 'easy',
    ),
    Question(
      id: 'g4',
      text: 'ما هي أكبر قارة في العالم من حيث المساحة؟',
      options: ['أفريقيا', 'أمريكا الشمالية', 'آسيا', 'أوروبا'],
      correctAnswer: 'آسيا',
      category: 'geography',
      difficulty: 'easy',
    ),
    Question(
      id: 'g5',
      text: 'كم يبلغ طول قناة السويس تقريباً؟',
      options: ['100 كم', '160 كم', '200 كم', '250 كم'],
      correctAnswer: '160 كم',
      category: 'geography',
      difficulty: 'easy',
    ),
    Question(
      id: 'g6',
      text: 'ما العاصمة الأعلى ارتفاعاً فوق مستوى البحر في العالم؟',
      options: ['كيتو', 'لاباز', 'أديس أبابا', 'نيروبي'],
      correctAnswer: 'لاباز',
      category: 'geography',
      difficulty: 'easy',
    ),
    // === جغرافيا - متوسط ===
    Question(
      id: 'g7',
      text: 'أي مضيق يفصل بين قارتي أفريقيا وأوروبا؟',
      options: ['مضيق هرمز', 'مضيق جبل طارق', 'مضيق باب المندب', 'مضيق ملقا'],
      correctAnswer: 'مضيق جبل طارق',
      category: 'geography',
      difficulty: 'medium',
    ),
    Question(
      id: 'g8',
      text: 'ما المحيط الذي تقع فيه جزر هاواي؟',
      options: ['الأطلسي', 'الهندي', 'الهادئ (الباسيفيك)', 'المتجمد الشمالي'],
      correctAnswer: 'الهادئ (الباسيفيك)',
      category: 'geography',
      difficulty: 'medium',
    ),
    Question(
      id: 'g9',
      text: 'كم عدد المحافظات في جمهورية مصر العربية؟',
      options: ['25', '27', '29', '31'],
      correctAnswer: '27',
      category: 'geography',
      difficulty: 'medium',
    ),
    Question(
      id: 'g10',
      text: 'أين تقع صحراء الربع الخالي؟',
      options: ['ليبيا وتونس', 'السعودية واليمن وعُمان والإمارات', 'الجزائر والمغرب', 'مصر والسودان'],
      correctAnswer: 'السعودية واليمن وعُمان والإمارات',
      category: 'geography',
      difficulty: 'medium',
    ),
    Question(
      id: 'g11',
      text: 'ما هو أعلى جبل في أفريقيا؟',
      options: ['جبل كيليمنجارو', 'جبل كينيا', 'جبل الرواة', 'جبل توبقال'],
      correctAnswer: 'جبل كيليمنجارو',
      category: 'geography',
      difficulty: 'medium',
    ),
    Question(
      id: 'g12',
      text: 'ما العاصمة الإدارية الجديدة لمصر؟',
      options: ['السادات', 'العاشر من رمضان', 'العاصمة الإدارية الجديدة', '6 أكتوبر'],
      correctAnswer: 'العاصمة الإدارية الجديدة',
      category: 'geography',
      difficulty: 'medium',
    ),
    // === جغرافيا - صعب ===
    Question(
      id: 'g13',
      text: 'ما مساحة مصر تقريباً بالكيلومتر المربع؟',
      options: ['750,000', '1,000,000', '1,500,000', '500,000'],
      correctAnswer: '1,000,000',
      category: 'geography',
      difficulty: 'hard',
    ),
    Question(
      id: 'g14',
      text: 'أيُّ مدينة مصرية تقع عند التقاء نهر النيل بالبحر المتوسط (الدلتا الشرقية)؟',
      options: ['الإسكندرية', 'دمياط', 'بورسعيد', 'رشيد'],
      correctAnswer: 'دمياط',
      category: 'geography',
      difficulty: 'hard',
    ),
    Question(
      id: 'g15',
      text: 'ما هي الدولة التي تحتل المرتبة الأولى عالمياً في إنتاج القمح؟',
      options: ['الولايات المتحدة', 'روسيا', 'الصين', 'الهند'],
      correctAnswer: 'الصين',
      category: 'geography',
      difficulty: 'hard',
    ),
  ];
}
