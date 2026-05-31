"""
smart_enhancements_v4.py - Enhancements 51-70 for SmartBotBrain
================================================================
ADDITIVE ONLY / FAIL-SAFE / OFFLINE / MODULAR

Skipped (already in v1/v2/v3):
  #55(=v1#10), #56(=thresholds), #57(=v1#5), #58(=v2#27+v3#36),
  #59(=context), #62(=v1#5), #65(=v1#4), #67(=v1#9), #69(=v2#27)
"""

import re
import random
from collections import defaultdict


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [51/52] Multi-layer message analysis signals
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URGENCY_SIGNALS = [
    "بسرعه", "بسرعة", "الحقني", "بكره", "بكرة",
    "امتحان", "مش لاحق", "الوقت", "ضيق", "مستعجل",
]
ANXIETY_SIGNALS = [
    "خايف", "قلقان", "متوتر", "هسقط", "مش هعرف",
    "ضغط", "توتر", "رعب", "خوف",
]
CURIOSITY_SIGNALS = [
    "ليه", "ازاي", "فين", "كام", "يعني ايه",
    "عايز اعرف", "حابب افهم", "طب ليه",
]
BOREDOM_SIGNALS = [
    "زهقان", "زهق", "مللت", "ملل", "طفشت", "بلاها",
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [53/54/66] Topic graph + next question predictions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOPIC_GRAPH = {
    "nile_importance": {
        "related": ["agricultural_crops", "high_dam", "egypt_terrain", "pharaonic_civilization"],
        "suggestions": [
            "تحب تعرف علاقة النيل بالزراعة؟ 🌾",
            "عايز تعرف ليه بنوا السد العالي؟ 🏗️",
        ],
    },
    "capital_of_egypt": {
        "related": ["egypt_population", "population_density", "pharaonic_civilization"],
        "suggestions": [
            "تحب تعرف عدد سكان القاهرة؟ 📊",
            "عايز تعرف تاريخ القاهرة؟ 🏛️",
        ],
    },
    "suez_canal": {
        "related": ["trade", "transportation", "egyptian_economy"],
        "suggestions": [
            "تحب تعرف تأثير القناة على التجارة؟ 📦",
            "عايز تعرف دخل القناة لمصر؟ 💰",
        ],
    },
    "october_war": {
        "related": ["muhammad_ali", "revolution_1919", "citizenship"],
        "suggestions": [
            "تحب تعرف عن ثورة 1919 كمان؟ ✊",
            "عايز تعرف إيه اللي تغير بعد الحرب؟ 🇪🇬",
        ],
    },
    "pharaonic_civilization": {
        "related": ["nile_importance", "egypt_tourism", "coptic_era"],
        "suggestions": [
            "تحب تعرف عن الحضارة القبطية بعدها؟ ✝️",
            "عايز تعرف أهم الآثار الفرعونية؟ 🏛️",
        ],
    },
    "democracy_meaning": {
        "related": ["government_system", "citizen_duties", "child_rights", "local_councils"],
        "suggestions": [
            "تحب تعرف عن واجبات المواطن؟ 📋",
            "عايز تفهم نظام الحكم في مصر؟ 🏛️",
        ],
    },
    "high_dam": {
        "related": ["nile_importance", "energy_sources", "agricultural_crops"],
        "suggestions": [
            "تحب تعرف فوايد السد في الكهربا؟ ⚡",
            "عايز تعرف بحيرة ناصر اتعملت ازاي؟ 💧",
        ],
    },
    "egypt_climate": {
        "related": ["egypt_terrain", "agricultural_crops", "environment"],
        "suggestions": [
            "تحب تعرف تأثير المناخ على الزراعة؟ 🌡️",
        ],
    },
    "pollution": {
        "related": ["environment", "development", "energy_sources"],
        "suggestions": [
            "تحب تعرف حلول التلوث؟ 🌿",
            "عايز تعرف عن الطاقة النظيفة؟ ☀️",
        ],
    },
    "muhammad_ali": {
        "related": ["revolution_1919", "pharaonic_civilization", "egyptian_economy"],
        "suggestions": [
            "تحب تعرف ليه اسمه مؤسس مصر الحديثة؟ 🤔",
        ],
    },
    "longitude_lines": {
        "related": ["latitude_lines", "maps_intro"],
        "suggestions": [
            "تحب أعرفك الفرق بينها وبين دوائر العرض؟ 🌍",
        ],
    },
    "latitude_lines": {
        "related": ["longitude_lines", "maps_intro", "egypt_climate"],
        "suggestions": [
            "تحب تعرف علاقة دوائر العرض بالمناخ؟ 🌡️",
        ],
    },
    "trade": {
        "related": ["suez_canal", "egyptian_economy", "transportation"],
        "suggestions": [
            "تحب تعرف دور قناة السويس في التجارة؟ ⛴️",
        ],
    },
    "agricultural_crops": {
        "related": ["nile_importance", "modern_agriculture", "egypt_terrain"],
        "suggestions": [
            "تحب تعرف عن الزراعة الحديثة؟ 🚜",
        ],
    },
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [60] Personality adapters
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERSONALITY_STYLES = {
    "playful": ["😄", "😂", "🤣", "💪", "🔥", "😎"],
    "calm": ["🙂", "😊", "💙", "🤗", "☺️", "💚"],
    "practical": ["📌", "✅", "📋", "⚡", "🎯", "📝"],
    "curious": ["🤔", "🧐", "🌍", "📚", "💡", "🔍"],
}

# [68] Educational steering responses
STEERING_RESPONSES = [
    "طب تيجي نحل سؤال سريع يفوقك؟ 😄📚",
    "يلا نخلي الوقت مفيد — اسألني أي سؤال دراسات! 🧭",
    "ما تيجي نراجع نقطة مهمة بسرعة؟ ✍️",
    "طب ما تسألني سؤال صعب وأنا أبسطهولك؟ 🌟",
    "يلا نلعب لعبة سريعة: أنا أقولك معلومة وانت تخمن الموضوع! 🎯",
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SmartEnhancementsV4 Class
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class SmartEnhancementsV4:
    """Enhancements 51-70: Intent fusion, topic graph, adaptive personality, ChatGPT-like behavior."""

    def __init__(self):
        self._user_personality = {}  # [60] user_id → detected style
        self._interaction_count = defaultdict(int)
        print("[ENHANCEMENTS_V4] ✅ SmartEnhancementsV4 loaded")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [51/52] Multi-layer message analysis
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def analyze_layers(self, normalized_text):
        """Analyze message on 4 layers: topic_keywords, intent_type, emotion, urgency."""
        try:
            layers = {"emotion": None, "urgency": False, "curiosity": False, "boredom": False}

            if any(s in normalized_text for s in ANXIETY_SIGNALS):
                layers["emotion"] = "anxiety"
            if any(s in normalized_text for s in URGENCY_SIGNALS):
                layers["urgency"] = True
            if any(s in normalized_text for s in CURIOSITY_SIGNALS):
                layers["curiosity"] = True
            if any(s in normalized_text for s in BOREDOM_SIGNALS):
                layers["boredom"] = True

            return layers
        except Exception:
            return {"emotion": None, "urgency": False, "curiosity": False, "boredom": False}

    def fuse_response(self, response, layers):
        """[51] Modify response based on fused multi-layer analysis."""
        try:
            parts = []

            # Anxiety → prepend calming
            if layers.get("emotion") == "anxiety":
                calms = [
                    "اهدى كده يا بطل 💙 ",
                    "متقلقش! 🤗 ",
                    "هتعديها إن شاء الله 💪 ",
                ]
                parts.append(random.choice(calms))

            # Urgency → signal quick mode
            if layers.get("urgency"):
                parts.append("⚡ باختصار: ")

            parts.append(response)

            # Boredom → add steering
            if layers.get("boredom"):
                parts.append("\n\n" + random.choice(STEERING_RESPONSES))

            return "".join(parts)
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [53/54/66] Next question prediction + topic expansion
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def predict_next_question(self, response, intent_id):
        """Add a smart follow-up suggestion based on topic graph (20% chance)."""
        try:
            if random.random() > 0.20:
                return response
            node = TOPIC_GRAPH.get(intent_id)
            if not node or not node.get("suggestions"):
                return response
            suggestion = random.choice(node["suggestions"])
            return f"{response}\n\n🧭 {suggestion}"
        except Exception:
            return response

    def get_related_topics(self, intent_id):
        """[64] Get related topic IDs from the topic graph."""
        try:
            node = TOPIC_GRAPH.get(intent_id)
            return node["related"] if node else []
        except Exception:
            return []

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [60] Adaptive personality
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def detect_personality(self, normalized_text, user_id):
        """Detect user's communication style and adapt."""
        try:
            uid = str(user_id)
            playful = any(w in normalized_text for w in ["هها", "😂", "يسطا", "يجدع", "ههه", "لول"])
            curious = any(w in normalized_text for w in CURIOSITY_SIGNALS)
            urgent = any(w in normalized_text for w in URGENCY_SIGNALS)
            anxious = any(w in normalized_text for w in ANXIETY_SIGNALS)

            if anxious:
                self._user_personality[uid] = "calm"
            elif urgent:
                self._user_personality[uid] = "practical"
            elif curious:
                self._user_personality[uid] = "curious"
            elif playful:
                self._user_personality[uid] = "playful"
        except Exception:
            pass

    def adapt_emoji(self, response, user_id):
        """Swap emoji to match user's personality style (subtle)."""
        try:
            uid = str(user_id)
            style = self._user_personality.get(uid, "curious")
            emojis = PERSONALITY_STYLES.get(style, PERSONALITY_STYLES["curious"])
            # 15% chance to add a personality-matched emoji
            if random.random() < 0.15 and not any(e in response[-5:] for e in ["😄","🌟","💪","📚"]):
                response = response.rstrip() + " " + random.choice(emojis)
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [61] Soft reasoning
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def soft_reason(self, normalized_text, topic_keywords):
        """Try to infer intent from keywords even when no exact match."""
        try:
            found_topics = []
            for kw, topic_name in topic_keywords.items():
                if kw in normalized_text:
                    found_topics.append(topic_name)

            if not found_topics:
                return None

            if len(found_topics) == 1:
                return f"حاسس إنك بتسأل عن {found_topics[0]} 🤔 صح كده؟"
            elif len(found_topics) >= 2:
                topics_str = " و".join(found_topics[:2])
                return f"أنا شايف إن سؤالك عن {topics_str} 🧐 عايز أشرحلك؟"
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [63] Smart response builder
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def build_smart_response(self, base_response, intent_id, layers):
        """Build a rich response from parts based on analysis layers."""
        try:
            parts = []

            # Part 1: Acknowledgment (if curious or anxious)
            if layers.get("curiosity"):
                acks = ["سؤال حلو! ", "أحسنت إنك فضولي 😊 "]
                parts.append(random.choice(acks))
            elif layers.get("emotion") == "anxiety":
                parts.append("خد نفس وركز معايا 💙 ")

            # Part 2: Core answer
            parts.append(base_response)

            # Part 3: Urgency trimming
            if layers.get("urgency"):
                # Already shortened by fuse_response, skip additions
                return "".join(parts)

            return "".join(parts)
        except Exception:
            return base_response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [68] Educational steering
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def steer_to_education(self, normalized_text):
        """If student is off-topic/bored, gently steer back to studies."""
        try:
            off_topic = any(w in normalized_text for w in [
                "زهقان", "ملل", "بلاها", "طفشت", "مليش نفس",
                "نتكلم", "عايز اتكلم", "كلمني",
            ])
            if off_topic and random.random() < 0.40:
                return random.choice(STEERING_RESPONSES)
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [70] ChatGPT-like deep understanding (master fallback)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def deep_understand(self, normalized_text, topic_keywords, last_context):
        """Last resort: try to understand the message using all available signals."""
        try:
            # Layer 1: Check if any topic keyword exists
            found_kws = {}
            for kw, topic_name in topic_keywords.items():
                if kw in normalized_text:
                    found_kws[kw] = topic_name

            # Layer 2: Check context
            last_intent = last_context.get("last_intent", "") if last_context else ""

            # Layer 3: Analyze message layers
            layers = self.analyze_layers(normalized_text)

            # Decision tree
            if found_kws:
                # Has topic keywords → soft reason
                if len(found_kws) == 1:
                    topic = list(found_kws.values())[0]
                    if layers.get("urgency"):
                        return f"⚡ {topic}: اسألني سؤال محدد وأنا أجاوبك فوراً!"
                    return f"حاسس إنك بتسأل عن {topic} 🤔 قولي بالظبط عايز تعرف إيه؟"
                else:
                    topics = " و".join(list(found_kws.values())[:2])
                    return f"شايف إن سؤالك فيه {topics} 🧐 عايز تبدأ بأنهي واحد؟"

            # No keywords but has context → use context
            if last_intent and last_intent not in ["smart_clarify", "indirect", "v3_early", "topic_resolve"]:
                if layers.get("curiosity"):
                    return "عايز تعرف أكتر عن الموضوع اللي كنا فيه؟ 😊 قولي إيه بالظبط!"
                elif layers.get("boredom"):
                    return random.choice(STEERING_RESPONSES)

            # Purely emotional message
            if layers.get("emotion") == "anxiety":
                return "أنا حاسس إنك قلقان 💙 متخفش — قولي عايز تراجع إيه وأنا ألخصهولك في نقاط!"
            if layers.get("boredom"):
                return random.choice(STEERING_RESPONSES)

            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Pre-processing
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def pre_process(self, normalized_text, user_id=None):
        """Analyze message layers and detect personality. Returns analysis layers dict."""
        try:
            layers = self.analyze_layers(normalized_text)
            if user_id:
                self.detect_personality(normalized_text, user_id)
                self._interaction_count[str(user_id)] += 1
            return layers
        except Exception:
            return {"emotion": None, "urgency": False, "curiosity": False, "boredom": False}

    # MASTER: Post-processing [70]
    def post_process(self, response, intent_id, user_id, layers):
        """Apply v4 post-processing: fusion, prediction, personality, builder."""
        try:
            # [51] Fuse response based on multi-layer analysis
            response = self.fuse_response(response, layers)
            # [63] Smart response builder
            response = self.build_smart_response(response, intent_id, layers)
            # [53/66] Next question prediction (20%)
            if intent_id:
                response = self.predict_next_question(response, intent_id)
            # [60] Adaptive emoji
            if user_id:
                response = self.adapt_emoji(response, user_id)
            return response
        except Exception:
            return response

    # MASTER: Deep fallback [70]
    def deep_fallback(self, normalized_text, topic_keywords, last_context):
        """ChatGPT-like last resort understanding."""
        try:
            return self.deep_understand(normalized_text, topic_keywords, last_context)
        except Exception:
            return None
