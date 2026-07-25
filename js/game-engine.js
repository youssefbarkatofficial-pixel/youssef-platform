/**
 * صراع البوصلة - محرك اللعبة (Epic Conquest)
 * ============================================================
 */

window.GameEngine = (function() {

  // ============================================================
  // SECTION 1: CONSTANTS
  // ============================================================
  const ROUNDS = 35;               // 5 Consolidation + 30 Invasion
  const QUESTION_TIME = 15;
  const OWNER_UID = 'OWNER_YOUSSEF_BARKAT';

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
    { name: 'حارس البوصلة الأعظم', minXp: Infinity }
  ];

  const XP_WIN = 80;
  const XP_LOSS_RANKED = -20;
  const XP_DRAW = 20;
  const XP_CORRECT_Q = 10;

  // ============================================================
  // SECTION 2: MAP & BOTS
  // ============================================================
  const CONTINENTS = [
    { id: 'namerica', name: 'أمريكا الشمالية', adj: ['samerica', 'europe', 'asia'] },
    { id: 'samerica', name: 'أمريكا الجنوبية', adj: ['namerica', 'africa'] },
    { id: 'europe',   name: 'أوروبا',          adj: ['namerica', 'africa', 'mideast', 'asia'] },
    { id: 'africa',   name: 'أفريقيا',         adj: ['samerica', 'europe', 'mideast'] },
    { id: 'mideast',  name: 'الشرق الأوسط',    adj: ['africa', 'europe', 'asia'] },
    { id: 'asia',     name: 'آسيا',            adj: ['europe', 'mideast', 'oceania', 'namerica'] },
    { id: 'oceania',  name: 'أوقيانوسيا',      adj: ['asia'] },
  ];

  const DISTANCE_ALLOCATIONS = {
    1: ['africa'],
    2: ['namerica', 'asia'],
    3: ['namerica', 'africa', 'oceania'],
    4: ['samerica', 'europe', 'oceania', 'africa'],
    5: ['samerica', 'namerica', 'europe', 'africa', 'oceania'],
    6: ['samerica', 'namerica', 'europe', 'africa', 'oceania', 'asia'],
    7: ['samerica', 'namerica', 'europe', 'africa', 'oceania', 'asia', 'mideast']
  };

  const BOT_PROFILES = {
    beginner:  { correctRate: 0.40, minDelay: 9000,  maxDelay: 14000, minRankIdx: 0, maxRankIdx: 2 },
    medium:    { correctRate: 0.60, minDelay: 6000,  maxDelay: 10000, minRankIdx: 3, maxRankIdx: 5 },
    pro:       { correctRate: 0.75, minDelay: 3000,  maxDelay: 7000,  minRankIdx: 6, maxRankIdx: 8 },
    commander: { correctRate: 0.88, minDelay: 1000,  maxDelay: 4000,  minRankIdx: 9, maxRankIdx: 12 },
  };

  const BOT_THINKING_PHRASES = ['يفكر...', 'متأكد؟', '🤔', 'هممم...', 'انتظر...', '...'];
  const BOT_NAMES = ['فارس الخرائط', 'محمد الباحث', 'سارة المؤرخة', 'خالد الرحّال', 'أميرة البوصلة', 'أحمد المستكشف', 'فاطمة التاريخية', 'يوسف الجغرافي', 'عمر المحارب', 'ليلى الأندلسية'];

  // ============================================================
  // SECTION 3: GAME STATE
  // ============================================================
  let state = {
    currentUser: null,
    playerXp: 0,
    isLoggedIn: false,
    gameMode: null,       
    subject: 'mixed',
    grade: 'general',
    bots: [],             
    questions: [],
    currentRound: 0,
    scores: { player: 0, bots: [] },
    territories: [],      // array of {id, chunks: [owner, owner...]}
    targets: {},          // entityId -> targetContinentId
    playerAnswer: null,   
    timerInterval: null,
    secondsLeft: QUESTION_TIME,
    roundLocked: false,
    totalXpGained: 0,
    playerHome: 'africa',
  };

  // ============================================================
  // SECTION 4: HELPERS
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

  async function loadPlayerData(uid) {
    let baseData = { name: 'لاعب', xp: 0, wins: 0, losses: 0, played: 0, grade: 'general', photoURL: null };
    try {
      if (window.firebaseDb) {
        const doc = await window.firebaseDb.collection('users').doc(uid).get();
        if (doc.exists) {
          const d = doc.data();
          baseData = { ...baseData, ...d, name: d.name || d.displayName || 'لاعب' };
        }
      }
    } catch(e) { console.warn('loadPlayerData error:', e); }

    // Owner Override
    if (uid === OWNER_UID || baseData.name.includes('يوسف') || baseData.name.toLowerCase().includes('youssef')) {
      baseData.name = '👑 المالك يوسف بركات';
      baseData.xp = Math.max(baseData.xp, 90000); // سيد القارات / الأعظم
    }
    return baseData;
  }

  async function saveGameResult({ uid, xpDelta, won, draw }) {
    if (!uid || !window.firebaseDb) return;
    try {
      let multiplier = 1;
      if (state.gameMode === 'training') multiplier = 0.5;
      else if (state.gameMode === 'ranked') multiplier = 1.0;
      else if (state.gameMode === 'agent' || state.gameMode === 'bots') {
        const diff = state.bots[0]?.difficulty || 'medium';
        if (diff === 'beginner') multiplier = 0.2;
        if (diff === 'medium') multiplier = 0.4;
        if (diff === 'pro') multiplier = 0.6;
        if (diff === 'commander') multiplier = 0.8;
      }
      
      const finalXpDelta = Math.round(xpDelta * multiplier);

      const ref = window.firebaseDb.collection('users').doc(uid);
      await ref.update({
        gameXp: window.firebase.firestore.FieldValue.increment(Math.max(0, finalXpDelta)),
        gameWins: won ? window.firebase.firestore.FieldValue.increment(1) : window.firebase.firestore.FieldValue.increment(0),
        gameLosses: (!won && !draw) ? window.firebase.firestore.FieldValue.increment(1) : window.firebase.firestore.FieldValue.increment(0),
        gamesPlayed: window.firebase.firestore.FieldValue.increment(1),
      });
    } catch(e) { console.warn('saveGameResult error:', e); }
  }

  async function loadLeaderboard(grade) {
    try {
      if (!window.firebaseDb) return [];
      const snap = await window.firebaseDb
        .collection('users')
        .where('grade', '==', grade)
        .orderBy('gameXp', 'desc')
        .limit(10)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { return []; }
  }

  // ============================================================
  // SECTION 5: BOT LOGIC & EPIC CONQUEST ALGORITHMS
  // ============================================================
  function createBot(difficulty, index) {
    const p = BOT_PROFILES[difficulty] || BOT_PROFILES.medium;
    const rankIdx = p.minRankIdx + Math.floor(Math.random() * (p.maxRankIdx - p.minRankIdx + 1));
    const rank = RANKS[rankIdx];
    const nextRank = RANKS[rankIdx + 1] || rank;
    const fakeXp = rank.minXp + Math.floor(Math.random() * (nextRank.minXp - rank.minXp));

    return {
      id: `bot_${index}`,
      name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + ` (${rank.name})`,
      difficulty,
      profile: p,
      fakeXp,
      rankName: rank.name,
      homeContinent: null,
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
    const phraseInterval = setInterval(() => {
      bot.thinkingPhrase = BOT_THINKING_PHRASES[Math.floor(Math.random() * BOT_THINKING_PHRASES.length)];
    }, 1200);

    const timeout = setTimeout(() => {
      clearInterval(phraseInterval);
      bot.isThinking = false;
      bot.answered = true;
      const isCorrect = Math.random() < bot.profile.correctRate;
      if (isCorrect) bot.chosenAnswer = question.correct;
      else {
        const wrongOptions = [0,1,2,3].filter(i => i !== question.correct);
        bot.chosenAnswer = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
      }
      onAnswer(bot);
    }, Math.min(delay, (QUESTION_TIME - 1) * 1000));

    return { phraseInterval, timeout };
  }

  function getActiveFronts(entityId) {
    return state.territories.filter(t => t.chunks.includes(entityId)).map(t => t.id);
  }

  function assignTargets() {
    state.targets = {};
    const phase = state.currentRound < 5 ? 'consolidation' : 'invasion';
    
    const entities = ['player', ...state.bots.map(b => b.id)];

    entities.forEach(ent => {
      if (phase === 'consolidation') {
        state.targets[ent] = ent === 'player' ? state.playerHome : state.bots.find(b => b.id === ent).homeContinent;
      } else {
        // Invasion Phase
        const fronts = getActiveFronts(ent);
        if (fronts.length === 0) {
           // Lost all lands, fallback to home
           state.targets[ent] = ent === 'player' ? state.playerHome : state.bots.find(b => b.id === ent).homeContinent;
           return;
        }

        let possibleTargets = new Set();
        fronts.forEach(f => {
          const c = CONTINENTS.find(x => x.id === f);
          c.adj.forEach(adj => possibleTargets.add(adj));
        });

        // Filter out continents they already fully own (5 chunks)
        const validTargets = Array.from(possibleTargets).filter(tgt => {
           const tObj = state.territories.find(x => x.id === tgt);
           return tObj.chunks.filter(c => c === ent).length < 5;
        });

        if (validTargets.length > 0) {
           state.targets[ent] = validTargets[Math.floor(Math.random() * validTargets.length)];
        } else {
           // Random fallback
           state.targets[ent] = CONTINENTS[Math.floor(Math.random() * CONTINENTS.length)].id;
        }
      }
    });
  }

  // ============================================================
  // SECTION 6: GAME FLOW API
  // ============================================================
  function startGame({ mode, subject, grade, botCount, botDifficulty, questions }) {
    state.gameMode = mode;
    state.subject = subject;
    state.grade = grade;
    state.questions = questions;
    state.currentRound = 0;
    state.scores = { player: 0, bots: Array(botCount).fill(0) };
    state.totalXpGained = 0;
    state.roundLocked = false;

    state.bots = Array.from({ length: botCount }, (_, i) => createBot(botDifficulty, i));

    const alloc = DISTANCE_ALLOCATIONS[botCount + 1] || DISTANCE_ALLOCATIONS[7];
    state.playerHome = alloc[0];
    state.bots.forEach((b, i) => b.homeContinent = alloc[i+1]);

    state.territories = CONTINENTS.map(c => ({
      id: c.id,
      name: c.name,
      chunks: [null, null, null, null, null],
    }));
  }

  function startRound(onTick, onBotUpdate, onRoundEnd) {
    if (state.currentRound >= state.questions.length) {
      endGame();
      return;
    }

    state.playerAnswer = null;
    state.roundLocked = false;
    state.secondsLeft = QUESTION_TIME;

    assignTargets(); // assign invasion/consolidation targets

    const question = state.questions[state.currentRound];
    state.bots.forEach((bot, i) => {
      scheduleBotAnswer(bot, question, (b) => {
        onBotUpdate(b, i);
      });
    });

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

  function selectAnswer(answerIndex) {
    if (state.roundLocked) return false;
    state.playerAnswer = answerIndex;
    return true;
  }

  function lockRound(onRoundEnd) {
    if (state.roundLocked) return;
    state.roundLocked = true;
    clearInterval(state.timerInterval);

    const question = state.questions[state.currentRound];
    const playerCorrect = state.playerAnswer === question.correct;

    if (playerCorrect) {
      state.scores.player++;
      state.totalXpGained += XP_CORRECT_Q;
    }

    let correctEntities = playerCorrect ? ['player'] : [];
    state.bots.forEach((bot, i) => {
      if (bot.chosenAnswer === question.correct) {
        state.scores.bots[i] = (state.scores.bots[i] || 0) + 1;
        correctEntities.push(bot.id);
      }
    });

    // Epic Conquest Land Grab Logic
    // Each correct entity tries to conquer a chunk in their target
    const entities = ['player', ...state.bots.map(b => b.id)];
    
    entities.forEach(ent => {
       const isCorrect = correctEntities.includes(ent);
       if (!isCorrect) return;

       const targetId = state.targets[ent];
       const terr = state.territories.find(t => t.id === targetId);
       if (!terr) return;

       const nullIndex = terr.chunks.indexOf(null);
       
       if (nullIndex !== -1) {
          // Claim neutral land
          terr.chunks[nullIndex] = ent;
       } else {
          // Stealing land from someone else
          // Find chunks NOT owned by me
          const enemyIndexes = [];
          terr.chunks.forEach((owner, idx) => { if (owner !== ent) enemyIndexes.push(idx); });
          
          if (enemyIndexes.length > 0) {
             const stealIdx = enemyIndexes[0];
             const enemyId = terr.chunks[stealIdx];
             // If enemy also got it right, stalemate!
             if (!correctEntities.includes(enemyId)) {
                 terr.chunks[stealIdx] = ent; // Stolen!
             }
          }
       }
    });

    const roundResult = {
      playerCorrect,
      correctIndex: question.correct,
      playerAnswer: state.playerAnswer,
      scores: { ...state.scores },
      bots: state.bots,
      territories: state.territories,
      targets: state.targets,
    };

    onRoundEnd(roundResult);
  }

  function nextRound() {
    state.currentRound++;
    state.bots.forEach(b => {
      b.chosenAnswer = null;
      b.answered = false;
      b.isThinking = false;
    });
  }

  function endGame() {
    clearInterval(state.timerInterval);
    // Winner is one with most total chunks!
    let chunkCounts = { player: 0 };
    state.bots.forEach(b => chunkCounts[b.id] = 0);

    state.territories.forEach(t => {
       t.chunks.forEach(c => {
          if (c) chunkCounts[c]++;
       });
    });

    const playerChunks = chunkCounts.player;
    let maxBotChunks = 0;
    state.bots.forEach(b => {
       if (chunkCounts[b.id] > maxBotChunks) maxBotChunks = chunkCounts[b.id];
    });

    const playerWon = playerChunks > maxBotChunks;
    const isDraw = playerChunks === maxBotChunks;

    let xpGained = state.totalXpGained;
    if (playerWon) {
      xpGained += XP_WIN;
    } else if (!isDraw) {
      xpGained += XP_LOSS_RANKED;
    }

    const newXp = Math.max(0, state.playerXp + xpGained);

    return {
      playerScore: playerChunks,
      maxBotScore: maxBotChunks,
      playerWon,
      isDraw,
      scores: state.scores,
      chunkCounts,
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
