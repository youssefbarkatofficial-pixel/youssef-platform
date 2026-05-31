"""
smart_enhancements.py - 10 Enhancement Layers for SmartBotBrain
================================================================
ADDITIVE ONLY - Extends ai_core.py without modifying it.
FAIL-SAFE    - If any enhancement fails, the base system continues.
OFFLINE      - No external APIs. Everything local.
MODULAR      - Can be deleted without affecting ai_core.py.
"""

import re
import random
import time
from collections import defaultdict

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Enhancement Constants
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# [Enhancement 1] Weighted educational keywords for semantic matching
WEIGHTED_KEYWORDS = {
    # weight 3 = highly specific educational term
    "عاصمه": 3, "عاصمة": 3, "نيل": 3, "ديمقراطيه": 3, "ديمقراطية": 3,
    "فرعون": 3, "فراعنه": 3, "اهرام": 3, "سويس": 3, "قناه": 3, "قناة": 3,
    "اكتوبر": 3, "محمد علي": 3, "سد": 3, "عالي": 2,
    "سكان": 3, "كثافه": 3, "كثافة": 3, "تضاريس": 3,
    "محافظ": 3, "ساحل": 3, "ساحليه": 3,
    "مناخ": 3, "طقس": 3, "محصول": 3, "محاصيل": 3,
    "زراعه": 3, "زراعة": 3, "صناعه": 3, "صناعة": 3,
    "سياحه": 3, "سياحة": 3, "تلوث": 3, "بيئه": 3, "بيئة": 3,
    "طاقه": 3, "طاقة": 3, "تجاره": 3, "تجارة": 3,
    "نقل": 2, "مواصلات": 3, "موارد": 3, "تنميه": 3, "تنمية": 3,
    "تطوع": 3, "مواطنه": 3, "مواطنة": 3, "حقوق": 3, "واجب": 3,
    "خريطه": 3, "خريطة": 3, "خرائط": 3,
    "طول": 2, "عرض": 2, "خطوط": 2, "دوائر": 2,
    "قبطي": 3, "اسلامي": 3, "ثوره": 3, "ثورة": 3,
    "حيوان": 2, "ثروه": 3, "ثروة": 3,
    "اقتصاد": 3, "حكم": 2, "جمهوريه": 3,
    "محميه": 3, "محمية": 3, "محميات": 3,
    # weight 2 = moderately specific
    "مصر": 2, "حرب": 2, "تاريخ": 2, "جغرافيا": 2,
    "حضاره": 2, "حضارة": 2, "بحر": 2,
    # weight 1 = common/stop-like words (low importance)
    "ايه": 1, "ايش": 1, "يعني": 1, "هي": 1, "هو": 1,
    "عايز": 1, "اعرف": 1, "اشرح": 1, "قولي": 1, "فين": 1,
    "ليه": 1, "ازاي": 1, "كام": 1, "اد": 1,
}

# [Enhancement 2] Topic keyword → intent_id mapping for short messages
TOPIC_TO_INTENT = {
    "نيل": "nile_importance",
    "عاصمه": "capital_of_egypt", "عاصمة": "capital_of_egypt", "قاهره": "capital_of_egypt",
    "ديمقراطيه": "democracy_meaning", "ديمقراطية": "democracy_meaning", "ديموقراطيه": "democracy_meaning",
    "فرعون": "pharaonic_civilization", "فراعنه": "pharaonic_civilization", "اهرام": "pharaonic_civilization",
    "سويس": "suez_canal", "قناه": "suez_canal", "قناة": "suez_canal",
    "اكتوبر": "october_war",
    "محمد علي": "muhammad_ali",
    "سد": "high_dam", "سد عالي": "high_dam",
    "سكان": "egypt_population", "تعداد": "egypt_population",
    "كثافه": "population_density", "كثافة": "population_density",
    "تضاريس": "egypt_terrain",
    "محافظ": "coastal_governorates", "ساحل": "coastal_governorates",
    "مناخ": "egypt_climate", "طقس": "egypt_climate",
    "محصول": "agricultural_crops", "محاصيل": "agricultural_crops",
    "زراعه": "modern_agriculture", "زراعة": "modern_agriculture",
    "صناعه": "egypt_industry", "صناعة": "egypt_industry",
    "سياحه": "egypt_tourism", "سياحة": "egypt_tourism",
    "تلوث": "pollution",
    "بيئه": "environment", "بيئة": "environment",
    "طاقه": "energy_sources", "طاقة": "energy_sources",
    "تجاره": "trade", "تجارة": "trade",
    "نقل": "transportation", "مواصلات": "transportation",
    "موارد": "natural_resources",
    "تنميه": "development", "تنمية": "development",
    "تطوع": "volunteering",
    "مواطنه": "citizenship", "مواطنة": "citizenship",
    "حقوق": "child_rights",
    "واجب": "citizen_duties", "واجبات": "citizen_duties",
    "خريطه": "maps_intro", "خرائط": "maps_intro",
    "قبطي": "coptic_era",
    "اسلامي": "islamic_era",
    "ثوره 1919": "revolution_1919", "سعد زغلول": "revolution_1919",
    "حيوان": "animal_wealth", "ثروه حيوانيه": "animal_wealth",
    "اقتصاد": "egyptian_economy",
    "محميه": "nature_reserves", "محميات": "nature_reserves",
    "حكم": "government_system",
    "وجه قبلي": "upper_lower_egypt", "وجه بحري": "upper_lower_egypt",
    "صعيد": "upper_lower_egypt", "دلتا": "upper_lower_egypt",
    "خطوط طول": "longitude_lines",
    "دوائر عرض": "latitude_lines",
}

# [Enhancement 3] Continuation phrases (context follow-up)
CONTINUATION_PHRASES = [
    "ليه", "ليه كده", "طب ليه", "وليه", "ليه بقى",
    "يعني ايه", "يعنى ايه", "يعني اي",
    "وبعدين", "وبعدها", "طب وبعدها", "وبعد كده",
    "كمل", "كمان", "زود", "اكتر", "اكثر",
    "وايه كمان", "وايه تاني", "ايه كمان",
    "طيب", "طب", "اوك", "ماشي",
    "ده ليه", "دي ليه", "ليه مهم", "ليه مهمه",
]

# [Enhancement 5] Smart clarification templates per topic group
SMART_CLARIFICATIONS = {
    "سياحه": "تقصد أهمية السياحة لمصر ولا أنواع السياحة؟ 😊🏖️",
    "سياحة": "تقصد أهمية السياحة لمصر ولا أنواع السياحة؟ 😊🏖️",
    "سكان": "حابب تعرف عدد السكان ولا الكثافة السكانية؟ 📊",
    "حضاره": "الحضارة الفرعونية ولا العصر الإسلامي ولا القبطي؟ 🏛️",
    "حضارة": "الحضارة الفرعونية ولا العصر الإسلامي ولا القبطي؟ 🏛️",
    "حرب": "تقصد حرب أكتوبر 1973 ولا حاجة تانية؟ ⚔️",
    "ثوره": "ثورة 1919 بتاعة سعد زغلول؟ ✊🇪🇬",
    "ثورة": "ثورة 1919 بتاعة سعد زغلول؟ ✊🇪🇬",
    "زراعه": "عايز تعرف عن المحاصيل ولا الزراعة الحديثة؟ 🌾",
    "زراعة": "عايز تعرف عن المحاصيل ولا الزراعة الحديثة؟ 🌾",
    "طاقه": "تقصد مصادر الطاقة في مصر ولا الطاقة المتجددة؟ ⚡",
    "طاقة": "تقصد مصادر الطاقة في مصر ولا الطاقة المتجددة؟ ⚡",
    "بحر": "تقصد المحافظات الساحلية ولا البحر الأحمر ولا المتوسط؟ 🌊",
    "خريطه": "عايز تعرف عناصر الخريطة ولا أنواع الخرائط؟ 🗺️",
    "خريطة": "عايز تعرف عناصر الخريطة ولا أنواع الخرائط؟ 🗺️",
}

# [Enhancement 6] Teaching follow-up questions
TEACHING_FOLLOWUPS = {
    "nile_importance": [
        "طب تعرف النيل بيجي منين ومنبعه فين؟ 🌍",
        "تعرف إن السد العالي اتبنى عشان ينظم مية النيل؟ 🏗️",
    ],
    "capital_of_egypt": [
        "طب تعرف القاهرة اتأسست امتى؟ 🤔",
        "هل تعرف إن القاهرة أكبر مدينة في أفريقيا؟ 🌍",
    ],
    "suez_canal": [
        "طب تعرف القناة الجديدة اتفتحت سنة كام؟ 🚢",
        "هل تعرف كام سفينة بتعدي القناة كل يوم تقريبًا؟ ⛴️",
    ],
    "october_war": [
        "طب تعرف مين كان رئيس مصر وقتها؟ 🤔",
        "هل تعرف ليه بنحتفل بـ 6 أكتوبر كل سنة؟ 🇪🇬",
    ],
    "pharaonic_civilization": [
        "طب تعرف كام هرم في مصر؟ 🔺",
        "هل تعرف إيه هي الكتابة الهيروغليفية؟ 📜",
    ],
    "high_dam": [
        "طب تعرف السد العالي موجود في أنهي محافظة؟ 🏗️",
        "هل تعرف إيه هي بحيرة ناصر؟ 💧",
    ],
    "democracy_meaning": [
        "طب تعرف إيه هي الانتخابات وبتتم ازاي؟ 🗳️",
    ],
    "muhammad_ali": [
        "طب تعرف محمد علي جه من أنهي بلد؟ 🤔",
    ],
}

# [Enhancement 7] Emotion keywords and responses
EMOTION_KEYWORDS = {
    "negative": [
        "زهقان", "زهق", "تعبان", "تعب", "خايف", "خوف", "قلقان", "قلق",
        "مش فاهم", "صعب", "صعبه", "فاشل", "محبط", "يائس", "ضايق",
        "مش عارف", "ضغط", "توتر", "متوتر", "مكتئب", "حزين", "زعلان",
        "مش قادر", "مليش نفس", "كرهت", "بكره", "مفيش فايده",
    ],
    "positive": [
        "فرحان", "فرح", "مبسوط", "شاطر", "جامد", "عظيم", "حلو",
        "فهمت", "استوعبت", "سهل", "بسيط", "نجحت", "جبت درجه",
        "تمام", "حبيت", "رائع", "ممتاز",
    ],
}

EMOTIONAL_SUPPORT_RESPONSES = [
    "أنا فاهم إحساسك يا بطل 💙 بس صدقني كل حاجة بتعدي!",
    "خد نفس عميق 🌬️ وابدأ خطوة صغيرة، مش لازم تخلص كل حاجة دلوقتي",
    "كلنا بنحس كده أحيانًا 🤗 المهم متستسلمش!",
    "أنت أقوى مما تفتكر يا بطل 💪 ثق في نفسك!",
    "المذاكرة مش سباق ⏰ خد وقتك وابدأ بالسهل الأول",
    "تعرف إن أنجح الناس في العالم فشلوا أكتر من مرة؟ 🌟 المهم تكمل!",
]

POSITIVE_REINFORCEMENT_RESPONSES = [
    "ده كلام! أنت بطل فعلاً 🏆💪",
    "برافو عليك يا معلم! كمل كده 🌟🔥",
    "ماشاء الله عليك! فخور بيك 😍👏",
    "أنت مثال لكل الطلبة! كمل 🚀✨",
]

# [Enhancement 8] Pronoun indicators
PRONOUN_WORDS = {
    "هو": True, "هي": True, "ده": True, "دي": True, "دا": True,
    "فيه": True, "فيها": True, "فيهم": True, "عنه": True, "عنها": True,
    "بتاعه": True, "بتاعته": True, "بتاعها": True,
    "منه": True, "منها": True, "ليه": True, "ليها": True,
    "عليه": True, "عليها": True,
}

# [Enhancement 9] Response opening variety
RESPONSE_OPENERS = [
    "", "يا بطل، ", "يا معلم، ", "يا كبير، ", "أيوه، ",
    "صح سؤالك، ", "سؤال جميل! ", "أحسنت إنك سألت! ",
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SmartEnhancements Class
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class SmartEnhancements:
    """
    10 Enhancement Layers for SmartBotBrain.
    Each method is independent and fail-safe.
    """

    def __init__(self):
        self._response_history = defaultdict(list)  # user_id → [last N responses]
        self._confusion_counter = defaultdict(int)   # user_id → confusion count
        self._enhanced_context = {}                   # user_id → enhanced context
        self._max_response_history = 10
        print("[ENHANCEMENTS] ✅ SmartEnhancements loaded")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [1] Semantic Loose Matching (word-order independent)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def semantic_keyword_match(self, normalized_text, intents, normalize_fn):
        """Match based on weighted keyword overlap, ignoring word order."""
        try:
            input_tokens = set(normalized_text.split())
            if not input_tokens:
                return None, 0.0

            # Calculate input weight
            input_weight = sum(WEIGHTED_KEYWORDS.get(t, 0.5) for t in input_tokens)
            if input_weight == 0:
                return None, 0.0

            best_match = None
            best_score = 0.0

            for intent in intents:
                for phrase in intent.get("phrases", []):
                    norm_phrase = normalize_fn(phrase)
                    phrase_tokens = set(norm_phrase.split())
                    if not phrase_tokens:
                        continue

                    # Weighted intersection
                    common = input_tokens & phrase_tokens
                    if not common:
                        continue

                    common_weight = sum(WEIGHTED_KEYWORDS.get(t, 0.5) for t in common)
                    phrase_weight = sum(WEIGHTED_KEYWORDS.get(t, 0.5) for t in phrase_tokens)

                    # Harmonic mean of recall and precision (weighted)
                    if input_weight > 0 and phrase_weight > 0:
                        recall = common_weight / input_weight
                        precision = common_weight / phrase_weight
                        if recall + precision > 0:
                            score = 2 * (recall * precision) / (recall + precision)
                        else:
                            score = 0.0
                    else:
                        score = 0.0

                    if score > best_score:
                        best_score = score
                        best_match = intent

            # Threshold: 60% weighted keyword match
            if best_match and best_score >= 0.55:
                return best_match, best_score
            return None, 0.0
        except Exception as e:
            print(f"[ENHANCE_ERROR] semantic_keyword_match: {e}")
            return None, 0.0

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [2] Short Message Intent Expansion
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def expand_short_message(self, normalized_text, intents):
        """If message is 1-2 words, try to find a matching intent directly."""
        try:
            words = normalized_text.split()
            if len(words) > 3:
                return None, None

            text_clean = normalized_text.replace("?", "").replace("!", "").strip()

            # Check multi-word topics first (longer matches first)
            for keyword in sorted(TOPIC_TO_INTENT.keys(), key=len, reverse=True):
                if keyword in text_clean or text_clean in keyword:
                    intent_id = TOPIC_TO_INTENT[keyword]
                    # Find the intent object
                    for intent in intents:
                        if intent.get("intent_id") == intent_id:
                            return intent, intent_id
            return None, None
        except Exception as e:
            print(f"[ENHANCE_ERROR] expand_short_message: {e}")
            return None, None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [3] Enhanced Context Memory + Continuation Detection
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def is_continuation_request(self, normalized_text):
        """Check if user wants to continue previous topic."""
        try:
            text_clean = normalized_text.strip()
            for phrase in CONTINUATION_PHRASES:
                if text_clean == phrase or text_clean.startswith(phrase + " "):
                    return True
                if phrase in text_clean and len(text_clean) < 25:
                    return True
            return False
        except Exception:
            return False

    def update_enhanced_context(self, user_id, topic=None, entities=None, intent_id=None, response=None):
        """Store richer context per user."""
        try:
            uid = str(user_id)
            if uid not in self._enhanced_context:
                self._enhanced_context[uid] = {
                    "topics": [], "entities": [], "last_intent": None,
                    "last_response": None, "timestamp": 0
                }
            ctx = self._enhanced_context[uid]
            if topic:
                ctx["topics"] = ([topic] + ctx["topics"])[:5]
            if entities:
                ctx["entities"] = (entities + ctx["entities"])[:10]
            if intent_id:
                ctx["last_intent"] = intent_id
            if response:
                ctx["last_response"] = response
            ctx["timestamp"] = time.time()

            # Limit total users
            if len(self._enhanced_context) > 60:
                oldest = min(self._enhanced_context.items(), key=lambda x: x[1]["timestamp"])
                del self._enhanced_context[oldest[0]]
        except Exception:
            pass

    def get_last_topic(self, user_id):
        """Get last discussed topic for a user."""
        try:
            uid = str(user_id)
            ctx = self._enhanced_context.get(uid, {})
            topics = ctx.get("topics", [])
            return topics[0] if topics else None
        except Exception:
            return None

    def get_last_intent_id(self, user_id):
        """Get last intent ID for a user."""
        try:
            uid = str(user_id)
            return self._enhanced_context.get(uid, {}).get("last_intent")
        except Exception:
            return None

    def handle_continuation(self, user_id, intents, base_context):
        """Handle 'ليه', 'كمل', 'وبعدين' etc. by referencing last topic."""
        try:
            last_intent_id = self.get_last_intent_id(user_id)
            if not last_intent_id:
                # Try from base context
                last_intent_id = base_context.get("last_intent") if base_context else None

            if not last_intent_id:
                return None

            # Find the intent
            for intent in intents:
                if intent.get("intent_id") == last_intent_id:
                    templates = intent.get("response_templates", [])
                    last_resp = self._enhanced_context.get(str(user_id), {}).get("last_response", "")
                    # Pick different response
                    available = [t for t in templates if t != last_resp]
                    if available:
                        resp = random.choice(available)
                    elif templates:
                        resp = random.choice(templates)
                    else:
                        return None

                    prefixes = [
                        "كمان عن الموضوع ده: ",
                        "أقولك حاجة تانية: ",
                        "كمالة الكلام: ",
                        "طيب سمع دي كمان: ",
                    ]
                    return random.choice(prefixes) + resp
            return None
        except Exception as e:
            print(f"[ENHANCE_ERROR] handle_continuation: {e}")
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [4] Fuzzy Spelling Correction
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def fuzzy_correct(self, normalized_text):
        """Apply common Egyptian Arabic spelling corrections internally."""
        try:
            t = normalized_text

            # Common misspellings → corrections
            corrections = {
                "الدمقراطيه": "الديمقراطيه",
                "الدموقراطيه": "الديمقراطيه",
                "دمقراطيه": "ديمقراطيه",
                "عصمه": "عاصمه",
                "عصمة": "عاصمه",
                "انيل": "النيل",
                "الانيل": "النيل",
                "نهرالنيل": "نهر النيل",
                "قناه السوس": "قناة السويس",
                "قناة السوس": "قناة السويس",
                "اكتوبرر": "اكتوبر",
                "اوكتوبر": "اكتوبر",
                "محمدعلي": "محمد علي",
                "محمدعلى": "محمد علي",
                "الكسافه": "الكثافه",
                "التداريس": "التضاريس",
                "الحيونيه": "الحيوانيه",
                "الحيونية": "الحيوانية",
                "الضراعه": "الزراعه",
                "سياحه مصر": "السياحه في مصر",
                "المحامي": "المحميات",
                "المحامية": "المحميات",
                "السدالعالي": "السد العالي",
                "الصاعة": "الصناعه",
                "الصناة": "الصناعه",
                "المولصلات": "المواصلات",
                "المولصات": "المواصلات",
            }

            for wrong, right in corrections.items():
                if wrong in t:
                    t = t.replace(wrong, right)

            # Additional: remove doubled chars that shouldn't be doubled
            # e.g., "اكتوبرر" → "اكتوبر" (already handled by normalize)

            return t
        except Exception:
            return normalized_text

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [5] Smart Clarification (ask instead of failing)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def generate_smart_clarification(self, normalized_text):
        """Generate a smart clarification question based on detected topic."""
        try:
            # Check specific clarification templates
            for keyword, clarification in SMART_CLARIFICATIONS.items():
                if keyword in normalized_text:
                    return clarification

            # Generic smart clarification
            words = normalized_text.split()
            if len(words) <= 3:
                return f"موضوع حلو! 🧐 ممكن توضح أكتر عايز تعرف إيه بالظبط؟"
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [6] Teaching Mode (ask follow-up questions)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_teaching_followup(self, response, intent_id):
        """Randomly add an educational follow-up question (30% chance)."""
        try:
            if random.random() > 0.3:  # 70% of the time, just return normal response
                return response

            followups = TEACHING_FOLLOWUPS.get(intent_id, [])
            if not followups:
                return response

            followup = random.choice(followups)
            return f"{response}\n\n{followup}"
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [7] Emotion Detection
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_emotion(self, normalized_text):
        """Detect basic emotion from text. Returns 'negative', 'positive', or None."""
        try:
            for keyword in EMOTION_KEYWORDS["negative"]:
                if keyword in normalized_text:
                    return "negative"
            for keyword in EMOTION_KEYWORDS["positive"]:
                if keyword in normalized_text:
                    return "positive"
            return None
        except Exception:
            return None

    def get_emotional_response(self, emotion, user_id=None):
        """Get an emotion-appropriate response."""
        try:
            if emotion == "negative":
                resp = random.choice(EMOTIONAL_SUPPORT_RESPONSES)
                if user_id:
                    self._confusion_counter[str(user_id)] += 1
                return resp
            elif emotion == "positive":
                return random.choice(POSITIVE_REINFORCEMENT_RESPONSES)
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [8] Pronoun Resolution
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def resolve_pronouns(self, normalized_text, user_id):
        """Replace pronouns with last known topic entity."""
        try:
            words = normalized_text.split()
            if len(words) > 5:  # Only for short messages
                return normalized_text

            has_pronoun = any(w in PRONOUN_WORDS for w in words)
            if not has_pronoun:
                return normalized_text

            last_topic = self.get_last_topic(user_id)
            if not last_topic:
                return normalized_text

            # Prepend topic context to the message
            return f"{last_topic} {normalized_text}"
        except Exception:
            return normalized_text

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [9] Response Diversity (no repeats)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def pick_diverse_response(self, templates, user_id):
        """Pick a response that hasn't been used recently for this user."""
        try:
            uid = str(user_id) if user_id else "anon"
            history = self._response_history.get(uid, [])

            # Filter out recently used responses
            available = [t for t in templates if t not in history]
            if not available:
                # Reset history if all used
                self._response_history[uid] = []
                available = templates

            response = random.choice(available) if available else random.choice(templates)

            # Add opener variety (20% chance)
            if random.random() < 0.2 and not response.startswith("يا"):
                opener = random.choice(RESPONSE_OPENERS)
                if opener:
                    response = opener + response

            # Track history
            self._response_history[uid].append(response)
            if len(self._response_history[uid]) > self._max_response_history:
                self._response_history[uid] = self._response_history[uid][-self._max_response_history:]

            return response
        except Exception:
            return random.choice(templates) if templates else ""

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [10] Adaptive Explanation Mode
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def check_confusion_level(self, user_id):
        """Check how confused the user is (repeated 'مش فاهم' etc)."""
        try:
            return self._confusion_counter.get(str(user_id), 0)
        except Exception:
            return 0

    def simplify_response(self, response, confusion_level):
        """Simplify a response if user is confused (level 2+)."""
        try:
            if confusion_level < 2:
                return response

            # Add simplification prefix
            simplifiers = [
                "يلا نبسطها أوي: ",
                "تخيل كده: ",
                "بأبسط طريقة ممكنة: ",
                "زي ما بنقول بالبلدي: ",
            ]
            prefix = random.choice(simplifiers)

            # Shorten very long responses
            if len(response) > 100:
                # Take first sentence only
                sentences = response.split(".")
                if len(sentences) > 1:
                    response = sentences[0].strip() + " 😊"

            return prefix + response
        except Exception:
            return response

    def reset_confusion(self, user_id):
        """Reset confusion counter when user shows understanding."""
        try:
            uid = str(user_id)
            if uid in self._confusion_counter:
                self._confusion_counter[uid] = 0
        except Exception:
            pass

    def extract_topic_entity(self, normalized_text, intent_id=None):
        """Extract a topic entity name from text for context tracking."""
        try:
            # If intent matched, use intent topic mapping
            intent_topics = {
                "nile_importance": "النيل",
                "capital_of_egypt": "القاهره",
                "suez_canal": "قناة السويس",
                "october_war": "حرب اكتوبر",
                "pharaonic_civilization": "الفراعنه",
                "high_dam": "السد العالي",
                "muhammad_ali": "محمد علي",
                "democracy_meaning": "الديمقراطيه",
                "egypt_population": "سكان مصر",
                "population_density": "الكثافه السكانيه",
                "egypt_terrain": "تضاريس مصر",
                "egypt_climate": "مناخ مصر",
                "egypt_tourism": "السياحه",
                "egypt_industry": "الصناعه",
                "agricultural_crops": "المحاصيل",
                "modern_agriculture": "الزراعه الحديثه",
                "pollution": "التلوث",
                "environment": "البيئه",
                "energy_sources": "الطاقه",
                "trade": "التجاره",
                "transportation": "النقل",
                "natural_resources": "الموارد",
                "development": "التنميه",
                "volunteering": "التطوع",
                "citizenship": "المواطنه",
                "citizen_duties": "واجبات المواطن",
                "child_rights": "حقوق الطفل",
                "coptic_era": "العصر القبطي",
                "islamic_era": "العصر الاسلامي",
                "revolution_1919": "ثورة 1919",
                "coastal_governorates": "المحافظات الساحليه",
                "animal_wealth": "الثروه الحيوانيه",
                "egyptian_economy": "الاقتصاد",
                "nature_reserves": "المحميات",
                "government_system": "نظام الحكم",
                "upper_lower_egypt": "الوجه القبلي والبحري",
                "maps_intro": "الخرائط",
                "longitude_lines": "خطوط الطول",
                "latitude_lines": "دوائر العرض",
                "local_councils": "المجالس المحليه",
            }
            if intent_id and intent_id in intent_topics:
                return intent_topics[intent_id]

            # Fallback: use longest matching keyword from text
            for kw in sorted(TOPIC_TO_INTENT.keys(), key=len, reverse=True):
                if kw in normalized_text:
                    return kw
            return None
        except Exception:
            return None
