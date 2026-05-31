"""
smart_enhancements_v5.py - Enhancements 71-90 for SmartBotBrain
================================================================
ADDITIVE ONLY / FAIL-SAFE / OFFLINE / MODULAR

Skipped (already in v1-v4):
  #73(=V1#3), #76(N/A for Telegram), #79(=V1#10), #82(=V4#53),
  #83(=V2#21), #84(=V1#3+V3#40), #85(=V4#70), #87(=V4#60),
  #88(=V1#3), #89(=V2#22+V4#60)
"""

import re
import random
from collections import defaultdict


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [74] Semantic Keyword Clusters
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEMANTIC_CLUSTERS = {
    "nile_importance": ["نيل", "النهر", "المياه", "شريان", "الحياه", "مياه", "ماء", "نهر"],
    "pharaonic_civilization": ["فرعون", "فراعن", "اهرام", "تحنيط", "هيروغليف", "ابو الهول",
                                "توت عنخ", "رمسيس", "اثار", "معابد", "حضاره"],
    "suez_canal": ["قناه", "سويس", "ملاح", "سفن", "بورسعيد", "اسماعيل",
                    "ممر", "بحر احمر", "بحر متوسط"],
    "october_war": ["اكتوبر", "حرب", "سيناء", "تحرير", "نصر", "عبور",
                     "بارليف", "جيش", "قتال"],
    "democracy_meaning": ["ديمقراط", "ديموقراط", "انتخاب", "تصويت", "حريه",
                           "راي", "حكم الشعب", "مشاركه"],
    "population_density": ["كثاف", "سكان", "زحمه", "تكدس", "ازدحام", "عدد"],
    "egypt_climate": ["مناخ", "طقس", "حراره", "حار", "بارد", "امطار", "رطوبه", "جفاف"],
    "pollution": ["تلوث", "دخان", "عوادم", "قمامه", "زباله", "نفايات", "ملوث"],
    "high_dam": ["سد", "عالي", "بحيره", "ناصر", "فيضان", "كهربا"],
    "trade": ["تجاره", "استيراد", "تصدير", "بضاعه", "منتجات", "بيع", "شرا"],
    "agricultural_crops": ["زراعه", "محاصيل", "قمح", "ارز", "قطن", "فاكهه", "خضار"],
    "egypt_tourism": ["سياحه", "سياح", "اثار", "متحف", "زيار", "معالم"],
    "energy_sources": ["طاقه", "كهربا", "بترول", "غاز", "شمس", "رياح", "نوويه"],
    "citizenship": ["مواطن", "واجب", "حق", "مسؤول", "انتماء", "وطن"],
    "environment": ["بيئ", "طبيع", "محمي", "حيوان", "نبات", "تنوع"],
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [77] Explanation style templates
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPLANATION_STYLES = {
    "school": {
        "openers": ["ركز معايا كده 📖 ", "النقطة دي مهمة ✍️ ", ""],
        "closers": ["\n📌 دي بتيجي كتير في الامتحان!", ""],
    },
    "simple": {
        "openers": ["ببساطة كده 😊 ", "يعني بسهولة: ", ""],
        "closers": ["\n💡 فاهم كده؟", ""],
    },
    "example": {
        "openers": ["تخيل كده: ", "بص يا بطل: ", ""],
        "closers": ["\n🎯 كده واضحة؟", ""],
    },
    "quick": {
        "openers": ["⚡ ", "باختصار: ", ""],
        "closers": ["", ""],
    },
    "exam": {
        "openers": ["✍️ الإجابة النموذجية: ", "📝 ", ""],
        "closers": ["\n📋 كده تنفع في الامتحان!", ""],
    },
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [81] Response building blocks (Pseudo-LLM)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPENERS = [
    "", "", "",  # 60% no opener (natural)
    "أها! ", "تمام! ", "سؤال حلو! ",
    "يلا بينا! ", "اسمع الحكاية: ",
]
HUMAN_COMMENTS = [
    "", "", "", "",  # 80% no comment
    "\nدي حاجة كتير بتتسأل عليها 😄",
    "\nوالله سؤال مهم!",
    "\nأنت داخل تقفل الدراسات 💪",
]
FOLLOWUPS = [
    "", "", "", "", "",  # 83% no followup
    "\n\nعايز تعرف أكتر؟ 🤔",
    "\n\nتحب نكمل في الموضوع ده؟ 📚",
]

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [86] Mini knowledge facts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MINI_FACTS = {
    "capital_of_egypt": "💡 هل تعلم؟ القاهرة من أكبر 15 مدينة في العالم!",
    "nile_importance": "💡 هل تعلم؟ النيل هو أطول نهر في العالم بطول 6,650 كم!",
    "suez_canal": "💡 هل تعلم؟ قناة السويس بتمر فيها حوالي 50 سفينة كل يوم!",
    "pharaonic_civilization": "💡 هل تعلم؟ الحضارة الفرعونية عمرها أكتر من 7000 سنة!",
    "october_war": "💡 هل تعلم؟ الجيش المصري عدى القناة في 6 ساعات بس!",
    "high_dam": "💡 هل تعلم؟ السد العالي بيولد كهربا تكفي نص مصر!",
    "egypt_population": "💡 هل تعلم؟ مصر فيها أكتر من 100 مليون نسمة!",
    "democracy_meaning": "💡 هل تعلم؟ كلمة ديمقراطية أصلها يوناني يعني حكم الشعب!",
    "egypt_tourism": "💡 هل تعلم؟ مصر فيها تلت آثار العالم!",
    "pollution": "💡 هل تعلم؟ التلوث بيأثر على صحة أكتر من مليار شخص في العالم!",
    "natural_resources": "💡 هل تعلم؟ مصر عندها احتياطي غاز طبيعي ضخم في البحر المتوسط!",
    "muhammad_ali": "💡 هل تعلم؟ محمد علي حكم مصر 43 سنة وبنى أول جيش حديث!",
    "maps_intro": "💡 هل تعلم؟ أقدم خريطة في العالم عمرها أكتر من 4000 سنة!",
    "volunteering": "💡 هل تعلم؟ مصر فيها أكتر من 50,000 جمعية أهلية!",
    "revolution_1919": "💡 هل تعلم؟ ثورة 1919 كانت أول ثورة شارك فيها ستات ورجالة!",
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SmartEnhancementsV5 Class
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class SmartEnhancementsV5:
    """Enhancements 71-90: Pseudo-reasoning, dynamic intents, semantic clusters, Pseudo-LLM builder."""

    def __init__(self):
        self._active_topic = {}   # [80] user_id → current active topic
        self._style_rotation = defaultdict(int)  # [77] rotate styles per user
        print("[ENHANCEMENTS_V5] ✅ SmartEnhancementsV5 loaded")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [71/78] Pseudo-Reasoning Engine with Internal Tags
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def pseudo_reason(self, normalized_text, user_id=None, last_context=None):
        """Analyze message with pseudo-reasoning. Returns internal analysis dict (never shown to user)."""
        try:
            tags = {
                "topic": None,          # detected topic cluster
                "question_type": None,  # explain/list/compare/define/unknown
                "confused": False,      # student seems confused
                "wants_direct": False,  # wants direct answer vs explanation
                "context_linked": False, # related to previous topic
                "topic_switch": False,  # changed topic from previous
            }

            # Detect topic via semantic clusters [74]
            tags["topic"] = self._cluster_match(normalized_text)

            # Detect question type
            if any(w in normalized_text for w in ["ليه", "علل", "بم تفسر", "سبب"]):
                tags["question_type"] = "explain"
            elif any(w in normalized_text for w in ["اذكر", "عدد", "هات"]):
                tags["question_type"] = "list"
            elif any(w in normalized_text for w in ["قارن", "الفرق"]):
                tags["question_type"] = "compare"
            elif any(w in normalized_text for w in ["يعني ايه", "المقصود", "عرف"]):
                tags["question_type"] = "define"
            elif any(w in normalized_text for w in ["بسرعه", "بسرعة", "مختصر"]):
                tags["wants_direct"] = True
            else:
                tags["question_type"] = "general"

            # Detect confusion
            confusion_words = ["يعني", "مش فاهم", "ازاي يعني", "ها", "اي"]
            confusion_count = sum(1 for w in confusion_words if w in normalized_text)
            if confusion_count >= 2 or (len(normalized_text.split()) <= 2 and "يعني" in normalized_text):
                tags["confused"] = True

            # Check context link [80]
            if user_id and last_context:
                last_intent = last_context.get("last_intent", "")
                uid = str(user_id)
                current_topic = tags["topic"]

                if last_intent and current_topic:
                    # Topic switch detection
                    if last_intent not in ["smart_clarify", "indirect", "v3_early", "topic_resolve", "v4_deep"]:
                        if current_topic != last_intent and not last_intent.startswith("topic_"):
                            tags["topic_switch"] = True
                        else:
                            tags["context_linked"] = True
                elif last_intent and not current_topic:
                    tags["context_linked"] = True

                # Track active topic
                if current_topic:
                    self._active_topic[uid] = current_topic
                elif uid in self._active_topic:
                    tags["topic"] = self._active_topic.get(uid)
                    tags["context_linked"] = True

            return tags
        except Exception:
            return {"topic": None, "question_type": "general", "confused": False,
                    "wants_direct": False, "context_linked": False, "topic_switch": False}

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [74] Semantic cluster matching
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def _cluster_match(self, normalized_text):
        """Find which semantic cluster the text belongs to."""
        try:
            best_cluster = None
            best_count = 0
            for cluster_id, keywords in SEMANTIC_CLUSTERS.items():
                count = sum(1 for kw in keywords if kw in normalized_text)
                if count > best_count:
                    best_count = count
                    best_cluster = cluster_id
            return best_cluster if best_count > 0 else None
        except Exception:
            return None

    def cluster_boost(self, normalized_text, intents):
        """[74/75] Use semantic clusters to boost intent matching.
        Returns (matched_intent, cluster_id) or (None, None)."""
        try:
            cluster_id = self._cluster_match(normalized_text)
            if not cluster_id:
                return None, None

            for intent in intents:
                if intent.get("intent_id") == cluster_id:
                    return intent, cluster_id
            return None, cluster_id
        except Exception:
            return None, None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [72] Dynamic Intent Construction
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def construct_dynamic_intent(self, normalized_text, tags, intents):
        """Build a runtime intent from keywords + context when no exact match exists."""
        try:
            cluster_id = tags.get("topic")
            if not cluster_id:
                return None, None

            # Try to find the intent matching the cluster
            for intent in intents:
                if intent.get("intent_id") == cluster_id:
                    return intent, cluster_id

            # No matching intent but we know the topic — use cluster keywords
            # to find closest intent by keyword overlap
            cluster_kws = SEMANTIC_CLUSTERS.get(cluster_id, [])
            if not cluster_kws:
                return None, None

            best_intent = None
            best_score = 0
            for intent in intents:
                phrases = " ".join(intent.get("phrases", []))
                score = sum(1 for kw in cluster_kws if kw in phrases)
                if score > best_score:
                    best_score = score
                    best_intent = intent

            if best_intent and best_score >= 2:
                return best_intent, best_intent.get("intent_id", "dynamic")
            return None, None
        except Exception:
            return None, None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [77] Multi-style explanation
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def apply_explanation_style(self, response, tags, user_id=None):
        """Apply an explanation style based on analysis tags and rotation."""
        try:
            # Choose style based on tags
            if tags.get("wants_direct"):
                style_key = "quick"
            elif tags.get("confused"):
                style_key = "simple"
            elif tags.get("question_type") in ["explain", "compare"]:
                style_key = "school"
            elif tags.get("question_type") == "list":
                style_key = "exam"
            else:
                # Rotate styles for variety [77]
                styles_list = list(EXPLANATION_STYLES.keys())
                uid = str(user_id) if user_id else "anon"
                idx = self._style_rotation[uid] % len(styles_list)
                self._style_rotation[uid] += 1
                style_key = styles_list[idx]

            style = EXPLANATION_STYLES.get(style_key, EXPLANATION_STYLES["simple"])
            opener = random.choice(style["openers"])
            closer = random.choice(style["closers"])

            # Only apply 30% of the time to avoid predictability
            if random.random() > 0.30:
                return response

            return f"{opener}{response}{closer}"
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [80] Smart Topic Switching
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def handle_topic_switch(self, response, tags, user_id=None):
        """Add smooth transition when topic changes."""
        try:
            if not tags.get("topic_switch"):
                return response
            # 40% chance to add transition
            if random.random() > 0.40:
                return response
            transitions = [
                "تمام، ننتقل لموضوع جديد! ",
                "أوكي نغير الموضوع 😊 ",
                "ماشي يلا! ",
            ]
            return random.choice(transitions) + response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [81] Pseudo-LLM Response Builder
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def build_pseudo_llm(self, response):
        """Compose response from building blocks to feel unique (25% chance)."""
        try:
            if random.random() > 0.25:
                return response
            opener = random.choice(OPENERS)
            comment = random.choice(HUMAN_COMMENTS)
            followup = random.choice(FOLLOWUPS)
            return f"{opener}{response}{comment}{followup}"
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [86] Mini Knowledge Expansion
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def add_mini_fact(self, response, intent_id):
        """Add a fun fact related to the topic (12% chance)."""
        try:
            if random.random() > 0.12:
                return response
            fact = MINI_FACTS.get(intent_id)
            if fact:
                return f"{response}\n\n{fact}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Pre-processing [71/78]
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def pre_process(self, normalized_text, user_id=None, last_context=None):
        """Run pseudo-reasoning analysis. Returns tags dict."""
        try:
            return self.pseudo_reason(normalized_text, user_id, last_context)
        except Exception:
            return {"topic": None, "question_type": "general", "confused": False,
                    "wants_direct": False, "context_linked": False, "topic_switch": False}

    # MASTER: Post-processing [77/80/81/86/90]
    def post_process(self, response, intent_id, user_id, tags):
        """Apply v5 post-processing: style, transition, pseudo-LLM, facts."""
        try:
            # [80] Topic switch transition
            response = self.handle_topic_switch(response, tags, user_id)
            # [77] Explanation style
            response = self.apply_explanation_style(response, tags, user_id)
            # [81] Pseudo-LLM building blocks
            response = self.build_pseudo_llm(response)
            # [86] Mini knowledge expansion
            if intent_id:
                response = self.add_mini_fact(response, intent_id)
            return response
        except Exception:
            return response

    # [72/74/75] Dynamic matching fallback
    def dynamic_match(self, normalized_text, tags, intents):
        """Try semantic cluster matching + dynamic intent construction."""
        try:
            # [74] Cluster boost first
            cluster_intent, cluster_id = self.cluster_boost(normalized_text, intents)
            if cluster_intent:
                return cluster_intent, cluster_id

            # [72] Dynamic intent construction
            dyn_intent, dyn_id = self.construct_dynamic_intent(normalized_text, tags, intents)
            if dyn_intent:
                return dyn_intent, dyn_id

            return None, None
        except Exception:
            return None, None
