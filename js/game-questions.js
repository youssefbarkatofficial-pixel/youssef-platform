/**
 * صراع البوصلة - قاعدة الأسئلة
 * ملاحظة للمطور: لإضافة أسئلة جديدة، أضف للمصفوفة المناسبة
 * كل سؤال: { id, text, options:[4], correct: index(0-3), category, grade, unit, lesson }
 */

window.GameQuestions = (function() {

  // ============================================================
  // أسئلة عامة (تاريخ)
  // ============================================================
  const historyGeneral = [
    { id:'h1', text:'من هو الملك الفرعوني الذي وحّد القطرين (الشمال والجنوب) لأول مرة؟', options:['رمسيس الثاني','توت عنخ آمون','مينا (نعرمر)','أحمس'], correct:2, category:'history', grade:'general' },
    { id:'h2', text:'في أي عام تمت تأسيس الدولة المصرية الحديثة على يد محمد علي باشا؟', options:['1798','1805','1820','1840'], correct:1, category:'history', grade:'general' },
    { id:'h3', text:'من قاد معركة عين جالوت عام 1260م التي وقفت أمام الزحف المغولي؟', options:['صلاح الدين الأيوبي','المعز لدين الله','قطز وبيبرس','نور الدين زنكي'], correct:2, category:'history', grade:'general' },
    { id:'h4', text:'متى بدأت الحملة الفرنسية على مصر بقيادة نابليون بونابرت؟', options:['1798','1801','1811','1820'], correct:0, category:'history', grade:'general' },
    { id:'h5', text:'أي أسرة فرعونية بنت أهرامات الجيزة الثلاثة العظيمة؟', options:['الأسرة الثامنة عشرة','الأسرة الثانية عشرة','الأسرة الرابعة','الأسرة التاسعة عشرة'], correct:2, category:'history', grade:'general' },
    { id:'h6', text:'من أسس مدينة الإسكندرية عام 332 ق.م؟', options:['بطليموس الأول','يوليوس قيصر','الإسكندر الأكبر','كليوباترا'], correct:2, category:'history', grade:'general' },
    { id:'h7', text:'متى تم افتتاح قناة السويس للملاحة الدولية لأول مرة؟', options:['1856','1869','1882','1956'], correct:1, category:'history', grade:'general' },
    { id:'h8', text:'من قاد ثورة 1919 الشعبية في مصر ضد الاستعمار البريطاني؟', options:['مصطفى كامل','أحمد عرابي','سعد زغلول','محمد فريد'], correct:2, category:'history', grade:'general' },
    { id:'h9', text:'في أي معركة هزم العرب البيزنطيين وفتحوا بلاد الشام نهائياً؟', options:['معركة القادسية','معركة اليرموك','معركة بدر','معركة حطين'], correct:1, category:'history', grade:'general' },
    { id:'h10', text:'من الذي وقّع معاهدة قادش مع الحيثيين، وتُعدّ أقدم معاهدة سلام في التاريخ؟', options:['تحتمس الثالث','أمنحوتب الثالث','رمسيس الثاني','سيتي الأول'], correct:2, category:'history', grade:'general' },
    { id:'h11', text:'ما اسم المعركة التي أوقفت الزحف العثماني نحو أوروبا عام 1683م؟', options:['معركة موهاكس','معركة ليبانتو','معركة فيينا','معركة ألبا ريجيا'], correct:2, category:'history', grade:'general' },
    { id:'h12', text:'في أي عام تأسست جامعة القاهرة (المصرية) رسمياً؟', options:['1900','1908','1919','1925'], correct:1, category:'history', grade:'general' },
    { id:'h13', text:'ما اسم الخليفة الأموي الذي بنى قبة الصخرة في القدس؟', options:['معاوية بن أبي سفيان','يزيد بن معاوية','عبد الملك بن مروان','الوليد بن عبد الملك'], correct:2, category:'history', grade:'general' },
    { id:'h14', text:'من فتح مصر للإسلام في عهد الخليفة عمر بن الخطاب؟', options:['خالد بن الوليد','عمرو بن العاص','سعد بن أبي وقاص','أبو عبيدة'], correct:1, category:'history', grade:'general' },
    { id:'h15', text:'في أي عام أُعلن قيام جمهورية مصر العربية بعد ثورة يوليو؟', options:['1952','1953','1954','1956'], correct:1, category:'history', grade:'general' },
  ];

  // ============================================================
  // أسئلة عامة (جغرافيا)
  // ============================================================
  const geographyGeneral = [
    { id:'g1', text:'أي بحر يقع في الشرق الجغرافي لمصر؟', options:['البحر المتوسط','البحر الأحمر','بحر العرب','البحر الميت'], correct:1, category:'geography', grade:'general' },
    { id:'g2', text:'أين تقع بحيرة ناصر من مصر؟', options:['الشمال','الشرق','الجنوب','الغرب'], correct:2, category:'geography', grade:'general' },
    { id:'g3', text:'ما هو أطول أنهار العالم من حيث المسافة الإجمالية؟', options:['نهر الأمازون','نهر المسيسيبي','نهر اليانغتسي','نهر النيل'], correct:3, category:'geography', grade:'general' },
    { id:'g4', text:'ما هي أكبر قارات العالم من حيث المساحة الإجمالية؟', options:['أفريقيا','أمريكا الشمالية','أوروبا','آسيا'], correct:3, category:'geography', grade:'general' },
    { id:'g5', text:'كم يبلغ طول قناة السويس تقريباً؟', options:['100 كم','160 كم','200 كم','250 كم'], correct:1, category:'geography', grade:'general' },
    { id:'g6', text:'أي مضيق يفصل بين قارتي أفريقيا وأوروبا؟', options:['مضيق هرمز','مضيق باب المندب','مضيق جبل طارق','مضيق ملقا'], correct:2, category:'geography', grade:'general' },
    { id:'g7', text:'ما المحيط الذي تقع فيه جزر هاواي الأمريكية؟', options:['المحيط الأطلسي','المحيط الهندي','المحيط الهادئ','المحيط المتجمد'], correct:2, category:'geography', grade:'general' },
    { id:'g8', text:'كم عدد المحافظات في جمهورية مصر العربية حالياً؟', options:['24','25','27','29'], correct:2, category:'geography', grade:'general' },
    { id:'g9', text:'ما أعلى قمة جبلية في القارة الأفريقية؟', options:['جبل كينيا','جبل كيليمنجارو','جبل الرواة','جبل توبقال'], correct:1, category:'geography', grade:'general' },
    { id:'g10', text:'أين تقع صحراء الربع الخالي؟', options:['شمال أفريقيا','شبه الجزيرة العربية','إيران والعراق','آسيا الوسطى'], correct:1, category:'geography', grade:'general' },
    { id:'g11', text:'ما مساحة مصر التقريبية بالكيلومتر المربع؟', options:['500,000','750,000','1,000,000','1,500,000'], correct:2, category:'geography', grade:'general' },
    { id:'g12', text:'أي نهر ينبع من أفريقيا ويصبّ في البحر الأبيض المتوسط؟', options:['نهر الكونغو','نهر نيجر','نهر زامبيزي','نهر النيل'], correct:3, category:'geography', grade:'general' },
    { id:'g13', text:'ما العاصمة الأعلى ارتفاعاً فوق مستوى البحر في العالم؟', options:['كيتو','بوغوتا','لاباز','أديس أبابا'], correct:2, category:'geography', grade:'general' },
    { id:'g14', text:'في أي قارة تقع دولة البرازيل؟', options:['أمريكا الشمالية','أمريكا الوسطى','أمريكا الجنوبية','الكاريبي'], correct:2, category:'geography', grade:'general' },
    { id:'g15', text:'ما الدولة التي تعبر منها نقطة خط غرينتش الصفر (خط الطول 0)؟', options:['فرنسا فقط','إنجلترا وعدة دول','إسبانيا فقط','البرتغال فقط'], correct:1, category:'geography', grade:'general' },
    { id:'g16', text:'أي دولة تمتلك أطول ساحل بحري في العالم؟', options:['روسيا','أستراليا','كندا','الولايات المتحدة'], correct:2, category:'geography', grade:'general' },
    { id:'g17', text:'ما اسم الصحراء الكبرى الموجودة في شمال أفريقيا؟', options:['صحراء ناميب','صحراء كالاهاري','الصحراء الكبرى','صحراء أوغادين'], correct:2, category:'geography', grade:'general' },
    { id:'g18', text:'في أي قارة يقع نهر الأمازون الأطول من حيث التصريف المائي؟', options:['أفريقيا','آسيا','أمريكا الجنوبية','أمريكا الشمالية'], correct:2, category:'geography', grade:'general' },
  ];

  // ============================================================
  // أسئلة الصف الأول الإعدادي
  // ============================================================
  const grade7 = {
    history: [
      { id:'g7h1', text:'ما اسم الكتابة الهيروغليفية التي استخدمها قدماء المصريين؟', options:['الكتابة المسمارية','الكتابة الهيراطيقية','الكتابة الهيروغليفية','الكتابة الديموطيقية'], correct:2, category:'history', grade:'7', unit:'1', lesson:'1' },
      { id:'g7h2', text:'ما الاسم الذي أطلقه المصريون القدماء على أرضهم؟', options:['بلاد الرافدين','كيمت (الأرض السوداء)','أرض فينيقيا','بلاد النيل'], correct:1, category:'history', grade:'7', unit:'1', lesson:'1' },
      { id:'g7h3', text:'ما الاسم الذي أطلقه اليونانيون القدماء على مصر؟', options:['نيلوتيكا','إيجيبتوس','فاراونيكا','ميمفيس'], correct:1, category:'history', grade:'7', unit:'1', lesson:'1' },
      { id:'g7h4', text:'كم عدد الأسر الفرعونية في التاريخ المصري القديم؟', options:['20','26','30','31'], correct:3, category:'history', grade:'7', unit:'1', lesson:'2' },
      { id:'g7h5', text:'ما اسم عاصمة مصر في عهد الدولة الوسطى؟', options:['منف','طيبة (الأقصر)','هليوبوليس','أخيتاتون'], correct:1, category:'history', grade:'7', unit:'1', lesson:'2' },
    ],
    geography: [
      { id:'g7g1', text:'ما موقع مصر الفلكي تقريباً (خطوط العرض)؟', options:['22°-32° شمال','10°-30° شمال','22°-37° شمال','15°-30° شمال'], correct:0, category:'geography', grade:'7', unit:'1', lesson:'1' },
      { id:'g7g2', text:'كم عدد الدول التي تحد مصر؟', options:['2','3','4','5'], correct:2, category:'geography', grade:'7', unit:'1', lesson:'1' },
      { id:'g7g3', text:'ما البحر الذي يحد مصر من الشمال؟', options:['البحر الأحمر','بحر العرب','البحر الأبيض المتوسط','البحر الميت'], correct:2, category:'geography', grade:'7', unit:'1', lesson:'1' },
      { id:'g7g4', text:'أي صحراء تشغل معظم مساحة مصر من الغرب؟', options:['الصحراء الشرقية','سيناء','الصحراء الغربية','النوبة'], correct:2, category:'geography', grade:'7', unit:'1', lesson:'2' },
    ]
  };

  // ============================================================
  // أسئلة الصف الثاني الإعدادي
  // ============================================================
  const grade8 = {
    history: [
      { id:'g8h1', text:'من فتح مصر في العصر الإسلامي عام 641م؟', options:['خالد بن الوليد','سعد بن أبي وقاص','عمرو بن العاص','شرحبيل بن حسنة'], correct:2, category:'history', grade:'8', unit:'1', lesson:'1' },
      { id:'g8h2', text:'ما اسم المدينة التي أسسها عمرو بن العاص بعد فتح مصر؟', options:['القاهرة','الإسكندرية','الفسطاط','العسكر'], correct:2, category:'history', grade:'8', unit:'1', lesson:'1' },
      { id:'g8h3', text:'من أسس مدينة القاهرة عام 969م؟', options:['أحمد بن طولون','محمد علي','جوهر الصقلي','الفاطميون'], correct:2, category:'history', grade:'8', unit:'1', lesson:'2' },
      { id:'g8h4', text:'في عهد أي خليفة فتح العرب مصر؟', options:['أبو بكر الصديق','عمر بن الخطاب','عثمان بن عفان','علي بن أبي طالب'], correct:1, category:'history', grade:'8', unit:'1', lesson:'1' },
    ],
    geography: [
      { id:'g8g1', text:'ما أهم الموارد الطبيعية التي يوفرها نهر النيل لمصر؟', options:['البترول','الطاقة الكهربائية والمياه','المعادن','الثروة السمكية فقط'], correct:1, category:'geography', grade:'8', unit:'1', lesson:'1' },
      { id:'g8g2', text:'كيف تُصنَّف مصر جغرافياً من حيث الموقع؟', options:['دولة داخلية','دولة ساحلية فقط','دولة في قلب العالم القديم','دولة جزيرة'], correct:2, category:'geography', grade:'8', unit:'1', lesson:'1' },
    ]
  };

  // ============================================================
  // أسئلة الصف الثالث الإعدادي
  // ============================================================
  const grade9 = {
    history: [
      { id:'g9h1', text:'ما اسم الحملة العسكرية التي أرسلها نابليون على مصر عام 1798م؟', options:['الحملة الإيطالية','الحملة الفرنسية','الحملة الشرقية','الحملة العثمانية'], correct:1, category:'history', grade:'9', unit:'1', lesson:'1' },
      { id:'g9h2', text:'كيف انتهت الحملة الفرنسية على مصر؟', options:['انسحبت طوعاً','هُزمت في أبو قير','أُجبرت على الرحيل باتفاقية مع إنجلترا وعثمانيا','استمرت حتى اليوم'], correct:2, category:'history', grade:'9', unit:'1', lesson:'1' },
      { id:'g9h3', text:'من تولى حكم مصر بعد رحيل الحملة الفرنسية وأسس الدولة المصرية الحديثة؟', options:['خورشيد باشا','علي بك الكبير','محمد علي باشا','عباس حلمي'], correct:2, category:'history', grade:'9', unit:'1', lesson:'2' },
    ],
    geography: [
      { id:'g9g1', text:'ما التحديات التي تواجه الزراعة المصرية حالياً؟', options:['وفرة المياه','شح المياه وتملح التربة وتآكل الأراضي','برودة الطقس','ارتفاع خصوبة التربة'], correct:1, category:'geography', grade:'9', unit:'1', lesson:'1' },
      { id:'g9g2', text:'ما أبرز مشاريع مصر لتوسيع الرقعة الزراعية؟', options:['مشروع توشكى ومشروع الدلتا الجديدة','مشروع النيل الأزرق فقط','مشروع خليج السويس','مشروع سيناء الصغير'], correct:0, category:'geography', grade:'9', unit:'1', lesson:'2' },
    ]
  };

  // ============================================================
  // أسئلة الصف الأول الثانوي
  // ============================================================
  const grade10 = {
    history: [
      { id:'g10h1', text:'ما الحضارة التي نشأت في وادي الرافدين (بين النهرين)؟', options:['الحضارة الفرعونية','الحضارة الرومانية','الحضارة البابلية والآشورية','الحضارة اليونانية'], correct:2, category:'history', grade:'10', unit:'1', lesson:'1' },
      { id:'g10h2', text:'ما اسم أشهر ملك بابلي وضع أول مجموعة قوانين مدوّنة؟', options:['نبوخذ نصر','حمورابي','سرجون الأكدي','أشور بانيبال'], correct:1, category:'history', grade:'10', unit:'1', lesson:'1' },
      { id:'g10h3', text:'ما الحضارة التي أبدعت في الأبجدية التي نستخدمها اليوم بشكل غير مباشر؟', options:['الحضارة المصرية','الحضارة الفينيقية','الحضارة اليونانية','الحضارة الرومانية'], correct:1, category:'history', grade:'10', unit:'1', lesson:'2' },
    ],
    geography: [
      { id:'g10g1', text:'ما القارة التي تمتلك أكبر احتياطي من الغاز الطبيعي في العالم؟', options:['أمريكا الشمالية','آسيا','أوروبا','أفريقيا'], correct:1, category:'geography', grade:'10', unit:'1', lesson:'1' },
      { id:'g10g2', text:'كيف تؤثر التضاريس (الجبال والسهول) على توزيع السكان؟', options:['لا تأثير لها','السكان يتمركزون في الجبال','السكان يفضلون السهول والأودية','السكان يفضلون الصحاري'], correct:2, category:'geography', grade:'10', unit:'1', lesson:'1' },
    ]
  };

  // ============================================================
  // دوال مساعدة
  // ============================================================

  /**
   * الحصول على أسئلة بناءً على الفلاتر
   * @param {string} subject - 'history' | 'geography' | 'mixed'
   * @param {string} grade - 'general' | '7' | '8' | '9' | '10'
   * @param {string} unit - رقم الوحدة (اختياري)
   * @param {string} lesson - رقم الدرس (اختياري)
   * @param {number} count - عدد الأسئلة المطلوبة
   */
  function getQuestions({ subject='mixed', grade='general', unit=null, lesson=null, count=7 }) {
    let pool = [];

    if (grade === 'general') {
      if (subject === 'history') pool = [...historyGeneral];
      else if (subject === 'geography') pool = [...geographyGeneral];
      else pool = [...historyGeneral, ...geographyGeneral];
    } else {
      const gradeData = { '7': grade7, '8': grade8, '9': grade9, '10': grade10 }[grade];
      if (!gradeData) return getQuestions({ subject, grade:'general', count });

      let h = gradeData.history || [];
      let g = gradeData.geography || [];

      // فلتر بالوحدة والدرس
      if (unit) {
        h = h.filter(q => q.unit === unit);
        g = g.filter(q => q.unit === unit);
      }
      if (lesson) {
        h = h.filter(q => q.lesson === lesson);
        g = g.filter(q => q.lesson === lesson);
      }

      if (subject === 'history') pool = h;
      else if (subject === 'geography') pool = g;
      else pool = [...h, ...g];

      // لو الأسئلة قليلة، ندمج مع العامة
      if (pool.length < count) {
        const extra = getQuestions({ subject, grade:'general', count: count - pool.length });
        pool = [...pool, ...extra];
      }
    }

    // خلط عشوائي
    pool = shuffle(pool);
    const result = [];
    while (result.length < count && pool.length > 0) {
      const remaining = count - result.length;
      result.push(...pool.slice(0, Math.min(remaining, pool.length)));
      pool = shuffle(pool); // Re-shuffle for variety
    }
    return result;
  }

  /**
   * الحصول على وحدات وليسونز متاحة للصف
   */
  function getLessonsForGrade(grade, subject) {
    const gradeData = { '7': grade7, '8': grade8, '9': grade9, '10': grade10 }[grade];
    if (!gradeData) return { units: [], lessons: {} };

    let questions = [];
    if (subject === 'history') questions = gradeData.history || [];
    else if (subject === 'geography') questions = gradeData.geography || [];
    else questions = [...(gradeData.history || []), ...(gradeData.geography || [])];

    const units = [...new Set(questions.map(q => q.unit).filter(Boolean))];
    const lessons = {};
    units.forEach(u => {
      lessons[u] = [...new Set(questions.filter(q => q.unit === u).map(q => q.lesson).filter(Boolean))];
    });

    return { units, lessons };
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { getQuestions, getLessonsForGrade, shuffle };
})();
