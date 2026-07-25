/**
 * صراع البوصلة - محرك اللعبة الكامل
 * ============================================================
 * التعديل الآمن: كل section معلّمة - عدّل بدون كسر الباقي
 * ============================================================
 */

window.GameEngine = (function() {

  // ============================================================
  // SECTION 1: CONSTANTS (غيّر القيم هنا بأمان)
  // ============================================================
  const ROUNDS = 7;               // عدد جولات المبارزة
  const QUESTION_TIME = 15;       // ثواني كل سؤال
  const OWNER_UID = 'OWNER_YOUSSEF_BARKAT'; // UID المالك في Firebase

  const RANKS = [
    { name: 'مستكشف ناشئ',      minXp: 0 },
    { name: 'رحّالة مبتدئ',      minXp: 200 },
    { name: 'قارئ الخرائط',      minXp: 500 },
    { name: 'مستكشف الطرق',     minXp: 1000 },
    { name: 'حامل البوصلة',      minXp: 2000 },
    { name: 'كاشف الآثار',       minXp: 3500 },
    { name: 'مؤرخ الحضارات',    minXp: 6000 },
    { name: 'قائد الرحلات',      minXp: 10000 },
    { name: 'سيد المسارات',      minXp: 16000 },
    { name: 'حارس الأطالس',     minXp: 25000 },
    { name: 'وريث البوصلة',     minXp: 38000 },
    { name: 'أسطورة الحضارات',  minXp: 55000 },
    { name: 'سيد القارات',       minXp: 80000 },
    { name: 'حارس البوصلة الأعظم', minXp: Infinity } // المالك فقط
  ];

  // XP مكتسب (قابل للتعديل)
  const XP_WIN_VS_HUMAN  = 80;
  const XP_WIN_VS_BOT    = 40;
  const XP_LOSS_RANKED   = -20;  // سالب = خسارة
  const XP_DRAW          = 20;
  const XP_CORRECT_Q     = 10;   // لكل سؤال صح

  // ============================================================
  // SECTION 2: BOT SYSTEM
  // ============================================================
  const BOT_PROFILES = {
    beginner:  { correctRate: 0.40, minDelay: 9000,  maxDelay: 14000, name:'المبتدئ' },
    medium:    { correctRate: 0.60, minDelay: 6000,  maxDelay: 10000, name:'المتوسط' },
    pro:       { correctRate: 0.75, minDelay: 3000,  maxDelay: 7000,  name:'المحترف' },
    commander: { correctRate: 0.88, minDelay: 1000,  maxDelay: 4000,  name:'القائد' },
  };

  const BOT_THINKING_PHRASES = [
    'يفكر...', 'متأكد؟', '🤔', 'هممم...', 'انتظر...', '...'
  ];

  const BOT_NAMES = [
    'فارس الخرائط', 'محمد الباحث', 'سارة المؤرخة', 'خالد الرحّال',
    'أميرة البوصلة', 'أحمد المستكشف', 'فاطمة التاريخية', 'يوسف الجغرافي'
  ];

  // ============================================================
  // SECTION 3: GAME STATE
  // ============================================================
  let state = {
    currentUser: null,
    playerXp: 0,
    isLoggedIn: false,
    gameMode: null,       // 'ranked' | 'training' | 'friends'
    subject: 'mixed',
    grade: 'general',
    bots: [],             // [{name, difficulty, score, chosenAnswer, thinkingTimer}]
    questions: [],
    currentRound: 0,
    scores: { player: 0, bots: [] },
    territories: [],      // اسم كل إقليم + من يملكه
    playerAnswer: null,   // index الإجابة المختارة
    timerInterval: null,
    secondsLeft: QUESTION_TIME,
    roundLocked: false,
    totalXpGained: 0,
  };

  // ============================================================
  // SECTION 4: RANK HELPERS
  // ============================================================
  function getRank(xp) {
    let rank = RANKS[0];
    for (const r of RANKS) {
      if (xp >= r.minXp) rank = r;
      else break;
    }
    return rank;
  }

  function getProgress(xp) {
    for (let i = 0; i < RANKS.length - 1; i++) {
      if (xp >= RANKS[i].minXp && xp < RANKS[i+1].minXp) {
        return (xp - RANKS[i].minXp) / (RANKS[i+1].minXp - RANKS[i].minXp);
      }
    }
    return 1;
  }

  // ============================================================
  // SECTION 5: FIREBASE HELPERS
  // ============================================================
  async function loadPlayerData(uid) {
    try {
      const doc = await window.firebaseDb.collection('users').doc(uid).get();
      if (doc.exists) {
        const d = doc.data();
        return {
          name: d.name || d.displayName || 'لاعب',
          xp: d.gameXp || 0,
          wins: d.gameWins || 0,
          losses: d.gameLosses || 0,
          played: d.gamesPlayed || 0,
          grade: d.grade || 'general',
          photoURL: d.photoURL || null,
        };
      }
    } catch(e) { console.warn('loadPlayerData error:', e); }
    return { name: 'لاعب', xp: 0, wins: 0, losses: 0, played: 0, grade: 'general', photoURL: null };
  }

  async function saveGameResult({ uid, xpDelta, won, draw }) {
    if (!uid || !window.firebaseDb) return;
    try {
      const ref = window.firebaseDb.collection('users').doc(uid);
      await ref.update({
        gameXp: window.firebase.firestore.FieldValue.increment(Math.max(0, xpDelta)),
        gameWins: won ? window.firebase.firestore.FieldValue.increment(1) : window.firebase.firestore.FieldValue.increment(0),
        gameLosses: (!won && !draw) ? window.firebase.firestore.FieldValue.increment(1) : window.firebase.firestore.FieldValue.increment(0),
        gamesPlayed: window.firebase.firestore.FieldValue.increment(1),
      });
    } catch(e) { console.warn('saveGameResult error:', e); }
  }

  async function loadLeaderboard(grade) {
    try {
      const snap = await window.firebaseDb
        .collection('users')
        .where('grade', '==', grade)
        .orderBy('gameXp', 'desc')
        .limit(10)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      console.warn('loadLeaderboard error:', e);
      return [];
    }
  }

  // ============================================================
  // SECTION 6: BOT LOGIC
  // ============================================================
  function createBot(difficulty, index) {
    const profile = BOT_PROFILES[difficulty] || BOT_PROFILES.medium;
    return {
      id: `bot_${index}`,
      name: BOT_NAMES[index % BOT_NAMES.length],
      difficulty,
      profile,
      score: 0,
      chosenAnswer: null,
      isThinking: false,
      thinkingPhrase: '',
      answered: false,
    };
  }

  function scheduleBotAnswer(bot, question, onAnswer) {
    bot.isThinking = true;
    bot.chosenAnswer = null;
    bot.answered = false;

    const delay = bot.profile.minDelay + Math.random() * (bot.profile.maxDelay - bot.profile.minDelay);

    // تحديث عبارة التفكير بشكل دوري
    const phraseInterval = setInterval(() => {
      bot.thinkingPhrase = BOT_THINKING_PHRASES[Math.floor(Math.random() * BOT_THINKING_PHRASES.length)];
    }, 1200);

    const timeout = setTimeout(() => {
      clearInterval(phraseInterval);
      bot.isThinking = false;
      bot.answered = true;

      // تحديد الإجابة
      const isCorrect = Math.random() < bot.profile.correctRate;
      if (isCorrect) {
        bot.chosenAnswer = question.correct;
      } else {
        const wrongOptions = [0,1,2,3].filter(i => i !== question.correct);
        bot.chosenAnswer = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
      }

      onAnswer(bot);
    }, Math.min(delay, (QUESTION_TIME - 1) * 1000));

    return { phraseInterval, timeout };
  }

  // ============================================================
  // SECTION 7: GAME FLOW API (يستدعيه game.html)
  // ============================================================

  /**
   * بدء لعبة جديدة
   */
  function startGame({ mode, subject, grade, botCount, botDifficulty, questions }) {
    state.gameMode = mode;
    state.subject = subject;
    state.grade = grade;
    state.questions = questions;
    state.currentRound = 0;
    state.scores = { player: 0, bots: Array(botCount).fill(0) };
    state.totalXpGained = 0;
    state.roundLocked = false;

    // إنشاء البوتات
    state.bots = Array.from({ length: botCount }, (_, i) => createBot(botDifficulty, i));

    // مناطق الخريطة (7 مناطق = 7 جولات)
    state.territories = [
      { id:'europe',    name:'أوروبا',         owner:null },
      { id:'asia',      name:'آسيا',            owner:null },
      { id:'africa',    name:'أفريقيا',         owner:null },
      { id:'namerica',  name:'أمريكا الشمالية', owner:null },
      { id:'samerica',  name:'أمريكا الجنوبية', owner:null },
      { id:'oceania',   name:'أوقيانوسيا',      owner:null },
      { id:'mideast',   name:'الشرق الأوسط',    owner:null },
    ];
  }

  /**
   * بدء جولة جديدة
   */
  function startRound(onTick, onBotUpdate, onRoundEnd) {
    if (state.currentRound >= state.questions.length) {
      endGame();
      return;
    }

    state.playerAnswer = null;
    state.roundLocked = false;
    state.secondsLeft = QUESTION_TIME;

    const question = state.questions[state.currentRound];

    // بدء أجهزة بوت
    state.bots.forEach((bot, i) => {
      scheduleBotAnswer(bot, question, (b) => {
        onBotUpdate(b, i);
      });
    });

    // بدء المؤقت
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
      state.secondsLeft--;
      onTick(state.secondsLeft);
      if (state.secondsLeft <= 0) {
        clearInterval(state.timerInterval);
        lockRound(onRoundEnd);
      }
    }, 1000);
  }

  /**
   * اختيار إجابة (يمكن التغيير حتى آخر ثانية)
   */
  function selectAnswer(answerIndex) {
    if (state.roundLocked) return false;
    state.playerAnswer = answerIndex;
    return true;
  }

  /**
   * قفل الجولة وحساب النتائج
   */
  function lockRound(onRoundEnd) {
    if (state.roundLocked) return;
    state.roundLocked = true;
    clearInterval(state.timerInterval);

    const question = state.questions[state.currentRound];
    const isCorrect = state.playerAnswer === question.correct;

    if (isCorrect) {
      state.scores.player++;
      state.totalXpGained += XP_CORRECT_Q;
    }

    let correctEntities = [];
    if (isCorrect) correctEntities.push('player');

    // محاكاة استجابة الأيجنت
    state.bots.forEach((bot, i) => {
      if (bot.chosenAnswer === question.correct) {
        state.scores.bots[i] = (state.scores.bots[i] || 0) + 1;
        correctEntities.push(bot.id);
      }
    });

    // السيطرة على الإقليم
    const territory = state.territories[state.currentRound % ROUNDS];
    
    if (correctEntities.length === 1) {
      territory.owner = correctEntities[0];
    } else {
      territory.owner = null; // تعادل - محدش هياخدها
    }

    const roundResult = {
      playerCorrect: isCorrect,
      correctIndex: question.correct,
      playerAnswer: state.playerAnswer,
      territory,
      scores: { ...state.scores },
      bots: state.bots,
    };

    onRoundEnd(roundResult);
  }

  /**
   * الانتقال للجولة التالية
   */
  function nextRound() {
    state.currentRound++;
    state.bots.forEach(b => {
      b.chosenAnswer = null;
      b.answered = false;
      b.isThinking = false;
    });
  }

  /**
   * انتهاء اللعبة وحساب النتيجة النهائية
   */
  function endGame() {
    clearInterval(state.timerInterval);
    const playerScore = state.scores.player;
    const maxBotScore = Math.max(...state.scores.bots, 0);
    const playerWon = playerScore > maxBotScore;
    const isDraw = playerScore === maxBotScore;

    let xpGained = state.totalXpGained;
    if (playerWon) {
      xpGained += state.gameMode === 'ranked' ? XP_WIN_VS_BOT : 0;
    } else if (!isDraw && state.gameMode === 'ranked') {
      xpGained += XP_LOSS_RANKED;
    }

    const newXp = Math.max(0, state.playerXp + xpGained);

    return {
      playerScore,
      maxBotScore,
      playerWon,
      isDraw,
      scores: state.scores,
      xpGained,
      newXp,
      territories: state.territories,
      bots: state.bots,
    };
  }

  function getState() { return state; }
  function getCurrentQuestion() { return state.questions[state.currentRound]; }

  return {
    RANKS, ROUNDS, QUESTION_TIME,
    getRank, getProgress,
    loadPlayerData, saveGameResult, loadLeaderboard,
    startGame, startRound, selectAnswer, lockRound, nextRound, endGame,
    getState, getCurrentQuestion,
  };
})();
