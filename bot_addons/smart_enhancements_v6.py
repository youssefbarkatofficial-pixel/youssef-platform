"""
smart_enhancements_v6.py - Enhancements 91-110 for SmartBotBrain
================================================================
ADDITIVE ONLY / FAIL-SAFE / OFFLINE / MODULAR

Skipped (already in v1-v5):
  #93(=V4#64 Topic Graph), #96(=V1#3+V4#70 Deep Context), 
  #97(=V1#5 Clarification), #98(=V5#71 Tags), #101(=V4#51 Urgency), 
  #102(=V5#80 Topic Switch), #103(=V5#72 Dynamic Intent), 
  #106(=V5#86 Facts), #107(=V3#30 Gradual)
"""

import random


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [104] Micro-Explanations Dictionary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MICRO_EXPLANATIONS = {
    "population_density": "(الكثافة يعني عدد الناس بالنسبة للمساحة اللي عايشين فيها)",
    "democracy_meaning": "(الديمقراطية يعني الشعب هو اللي بيحكم نفسه)",
    "longitude_lines": "(خطوط الطول بتحدد التوقيت وفرق الساعات)",
    "latitude_lines": "(دوائر العرض بتحدد المناخ والحرارة)",
    "high_dam": "(السد العالي حمى مصر من الفيضان والجفاف)",
    "citizenship": "(المواطنة يعني حقوقك وواجباتك في بلدك)",
    "pollution": "(التلوث يعني أي تغير يضر بالبيئة الطبيعية)",
    "development": "(التنمية يعني نطور الموارد عشان تكفينا للمستقبل)",
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [95] Intent Weighting Keywords
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEIGHTED_KEYWORDS = {
    "امتحان": 3.0,
    "بكره": 2.5,
    "بكرة": 2.5,
    "بسرعه": 2.0,
    "مش فاهم": 2.5,
    "لخص": 2.0,
    "اشرح": 1.5,
    "ليه": 1.5,
    "قارن": 1.5,
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SmartEnhancementsV6 Class
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class SmartEnhancementsV6:
    """Enhancements 91-110: Brain-like Pipeline, Strategies, Priority, Temperature, Micro-explanations."""

    def __init__(self):
        self._user_temperature = {}  # user_id → LOW/MEDIUM/HIGH
        print("[ENHANCEMENTS_V6] ✅ SmartEnhancementsV6 loaded")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [95] Intent Weighting
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def apply_keyword_weights(self, normalized_text, base_score):
        """Boost score artificially based on critical keywords."""
        try:
            boost = 0.0
            for kw, weight in WEIGHTED_KEYWORDS.items():
                if kw in normalized_text:
                    boost += (weight / 10.0)  # Add up to 0.3 to the TFIDF score
            return min(1.0, base_score + boost)
        except Exception:
            return base_score

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [91/92/94/100/110] Dynamic Strategy Selection & Pipeline
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def select_strategy(self, layers, tags):
        """
        Determine the primary response strategy based on prioritized layers.
        Priority: Panic/Urgent -> Confused -> Normal Explain -> Exam List
        """
        try:
            # 1. Panic/Urgent Priority
            if layers.get("emotion") == "anxiety" and layers.get("urgency"):
                return "EXAM_PANIC_MODE"
            if layers.get("urgency") or tags.get("wants_direct"):
                return "QUICK_ANSWER"
            
            # 2. Confusion Priority
            if tags.get("confused"):
                return "CLARIFICATION_MODE"
            
            # 3. Question Type Priority
            q_type = tags.get("question_type")
            if q_type == "list":
                return "EXAM_MODE"
            elif q_type == "compare":
                return "STEP_BY_STEP"
            
            # 4. Default
            return "SIMPLE_EXPLANATION"
        except Exception:
            return "SIMPLE_EXPLANATION"

    def apply_strategy(self, response, strategy):
        """Modify response based on the selected strategy."""
        try:
            if strategy == "EXAM_PANIC_MODE":
                return f"🚨 ركز معايا يا بطل الوقت بيجري!\n\nباختصار شديد:\n{response}\n\nخد نفس عميق، هتقفل الامتحان 💪"
            elif strategy == "QUICK_ANSWER":
                return f"⚡ الخلاصة:\n{response}"
            elif strategy == "CLARIFICATION_MODE":
                return f"🤔 طيب بص، هبسطهالك خالص:\n{response}\n\nفهمتها كده؟"
            elif strategy == "STEP_BY_STEP":
                # Add basic bullet points if none exist
                if "-" not in response and "١" not in response and "1" not in response:
                    lines = response.split("،")
                    if len(lines) > 1:
                        response = "\n".join([f"🔸 {line.strip()}" for line in lines if line.strip()])
                return f"خطوة بخطوة 🧠:\n{response}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [104/109] Micro Explanations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def insert_micro_explanation(self, response, intent_id):
        """Inject a tiny inline explanation for key concepts (30% chance)."""
        try:
            if random.random() > 0.30:
                return response
            micro = MICRO_EXPLANATIONS.get(intent_id)
            if micro and micro not in response:
                # Insert it after the first newline, or at the end
                if "\n" in response:
                    parts = response.split("\n", 1)
                    return f"{parts[0]} {micro}\n{parts[1]}"
                else:
                    return f"{response} {micro}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [105] Response Temperature Simulation
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def set_user_temperature(self, user_id, layers):
        """Determine temperature based on user interaction style."""
        try:
            uid = str(user_id)
            if layers.get("urgency"):
                self._user_temperature[uid] = "LOW"  # Serious/direct
            elif layers.get("curiosity"):
                self._user_temperature[uid] = "HIGH" # Interactive/fun
            elif uid not in self._user_temperature:
                self._user_temperature[uid] = "MEDIUM"
        except Exception:
            pass

    def apply_temperature(self, response, user_id):
        """Format response based on temperature."""
        try:
            uid = str(user_id)
            temp = self._user_temperature.get(uid, "MEDIUM")
            
            if temp == "LOW":
                # Strip excessive emojis and exclamation marks for serious tone
                clean = response.replace("😄", "").replace("😂", "").replace("!", ".")
                return f"📌 {clean.strip()}"
            elif temp == "HIGH":
                # Add enthusiastic formatting
                if random.random() < 0.20 and "✨" not in response:
                    return f"✨ ركز في دي بقى:\n{response}"
            return response
        except Exception:
            return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Pre-processing [95/105]
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def pre_process(self, tfidf_score, normalized_text, layers, user_id=None):
        """Apply keyword weighting and set temperature."""
        try:
            new_score = self.apply_keyword_weights(normalized_text, tfidf_score)
            if user_id:
                self.set_user_temperature(user_id, layers)
            return new_score
        except Exception:
            return tfidf_score

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Post-processing [92/104/105]
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def post_process(self, response, intent_id, layers, tags, user_id=None):
        """Apply v6 dynamic strategy, micro-explanations, and temperature."""
        try:
            # [91/92/94] Strategy selection
            strategy = self.select_strategy(layers, tags)
            response = self.apply_strategy(response, strategy)
            
            # [104] Micro explanations
            if intent_id:
                response = self.insert_micro_explanation(response, intent_id)
                
            # [105] Temperature
            if user_id:
                response = self.apply_temperature(response, user_id)
                
            return response
        except Exception:
            return response
