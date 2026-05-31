"""
smart_enhancements_v2.py - Enhancements 11-28 for SmartBotBrain
================================================================
ADDITIVE ONLY - Extends ai_core.py without modifying existing code.
FAIL-SAFE    - If any enhancement fails, base system continues.
OFFLINE      - No external APIs.
MODULAR      - Can be deleted without affecting anything.
"""

import re
import random
import time
from collections import defaultdict

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [11] Filler words to strip from long messages
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILLER_WORDS = {
    "يعني", "اصلا", "بصراحة", "كده", "طيب", "خلاص", "بقى", "عارف",
    "والله", "بجد", "اصل", "اصلى", "هو", "هي", "انا", "احنا",
    "بس", "طب", "اوك", "ماشي", "يابوصلة", "يا بوصلة",
    "بالظبط", "بردو", "برده", "كمان", "يلا", "اللي", "دي", "ده",
    "عشان", "علشان", "ممكن", "لو سمحت", "لوسمحت", "من فضلك",
    "قولي", "هاتلي", "ورينى", "ورينا", "وريني",
    "سؤال", "سوال", "عندي", "عندى",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [14] Exam question format patterns
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAM_PATTERNS = {
    "explain": {
        "triggers": ["بم تفسر", "فسر", "علل", "اشرح لماذا", "لماذا", "ليه بتحصل"],
        "prefix": "📝 السبب هو: ",
    },
    "list": {
        "triggers": ["اذكر", "عدد", "ما هي", "ايه هي", "هات", "اكتب"],
        "prefix": "📋 ",
    },
    "compare": {
        "triggers": ["قارن بين", "قارن", "الفرق بين", "ايه الفرق"],
        "prefix": "⚖️ المقارنة:\n",
    },
    "results": {
        "triggers": ["ما النتائج", "نتائج", "ايه اللي حصل", "ماذا ترتب"],
        "prefix": "📊 النتائج:\n",
    },
    "define": {
        "triggers": ["ما المقصود", "عرف", "المقصود ب", "يعنى ايه", "يعني ايه"],
        "prefix": "📖 التعريف: ",
    },
    "correct": {
        "triggers": ["صوب", "صحح", "الخطأ في"],
        "prefix": "✏️ التصويب: ",
    },
    "complete": {
        "triggers": ["اكمل", "أكمل", "كمل"],
        "prefix": "✍️ ",
    },
    "whatif": {
        "triggers": ["ماذا يحدث لو", "ماذا لو", "لو حصل", "تخيل لو"],
        "prefix": "🤔 لو كده هيحصل: ",
    },
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [17] Rush mode triggers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RUSH_TRIGGERS = [
    "بسرعه", "بسرعة", "الحقني", "مختصر", "باختصار",
    "بسرعة يابوصلة", "بسرعة بالله", "ملخص", "سريع",
    "في سطر", "في جمله", "في كلمتين", "مش فاضي",
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [18] Detailed mode triggers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DETAIL_TRIGGERS = [
    "بالتفصيل", "شرح كامل", "شرح طويل", "مش فاهم الدرس",
    "عايز شرح", "فصل", "فصلها", "فهمني كويس",
    "من الاول", "من البدايه", "خطوه خطوه", "خطوة خطوة",
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [19] Slang abbreviation dictionary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLANG_MAP = {
    "عا": "عايز", "لو سم": "لو سمحت", "اي دا": "ايه ده",
    "ديم": "ديمقراطيه", "جغ": "جغرافيا", "تا": "تاريخ",
    "اشم": "اشمعنى", "دراسا": "دراسات", "امت": "امتحان",
    "محا": "محافظات", "كثا": "كثافه", "تضا": "تضاريس",
    "صنا": "صناعه", "زرا": "زراعه", "سيا": "سياحه",
    "اقت": "اقتصاد", "نتا": "نتائج", "بتف": "بم تفسر",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [20] Franco-Arabic transliteration map
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRANCO_CHAR_MAP = {
    "3": "ع", "7": "ح", "2": "ا", "5": "خ", "6": "ط",
    "8": "ق", "9": "ص",
}
FRANCO_WORD_MAP = {
    "masr": "مصر", "el": "ال", "nile": "نيل", "nil": "نيل",
    "democracy": "ديمقراطيه", "canal": "قناه", "suez": "سويس",
    "october": "اكتوبر", "cairo": "قاهره", "capital": "عاصمه",
    "war": "حرب", "history": "تاريخ", "geography": "جغرافيا",
    "tourism": "سياحه", "trade": "تجاره", "climate": "مناخ",
    "population": "سكان", "industry": "صناعه", "agriculture": "زراعه",
    "pollution": "تلوث", "environment": "بيئه", "energy": "طاقه",
    "dam": "سد", "pharaoh": "فرعون", "pyramid": "هرم",
    "3asma": "عاصمه", "7arb": "حرب", "mo7afzat": "محافظات",
    "so2al": "سوال", "ta5": "تاريخ", "gog": "جغرافيا",
    "salam": "سلام", "shokran": "شكرا", "ahlan": "اهلا",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [12] Indirect statement response patterns
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INDIRECT_PATTERNS = {
    "نيل": [
        "فعلاً النيل حاجة عظيمة! 🌊 هو شريان الحياة لمصر من آلاف السنين",
        "أيوه النيل ده كنز! 💧 عايز تعرف أكتر عن أهميته؟",
    ],
    "قاهره": [
        "أيوه القاهرة مدينة عظيمة! 🏙️ أكبر مدينة في أفريقيا كمان",
        "القاهرة فعلاً حاجة تانية! عايز تعرف تاريخها؟ 🇪🇬",
    ],
    "فرعون": [
        "فعلاً 😄 خصوصًا في بناء الأهرامات والتحنيط! عباقرة بجد",
        "الفراعنة كانوا متفوقين في الطب والهندسة والفلك! 🌟",
    ],
    "اهرام": [
        "الأهرامات فعلاً معجزة هندسية! 🔺 أعظم بناء في التاريخ",
        "تخيل إنهم بنوا الأهرامات من أكتر من 4500 سنة! 😮",
    ],
    "سويس": [
        "قناة السويس فعلاً فخر مصر! ⛴️ أهم ممر ملاحي في العالم",
        "أيوه القناة دي بتدخل فلوس كتير لمصر! 💰🚢",
    ],
    "اكتوبر": [
        "حرب أكتوبر فخر كل مصري! 🇪🇬💪 نصر عظيم",
        "6 أكتوبر يوم مجيد! الجيش المصري أثبت قوته ⚔️",
    ],
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [22] Egyptian teacher style phrases
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEACHER_COMMENTS = [
    "ركز معايا في النقطة دي 👀",
    "دي مهمة جدًا في الامتحان ✍️",
    "خد بالك من الجزئية دي 📌",
    "الطلبة بتتلخبط هنا كتير ⚠️",
    "دي بتيجي كتير في الامتحانات 📝",
    "حفظ النقطة دي كويس 🧠",
]

# [24] Review mode triggers
REVIEW_TRIGGERS = [
    "مراجعه", "مراجعة", "لخصلي", "لخص", "ملخص",
    "امتحان بكره", "امتحان بكرة", "مراجعه سريعه", "مراجعة سريعة",
    "اهم النقاط", "اهم الحاجات", "راجعلي",
]

# [25] Proactive follow-up templates
PROACTIVE_FOLLOWUPS = [
    "تحب أقولك سؤال امتحان على الجزئية دي؟ 😄",
    "عايز ملخص سريع للنقطة دي؟ 📋",
    "تحب نكمل في الموضوع ده ولا ننتقل لحاجة تانية؟ 🧭",
]

# [27] Human micro-comments
MICRO_COMMENTS = [
    "السؤال ده جامد 😄 ",
    "سؤال مهم! ",
    "أحسنت إنك سألت 👏 ",
    "دي جزئية ناس كتير بتسأل عنها! ",
]

# [26] Anti-copy understanding nudge
UNDERSTANDING_NUDGES = [
    "\n💡 نصيحة: حاول تفهم الإجابة مش بس تحفظها!",
    "\n🧠 الفهم أهم من الحفظ، حاول تشرحها بأسلوبك!",
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SmartEnhancementsV2 Class
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class SmartEnhancementsV2:
    """Enhancements 11-28: Advanced processing layers."""

    def __init__(self):
        self._user_profiles = {}       # [21] user_id → {level, ask_count, simple_count}
        self._user_question_log = defaultdict(list)  # [23] user_id → [last N intent_ids]
        self._response_mode = {}       # user_id → "rush"/"detail"/None
        print("[ENHANCEMENTS_V2] ✅ SmartEnhancementsV2 loaded")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [11] Strip filler words from long messages
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def strip_fillers(self, normalized_text):
        """Remove filler/padding words to extract core question."""
        try:
            words = normalized_text.split()
            if len(words) <= 4:
                return normalized_text
            filtered = [w for w in words if w not in FILLER_WORDS]
            result = " ".join(filtered).strip()
            return result if len(result) >= 3 else normalized_text
        except Exception:
            return normalized_text

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [12] Detect indirect statements and respond
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_indirect_statement(self, normalized_text):
        """Detect if user made a statement (not question) about a topic."""
        try:
            is_question = any(w in normalized_text for w in [
                "ايه", "ايش", "ليه", "ازاي", "فين", "كام", "مين",
                "اشرح", "عايز", "اعرف", "قولي", "هات",
            ])
            if is_question:
                return None

            for keyword, responses in INDIRECT_PATTERNS.items():
                if keyword in normalized_text:
                    return random.choice(responses)
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [14] Detect exam question format
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_exam_format(self, normalized_text):
        """Detect exam-style question format. Returns (format_type, prefix) or (None, None)."""
        try:
            for fmt, data in EXAM_PATTERNS.items():
                for trigger in data["triggers"]:
                    if trigger in normalized_text:
                        return fmt, data["prefix"]
            return None, None
        except Exception:
            return None, None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [15] Format response based on exam question type
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def format_exam_response(self, response, exam_format, prefix):
        """Add exam-style formatting to response."""
        try:
            if not exam_format or not prefix:
                return response
            return prefix + response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [17] Detect rush mode
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_rush_mode(self, normalized_text, user_id=None):
        """Check if student wants quick answers."""
        try:
            for trigger in RUSH_TRIGGERS:
                if trigger in normalized_text:
                    if user_id:
                        self._response_mode[str(user_id)] = "rush"
                    return True
            return False
        except Exception:
            return False

    def shorten_response(self, response):
        """Shorten response for rush mode."""
        try:
            sentences = re.split(r'[.!،,\n]', response)
            sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 5]
            if len(sentences) <= 1:
                return response
            short = sentences[0]
            if not any(e in short for e in ["😄", "🌟", "💪", "🇪🇬", "📚", "🧭"]):
                short += " ⚡"
            return short
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [18] Detect detail mode
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_detail_mode(self, normalized_text, user_id=None):
        """Check if student wants detailed explanation."""
        try:
            for trigger in DETAIL_TRIGGERS:
                if trigger in normalized_text:
                    if user_id:
                        self._response_mode[str(user_id)] = "detail"
                    return True
            return False
        except Exception:
            return False

    def expand_response(self, response):
        """Expand response for detail mode."""
        try:
            additions = [
                "\n\n🔍 بمعنى أبسط: " + response.split(".")[0].split("!")[0].strip() + " 👍" if "." in response or "!" in response else "",
                "\n\n💡 نقطة مهمة: حاول تربط المعلومة دي بالدرس اللي قبله",
            ]
            return response + random.choice(additions)
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [19] Expand slang abbreviations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def expand_slang(self, normalized_text):
        """Expand common Egyptian student slang abbreviations."""
        try:
            words = normalized_text.split()
            expanded = []
            for w in words:
                if w in SLANG_MAP:
                    expanded.append(SLANG_MAP[w])
                else:
                    expanded.append(w)
            return " ".join(expanded)
        except Exception:
            return normalized_text

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [20] Franco-Arabic transliteration
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def transliterate_franco(self, text):
        """Convert Franco-Arabic (3arabizi) to Arabic script."""
        try:
            has_arabic = any('\u0600' <= c <= '\u06FF' for c in text)
            if has_arabic:
                return text

            t = text.lower().strip()
            words = t.split()
            result = []
            converted = False
            for word in words:
                if word in FRANCO_WORD_MAP:
                    result.append(FRANCO_WORD_MAP[word])
                    converted = True
                else:
                    w = word
                    for latin, arabic in FRANCO_CHAR_MAP.items():
                        if latin in w:
                            w = w.replace(latin, arabic)
                            converted = True
                    if w in FRANCO_WORD_MAP:
                        result.append(FRANCO_WORD_MAP[w])
                    else:
                        result.append(w)

            return " ".join(result) if converted else text
        except Exception:
            return text

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [13] Discussion mode - add interactive comments
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_discussion_touch(self, response, intent_id):
        """Add discussion-style interactive element (20% chance)."""
        try:
            if random.random() > 0.20:
                return response
            discussions = {
                "suez_canal": "إنت شايف أهميتها في التجارة ولا السياحة أكتر؟ 🤔",
                "nile_importance": "في رأيك إيه أهم حاجة النيل بيوفرها لمصر؟ 💧",
                "october_war": "إيه أكتر حاجة بتفخر بيها في الحرب دي؟ 🇪🇬",
                "egypt_tourism": "إنت زرت أماكن سياحية في مصر قبل كده؟ 🏖️",
                "pollution": "في رأيك إيه أكتر نوع تلوث محتاجين نحاربه؟ 🤔",
                "volunteering": "جربت تتطوع قبل كده؟ 🤝",
            }
            followup = discussions.get(intent_id)
            if followup:
                return f"{response}\n\n{followup}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [16] Add real-life examples
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_example(self, response, intent_id):
        """Add a real-life example to educational responses (15% chance)."""
        try:
            if random.random() > 0.15:
                return response
            examples = {
                "population_density": "\n🏫 زي الفصل وقت الفسحة — ناس كتير في مكان صغير!",
                "trade": "\n🚚 زي لما محل بيجيب بضاعة من مصنع في محافظة تانية",
                "democracy_meaning": "\n🗳️ زي اختيار كابتن الفصل — كل واحد بيصوت",
                "pollution": "\n🚗 زي لما تمشي ورا عربية عوادمها كتير وتكح",
                "suez_canal": "\n🗺️ تخيل إنك عايز تروح من البيت للمدرسة — فيه طريق مختصر وطريق طويل",
                "citizenship": "\n🏠 زي لما تحافظ على نضافة أوضتك — ده واجبك تجاه بيتك",
            }
            example = examples.get(intent_id)
            if example:
                return response + example
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [21] Student level tracking
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def track_student_level(self, user_id, normalized_text):
        """Track student's level based on their language patterns."""
        try:
            uid = str(user_id)
            if uid not in self._user_profiles:
                self._user_profiles[uid] = {"level": "medium", "asks": 0, "simple_asks": 0}

            profile = self._user_profiles[uid]
            profile["asks"] += 1

            advanced_words = ["النتائج المترتبه", "بم تفسر", "قارن بين", "علل", "المقصود"]
            simple_words = ["ايه", "ايش", "مش فاهم", "ازاي", "ببساطه"]

            if any(w in normalized_text for w in advanced_words):
                profile["level"] = "advanced"
            elif any(w in normalized_text for w in simple_words):
                profile["simple_asks"] += 1
                if profile["simple_asks"] > 3:
                    profile["level"] = "beginner"

            if len(self._user_profiles) > 100:
                oldest = min(self._user_profiles.keys(), key=lambda k: self._user_profiles[k]["asks"])
                del self._user_profiles[oldest]
        except Exception:
            pass

    def get_student_level(self, user_id):
        """Get student's tracked level."""
        try:
            return self._user_profiles.get(str(user_id), {}).get("level", "medium")
        except Exception:
            return "medium"

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [22] Egyptian teacher style
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_teacher_comment(self, response):
        """Add teacher-like comment (15% chance)."""
        try:
            if random.random() > 0.15:
                return response
            comment = random.choice(TEACHER_COMMENTS)
            return f"{comment}\n{response}"
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [23] Repeated question detection
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def is_repeated_question(self, user_id, intent_id):
        """Check if user asked about this intent recently."""
        try:
            uid = str(user_id)
            log = self._user_question_log.get(uid, [])
            return intent_id in log[-5:]
        except Exception:
            return False

    def log_question(self, user_id, intent_id):
        """Log that user asked about this intent."""
        try:
            uid = str(user_id)
            self._user_question_log[uid].append(intent_id)
            if len(self._user_question_log[uid]) > 20:
                self._user_question_log[uid] = self._user_question_log[uid][-20:]
        except Exception:
            pass

    def get_varied_repeat_response(self, response):
        """Modify response when question is repeated."""
        try:
            prefixes = [
                "زي ما قلتلك قبل كده: ",
                "هفكرك تاني: ",
                "مرة تانية بطريقة مختلفة: ",
                "أوكي هعيدها بشكل تاني: ",
            ]
            return random.choice(prefixes) + response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [24] Review mode
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_review_mode(self, normalized_text):
        """Check if student wants review/summary mode."""
        try:
            for trigger in REVIEW_TRIGGERS:
                if trigger in normalized_text:
                    return True
            return False
        except Exception:
            return False

    def format_review_response(self, response):
        """Format response as review bullet points."""
        try:
            header = "📋 مراجعة سريعة:\n"
            sentences = re.split(r'[.!،\n]', response)
            sentences = [s.strip() for s in sentences if len(s.strip()) > 5]
            if len(sentences) <= 1:
                return header + "• " + response
            bullets = "\n".join(f"• {s}" for s in sentences[:4])
            return header + bullets + "\n\n✍️ حاول تراجع النقط دي كويس!"
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [25] Proactive follow-up
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_proactive_followup(self, response):
        """Add proactive follow-up question (10% chance)."""
        try:
            if random.random() > 0.10:
                return response
            return response + "\n\n" + random.choice(PROACTIVE_FOLLOWUPS)
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [26] Anti-copy understanding nudge
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_copy_request(self, normalized_text):
        """Detect if student just wants to copy answer."""
        try:
            triggers = ["هات الاجابه", "هات الاجابة", "ابعتها زي ما هي",
                        "عايز الحل", "الاجابة بس", "الجواب بس"]
            return any(t in normalized_text for t in triggers)
        except Exception:
            return False

    def add_understanding_nudge(self, response):
        """Add a gentle understanding encouragement."""
        try:
            return response + random.choice(UNDERSTANDING_NUDGES)
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [27] Human micro-comments
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_micro_comment(self, response):
        """Add a small human-like comment (12% chance)."""
        try:
            if random.random() > 0.12:
                return response
            return random.choice(MICRO_COMMENTS) + response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [28] Prevent rigid responses
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def humanize_fallback(self, response):
        """Replace robotic phrases with warm alternatives."""
        try:
            rigid_map = {
                "لم أفهم": "مش متأكد إني فهمت السؤال 🤔",
                "أعد صياغة السؤال": "جرب تسأل بطريقة تانية 😊",
                "حدث خطأ": "في حاجة غريبة حصلت 😅",
                "غير مدعوم": "مش قادر أجاوب على ده دلوقتي",
                "خارج النطاق": "ده مش تخصصي بس ممكن أساعدك في الدراسات 📚",
            }
            for rigid, warm in rigid_map.items():
                if rigid in response:
                    response = response.replace(rigid, warm)
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Apply all v2 post-processing
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def post_process(self, response, intent_id, user_id, normalized_text):
        """Apply all v2 post-processing enhancements to a response."""
        try:
            uid = str(user_id) if user_id else None

            # [14/15] Exam format styling
            exam_fmt, exam_prefix = self.detect_exam_format(normalized_text)
            if exam_fmt:
                response = self.format_exam_response(response, exam_fmt, exam_prefix)

            # [17] Rush mode → shorten
            if uid and self._response_mode.get(uid) == "rush":
                response = self.shorten_response(response)
                self._response_mode[uid] = None
                return response  # Skip other decorations in rush mode

            # [18] Detail mode → expand
            if uid and self._response_mode.get(uid) == "detail":
                response = self.expand_response(response)
                self._response_mode[uid] = None

            # [24] Review mode
            if self.detect_review_mode(normalized_text):
                response = self.format_review_response(response)
                return response

            # [23] Repeated question → vary response
            if uid and intent_id and self.is_repeated_question(uid, intent_id):
                response = self.get_varied_repeat_response(response)

            # [22] Teacher style (15% chance)
            response = self.add_teacher_comment(response)
            # [13] Discussion mode (20% chance)
            if intent_id:
                response = self.add_discussion_touch(response, intent_id)
            # [16] Real-life examples (15% chance)
            if intent_id:
                response = self.add_example(response, intent_id)
            # [27] Micro-comments (12% chance)
            response = self.add_micro_comment(response)
            # [25] Proactive follow-up (10% chance)
            response = self.add_proactive_followup(response)
            # [26] Anti-copy nudge
            if self.detect_copy_request(normalized_text):
                response = self.add_understanding_nudge(response)
            # [28] Humanize
            response = self.humanize_fallback(response)

            # [21] Track level
            if uid:
                self.track_student_level(uid, normalized_text)
            # [23] Log question
            if uid and intent_id:
                self.log_question(uid, intent_id)

            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Apply all v2 pre-processing
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def pre_process(self, text, normalized_text, user_id=None):
        """Apply all v2 pre-processing enhancements. Returns modified normalized_text."""
        try:
            t = normalized_text

            # [20] Franco-Arabic transliteration (on original text)
            t = self.transliterate_franco(t)
            # [19] Slang abbreviation expansion
            t = self.expand_slang(t)
            # [11] Strip fillers from long messages
            t = self.strip_fillers(t)
            # [17] Detect rush mode
            self.detect_rush_mode(t, user_id)
            # [18] Detect detail mode
            self.detect_detail_mode(t, user_id)

            return t
        except Exception:
            return normalized_text
