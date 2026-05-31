"""
smart_enhancements_v3.py - Enhancements 29-50 for SmartBotBrain
================================================================
ADDITIVE ONLY - No modification to existing files.
FAIL-SAFE    - Each method wrapped in try/except.
OFFLINE      - No external APIs.
MODULAR      - Deletable without side effects.

NOTE: Enhancements already covered by v1/v2 are SKIPPED to prevent duplication:
  #35 (=v1#9), #37 (=v1#3), #38 (=v2#14), #41 (=v2#22),
  #42 (=v1#7), #45 (=v1#10), #47 (=v1#3), #49 (=v2#28)
"""

import re
import random
import time
from collections import defaultdict


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [29] Hidden intent patterns
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HIDDEN_INTENT_MAP = {
    "need_help": {
        "triggers": ["صعب", "صعبه", "تايه", "ضايع", "مش عارف ابدا",
                      "مش عارف اذاكر", "مش فاهم خالص", "كله غلط"],
        "responses": [
            "أنا حاسس إنك محتاج مساعدة 💙 تعالى نبدأ من الأول خطوة خطوة",
            "مش لازم تفهم كل حاجة مرة واحدة 😊 قولي إيه أصعب نقطة وأنا أبسطهالك",
            "ده طبيعي يا بطل! 💪 كلنا بنحتاج مساعدة، قولي عايز تبدأ منين؟",
        ],
    },
    "need_simplify": {
        "triggers": ["كله حفظ", "حفظ كتير", "مش فاهم الدرس", "الدرس صعب",
                      "المادة صعبه", "الدراسات صعبه", "كرهت الدراسات"],
        "responses": [
            "الدراسات مش حفظ! 🧠 هي فهم وربط أفكار — تعالى أوريك إزاي",
            "أنا هخليك تحب الدراسات 😄 قولي إيه الجزء اللي صعب عليك؟",
            "بص يا بطل، لما بتفهم الحكاية مش بتحتاج تحفظ 🌟 قولي نبدأ بإيه؟",
        ],
    },
    "need_motivation": {
        "triggers": ["هسقط", "مش هعرف", "مفيش فايده", "يئست",
                      "مش قادر اكمل", "خلاص هسيبها", "كرهت المذاكره"],
        "responses": [
            "لا لا لا! 🛑 أنت أقوى مما تفتكر يا بطل! كل واحد ناجح مر بلحظة زي دي 💪",
            "اسمعني كويس: النجاح مش إنك تبقى شاطر من الأول — النجاح إنك تكمل! 🌟",
            "أنت مش لوحدك يا معلم 🤗 أنا هنا أساعدك خطوة خطوة — يلا نبدأ!",
        ],
    },
    "need_review": {
        "triggers": ["الامتحان الدراسات", "امتحان بكره دراسات", "عايز اراجع",
                      "لازم اراجع", "الامتحان قرب"],
        "responses": [
            "ماشي يا بطل! 📋 قولي عايز تراجع إيه بالظبط وأنا ألخصهولك في نقاط",
            "أوكي وقت المراجعة! 🔥 اسألني عن أي موضوع وأنا أديك أهم النقاط",
            "يلا نراجع سوا! 📚 ابدأ بأي موضوع وأنا ألخصه في نقاط سريعة ✨",
        ],
    },
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [30] Gradual explanation data
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GRADUAL_INTROS = [
    "يلا نفهمها خطوة خطوة 📖\n",
    "هبسطهالك على مراحل 😊\n",
    "تعالى ناخدها واحدة واحدة 🧩\n",
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [33] Comparison/analogy bank
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALOGIES = {
    "population_density": "زي أوتوبيس زحمة — ناس كتير في مكان صغير 🚎",
    "democracy_meaning": "زي لما الفصل يصوت على كابتن الفريق 🗳️",
    "trade": "زي لما تبادل صاحبك ساندوتش بعصير في الفسحة 🤝",
    "suez_canal": "زي شارع مختصر بيوفر عليك ساعات سفر ⛴️",
    "pollution": "زي لما أوضتك تبقى مليانة زبالة — مش هتقدر تعيش فيها 🗑️",
    "nile_importance": "النيل لمصر زي المية للجسم — من غيره مفيش حياة 💧",
    "high_dam": "زي صنبور كبير بيتحكم في المية اللي نازلة 🚰",
    "citizenship": "زي لما تحافظ على أوضتك — ده واجبك تجاه بيتك 🏠",
    "energy_sources": "زي البطارية اللي بتشغل الموبايل — مصر محتاجة طاقة تشغل كل حاجة ⚡",
    "egypt_climate": "مصر زي فرن من فوق بس النيل بيلطفها من النص 🌡️",
    "development": "زي لما تطور مستواك في اللعبة — كل مرحلة بتفتح مرحلة جديدة 🎮",
    "volunteering": "زي لما تساعد صاحبك في شغله من غير ما يطلب 🤝",
    "natural_resources": "زي كنز مدفون تحت الأرض محتاج حد يطلعه ويستخدمه صح 💎",
    "environment": "الطبيعة زي بيتنا الكبير — لازم نحافظ عليه 🌍",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [34] Casual chat / frustration keywords
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CASUAL_FRUSTRATION = {
    "triggers": ["يا نهار", "يعني اي الدنيا", "مش قادر", "تعبت",
                  "ياخي", "يعم", "اف", "بلاها", "طفشت", "مللت",
                  "الدنيا وحشه", "يا ساتر"],
    "responses": [
        "هون عليك يا بطل 😊 خد نفس عميق وابدأ من أول حاجة بسيطة",
        "أنا فاهمك 💙 بس بعد الصعب بييجي السهل، يلا نكمل سوا!",
        "كلنا بنحس كده أحيانًا 🤗 المهم متوقفش — ابدأ بحاجة صغيرة",
        "خد بريك صغير وارجعلي 😄 أنا مستنيك أساعدك!",
    ],
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [36] "Thinking out loud" phrases
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THINKING_PHRASES = [
    "خليني أبسطهالك 😄 ",
    "بص عليها كده 👀 ",
    "تعالى نفكر فيها سوا 🤔 ",
    "أها فهمت سؤالك! ",
    "سؤال حلو! خليني أقولك 😊 ",
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [43] Topic resolver - broad topic categories
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOPIC_CATEGORIES = {
    "geography": {
        "keywords": ["جغراف", "نيل", "بحر", "صحرا", "تضاريس", "مناخ", "طقس",
                      "محافظ", "كثاف", "سكان", "خريط", "طول", "عرض",
                      "وجه قبلي", "وجه بحري", "دلتا", "صعيد", "ساحل"],
        "fallback": "ده موضوع جغرافيا! 🌍 ممكن توضح سؤالك أكتر عشان أساعدك؟",
    },
    "history": {
        "keywords": ["تاريخ", "فرعون", "فراعن", "اهرام", "قبطي", "اسلامي",
                      "محمد علي", "ثور", "اكتوبر", "حرب", "قديم", "حضار", "زمان"],
        "fallback": "ده موضوع تاريخ! 📜 قولي بالظبط عايز تعرف عن إيه؟",
    },
    "economy": {
        "keywords": ["اقتصاد", "تجار", "صناع", "زراع", "سياح", "قناه", "سويس",
                      "محصول", "طاقه", "نقل", "مواصل", "موارد", "سد"],
        "fallback": "ده موضوع اقتصاد! 💰 إيه بالظبط اللي عايز تعرفه؟",
    },
    "civics": {
        "keywords": ["مواطن", "ديمقراط", "حقوق", "واجب", "حكم", "دستور",
                      "مجلس", "انتخاب", "تطوع", "مشارك"],
        "fallback": "ده موضوع مواطنة ومدنيات! 🏛️ وضح أكتر وأنا أجاوبك",
    },
    "environment": {
        "keywords": ["بيئ", "تلوث", "محمي", "تنمي", "طبيع", "حيوان", "نبات"],
        "fallback": "ده موضوع بيئة! 🌿 عايز تعرف عن إيه بالظبط؟",
    },
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [44] Heavy Egyptian slang
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HEAVY_SLANG_MAP = {
    "يسطا": "", "يعم": "", "يجدع": "", "يحج": "",
    "ايوا": "ايوه", "ايوه يسطا": "ايوه", "لا يعم": "لا",
    "هبل": "", "الهبل": "", "خنقه": "", "جنان": "",
    "كسمها": "", "لعنها": "", "يلهوي": "",
    "فهمني": "اشرح", "ورينى": "اشرح", "وريني": "اشرح",
    "هاتلي": "اعطني", "هاتها": "اعطني", "جيبلي": "اعطني",
    "اي يسطا": "ايه", "اي دا": "ايه ده", "اي ده": "ايه ده",
    "ايه الجو ده": "", "اي الجو دا": "",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [48] Mental visualization scenes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUALIZATIONS = {
    "nile_importance": "🌊 تخيل مصر زي شريط طويل والنيل ماشي في النص بيدي حياة لكل حاجة حواليه",
    "egypt_terrain": "🏜️ تخيل صحرا كبيرة على اليمين والشمال وفي النص وادي أخضر جميل",
    "suez_canal": "⛴️ تخيل خط مية رفيع بيقطع الصحرا وسفن عملاقة ماشية فيه واحدة ورا التانية",
    "high_dam": "🏗️ تخيل حيطة ضخمة قدام النيل بتحبس المية وتنظمها عشان مصر كلها تستفيد",
    "population_density": "👥 تخيل فصل دراسي فيه 100 طالب — ده معنى الكثافة العالية!",
    "pharaonic_civilization": "🏛️ تخيل إنك واقف قدام الأهرامات والناس حواليك بتبني حجارة ضخمة بإيديها!",
    "october_war": "⚔️ تخيل الجيش المصري بيعدي القناة ويحرر سيناء — لحظة فخر!",
    "democracy_meaning": "🗳️ تخيل كل واحد في الفصل بيرفع إيده يصوت على قرار مهم — ده الديمقراطية!",
    "pollution": "😷 تخيل إنك في مكان الهوا فيه دخان والمية مش نضيفة — كده معنى التلوث",
    "trade": "📦 تخيل إن كل محافظة عندها حاجة مميزة وبتبعتها للتانية وبتاخد منها حاجة تانية",
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SmartEnhancementsV3 Class
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class SmartEnhancementsV3:
    """Enhancements 29-50: Deep intelligence layers."""

    def __init__(self):
        self._topic_history = defaultdict(list)  # [40] user_id → [last topics]
        self._gradual_step = defaultdict(int)     # [30] user_id → current step for intent
        print("[ENHANCEMENTS_V3] ✅ SmartEnhancementsV3 loaded")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [29] Hidden intent detection
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_hidden_intent(self, normalized_text):
        """Detect what the student really needs behind their words."""
        try:
            for intent_type, data in HIDDEN_INTENT_MAP.items():
                for trigger in data["triggers"]:
                    if trigger in normalized_text:
                        return random.choice(data["responses"])
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [30] Gradual explanation
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def make_gradual(self, response, intent_id, user_id=None):
        """Format response as step-by-step (for complex topics, 20% chance)."""
        try:
            complex_topics = [
                "democracy_meaning", "population_density", "egyptian_economy",
                "development", "trade", "energy_sources", "government_system",
            ]
            if intent_id not in complex_topics:
                return response
            if random.random() > 0.20:
                return response

            intro = random.choice(GRADUAL_INTROS)
            sentences = re.split(r'[.!،]', response)
            sentences = [s.strip() for s in sentences if len(s.strip()) > 5]

            if len(sentences) <= 1:
                return intro + "1️⃣ " + response
            steps = []
            icons = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"]
            for i, s in enumerate(sentences[:4]):
                steps.append(f"{icons[i]} {s}")
            return intro + "\n".join(steps)
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [31] Compound question splitting
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_compound_question(self, normalized_text):
        """Detect if message contains multiple questions joined by 'و' or 'وايه'."""
        try:
            splitters = [" وايه ", " و ايه ", " وليه ", " و ليه ",
                         " وكمان ", " وبرضو ", " وازاي ", " و ازاي "]
            for sp in splitters:
                if sp in normalized_text:
                    parts = normalized_text.split(sp, 1)
                    if len(parts) == 2 and len(parts[0]) > 3 and len(parts[1]) > 3:
                        return parts
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [32] Core keyword extraction from long text
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def extract_core_keywords(self, normalized_text):
        """Extract the most important educational keywords from a message."""
        try:
            all_keywords = set()
            for cat_data in TOPIC_CATEGORIES.values():
                all_keywords.update(cat_data["keywords"])

            words = normalized_text.split()
            core = [w for w in words if any(kw in w for kw in all_keywords)]

            if core:
                return " ".join(core)
            return normalized_text
        except Exception:
            return normalized_text

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [33] Comparison/analogy injection
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_analogy(self, response, intent_id):
        """Add a real-life analogy to educational responses (18% chance)."""
        try:
            if random.random() > 0.18:
                return response
            analogy = ANALOGIES.get(intent_id)
            if analogy:
                return f"{response}\n\n💡 ببساطة: {analogy}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [34] Casual chat / frustration detection
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_casual_frustration(self, normalized_text):
        """Detect casual frustration/random chat and respond warmly."""
        try:
            for trigger in CASUAL_FRUSTRATION["triggers"]:
                if trigger in normalized_text:
                    return random.choice(CASUAL_FRUSTRATION["responses"])
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [36] "Thinking out loud" prefix
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_thinking_phrase(self, response):
        """Add a 'thinking out loud' phrase (10% chance)."""
        try:
            if random.random() > 0.10:
                return response
            phrase = random.choice(THINKING_PHRASES)
            return phrase + response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [39] Understanding-first response
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_understanding_note(self, response, intent_id):
        """Add a 'the idea behind this' note (12% chance)."""
        try:
            if random.random() > 0.12:
                return response
            notes = {
                "nile_importance": "الفكرة هنا إن الناس من زمان عاشوا جنب المية 🌊",
                "pharaonic_civilization": "الفكرة إن الحضارة بتبدأ لما الناس تستقر ويبقى عندهم أكل وأمان 🏛️",
                "suez_canal": "الفكرة إن الموقع الجغرافي ممكن يخلي بلد غنية جدًا 🗺️",
                "october_war": "الفكرة إن الإرادة والتخطيط أقوى من السلاح أحيانًا 💪",
                "democracy_meaning": "الفكرة إن كل واحد له حق يختار ويشارك في القرارات 🗳️",
                "pollution": "الفكرة إن كل حاجة بنعملها بتأثر على البيئة والناس 🌍",
                "development": "الفكرة إن التقدم مش بس فلوس — ده صحة وتعليم وعدالة كمان 📈",
            }
            note = notes.get(intent_id)
            if note:
                return f"{response}\n\n🧠 {note}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [40] Fragmented message linking
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def track_topic_fragment(self, user_id, normalized_text, topic_keywords):
        """Track short topic fragments to build context over messages."""
        try:
            uid = str(user_id)
            words = normalized_text.split()
            if len(words) > 4:
                return

            for word in words:
                for kw in topic_keywords:
                    if kw in word:
                        if uid not in self._topic_history:
                            self._topic_history[uid] = []
                        self._topic_history[uid].append(kw)
                        self._topic_history[uid] = self._topic_history[uid][-5:]
                        return
        except Exception:
            pass

    def get_linked_topic(self, user_id):
        """Get linked topic from fragmented messages."""
        try:
            uid = str(user_id)
            history = self._topic_history.get(uid, [])
            if len(history) >= 2:
                return " ".join(history[-3:])
            return None
        except Exception:
            return None

    def clear_topic_history(self, user_id):
        """Clear topic history after successful match."""
        try:
            uid = str(user_id)
            if uid in self._topic_history:
                self._topic_history[uid] = []
        except Exception:
            pass

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [43] Topic resolver (broad topic fallback)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def resolve_broad_topic(self, normalized_text):
        """Detect broad topic category and provide smart fallback."""
        try:
            for cat_name, cat_data in TOPIC_CATEGORIES.items():
                for kw in cat_data["keywords"]:
                    if kw in normalized_text:
                        return cat_data["fallback"]
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [44] Heavy slang normalization
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def normalize_heavy_slang(self, normalized_text):
        """Remove/replace heavy Egyptian slang that might confuse matching."""
        try:
            t = normalized_text
            for slang, replacement in HEAVY_SLANG_MAP.items():
                if slang in t:
                    t = t.replace(slang, replacement)
            # Clean up multiple spaces
            t = re.sub(r'\s+', ' ', t).strip()
            return t if len(t) >= 2 else normalized_text
        except Exception:
            return normalized_text

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [46] Smart summary at end of long responses
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_smart_summary(self, response):
        """Add a one-line summary if response is long (>120 chars, 25% chance)."""
        try:
            if len(response) < 120 or random.random() > 0.25:
                return response
            sentences = re.split(r'[.!،\n]', response)
            sentences = [s.strip() for s in sentences if len(s.strip()) > 8]
            if sentences:
                key_sentence = sentences[0]
                if len(key_sentence) > 60:
                    key_sentence = key_sentence[:60] + "..."
                return f"{response}\n\n✨ الخلاصة: {key_sentence}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [48] Mental visualization
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_visualization(self, response, intent_id):
        """Add a mental scene to help understanding (15% chance)."""
        try:
            if random.random() > 0.15:
                return response
            vis = VISUALIZATIONS.get(intent_id)
            if vis:
                return f"{response}\n\n🎬 {vis}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [50] Smart Teacher Master Mode
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # This is NOT a separate feature — it's the orchestration of all v3
    # post-processing in the right order with smart probability control.

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Pre-processing
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def pre_process(self, normalized_text, user_id=None, topic_keywords=None):
        """Apply v3 pre-processing. Returns (modified_text, early_response_or_None)."""
        try:
            t = normalized_text

            # [44] Heavy slang normalization
            t = self.normalize_heavy_slang(t)

            # [32] Core keyword extraction for long messages
            words = t.split()
            if len(words) > 6:
                t = self.extract_core_keywords(t)

            # [40] Track topic fragments
            if user_id and topic_keywords:
                self.track_topic_fragment(user_id, t, topic_keywords)

            # [29] Hidden intent detection (may return early response)
            hidden_resp = self.detect_hidden_intent(t)
            if hidden_resp:
                return t, hidden_resp

            # [34] Casual frustration detection (may return early response)
            casual_resp = self.detect_casual_frustration(t)
            if casual_resp:
                return t, casual_resp

            return t, None
        except Exception:
            return normalized_text, None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Post-processing [50]
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def post_process(self, response, intent_id, user_id=None):
        """Apply all v3 post-processing (Smart Teacher Mode)."""
        try:
            # [30] Gradual explanation for complex topics
            response = self.make_gradual(response, intent_id, user_id)
            # [33] Add analogy (18% chance)
            response = self.add_analogy(response, intent_id)
            # [48] Mental visualization (15% chance)
            response = self.add_visualization(response, intent_id)
            # [39] Understanding-first note (12% chance)
            response = self.add_understanding_note(response, intent_id)
            # [36] Thinking out loud phrase (10% chance)
            response = self.add_thinking_phrase(response)
            # [46] Smart summary for long responses (25% chance)
            response = self.add_smart_summary(response)
            # [40] Clear fragment history on successful match
            if user_id:
                self.clear_topic_history(user_id)

            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [43] Topic resolver fallback
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def get_topic_fallback(self, normalized_text):
        """Last resort: detect broad topic and give guidance."""
        try:
            return self.resolve_broad_topic(normalized_text)
        except Exception:
            return None

    # [31] Compound question handler
    def split_compound(self, normalized_text):
        """Split compound question, return parts or None."""
        try:
            return self.detect_compound_question(normalized_text)
        except Exception:
            return None

    # [40] Get linked context from fragments
    def get_fragment_context(self, user_id, normalized_text):
        """Build context from fragmented short messages."""
        try:
            linked = self.get_linked_topic(user_id)
            if linked and len(normalized_text.split()) <= 3:
                return linked + " " + normalized_text
            return None
        except Exception:
            return None
