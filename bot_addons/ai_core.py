"""
ai_core.py - Smart Conversational AI Engine for Al-Bawsala Bot
==============================================================
ADDITIVE ONLY - Does NOT modify any existing bot code.
FAIL-SAFE    - If this module crashes, the old bot continues working.
OFFLINE      - No external API calls. Everything runs locally.
MODULAR      - Can be removed entirely without affecting the bot.

Usage (safe integration pattern):
    try:
        from bot_addons.ai_core import SmartBotBrain
        brain = SmartBotBrain()
    except Exception as e:
        brain = None
        print(f"[AI_CORE_LOAD_ERROR] {e}")

    # In message handler:
    response = None
    try:
        if brain:
            response = brain.get_response(text, user_id)
    except Exception as e:
        print(f"[AI_RESPONSE_ERROR] {e}")

    if not response:
        # Old system continues as-is
        pass
"""

import os
import re
import json
import random
import time
from collections import defaultdict

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Safe import of Enhancement Layer (ADDITIVE, optional)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_HAS_ENHANCEMENTS = False
_SmartEnhancements = None
try:
    from bot_addons.smart_enhancements import SmartEnhancements as _SE
    _SmartEnhancements = _SE
    _HAS_ENHANCEMENTS = True
except Exception as _enh_err:
    print(f"[SMART_BRAIN_INFO] Enhancements not loaded (optional): {_enh_err}")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Safe import of sklearn (with auto-install fallback)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_HAS_SKLEARN = False
_TfidfVectorizer = None
_cosine_similarity = None

try:
    from sklearn.feature_extraction.text import TfidfVectorizer as _TV
    from sklearn.metrics.pairwise import cosine_similarity as _CS
    _TfidfVectorizer = _TV
    _cosine_similarity = _CS
    _HAS_SKLEARN = True
except ImportError:
    # Try silent install
    try:
        import subprocess
        import sys
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "scikit-learn", "--quiet"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=120
        )
        from sklearn.feature_extraction.text import TfidfVectorizer as _TV
        from sklearn.metrics.pairwise import cosine_similarity as _CS
        _TfidfVectorizer = _TV
        _cosine_similarity = _CS
        _HAS_SKLEARN = True
    except Exception as _install_err:
        print(f"[SMART_BRAIN_WARNING] sklearn not available, using fallback matching: {_install_err}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Constants
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SIMILARITY_THRESHOLD = 0.68
HIGH_CONFIDENCE = 0.82
MAX_CONTEXT_HISTORY = 50  # max users to keep in memory
CONTEXT_EXPIRY_SECONDS = 3600  # 1 hour

# Topic keywords for generic fallback
TOPIC_KEYWORDS = {
    "نيل": "نهر النيل",
    "عاصم": "عاصمة مصر",
    "قاهر": "القاهرة",
    "ديمقراط": "الديمقراطية",
    "ديموقراط": "الديمقراطية",
    "فرعون": "الحضارة الفرعونية",
    "فراعن": "الحضارة الفرعونية",
    "اهرام": "الأهرامات",
    "تاريخ": "التاريخ",
    "جغراف": "الجغرافيا",
    "اقتصاد": "الاقتصاد",
    "قناة": "قناة السويس",
    "سويس": "قناة السويس",
    "حرب": "الحروب",
    "اكتوبر": "حرب أكتوبر",
    "مناخ": "المناخ",
    "طقس": "المناخ",
    "سكان": "السكان",
    "كثاف": "الكثافة السكانية",
    "زراع": "الزراعة",
    "محصول": "المحاصيل",
    "صناع": "الصناعة",
    "سياح": "السياحة",
    "خريط": "الخرائط",
    "محافظ": "المحافظات",
    "تلوث": "التلوث",
    "بيئ": "البيئة",
    "طاق": "الطاقة",
    "تجار": "التجارة",
    "نقل": "النقل والمواصلات",
    "مواصل": "النقل والمواصلات",
    "سد": "السد العالي",
    "محمي": "المحميات الطبيعية",
    "تنمي": "التنمية",
    "تطوع": "العمل التطوعي",
    "مواطن": "المواطنة",
    "حقوق": "الحقوق",
    "واجب": "الواجبات",
    "محمد علي": "محمد علي باشا",
    "ثور": "الثورات",
    "قبطي": "العصر القبطي",
    "اسلام": "العصر الإسلامي",
    "خطوط طول": "خطوط الطول",
    "دوائر عرض": "دوائر العرض",
    "موارد": "الموارد الطبيعية",
    "ثرو": "الثروة",
    "حيوان": "الثروة الحيوانية",
}

# Generic topic responses when keyword is detected but no exact match
GENERIC_TOPIC_RESPONSES = [
    "سؤال حلو عن {topic}! 🧐 ممكن تسأل بشكل أوضح شوية عشان أقدر أساعدك أحسن؟",
    "أنا عارف إن {topic} موضوع مهم 📚 بس ممكن توضح سؤالك أكتر؟",
    "{topic} ده موضوع كبير ومهم! 🌟 قولي بالظبط عايز تعرف إيه عنه؟",
    "حاسس إنك بتسأل عن {topic} 🤔 ممكن تحدد السؤال أكتر عشان أفيدك؟",
]

# Clarification request phrases
CLARIFY_PHRASES = [
    "مش فاهم", "مش فهمت", "وضح", "وضحلي", "اشرح اكتر",
    "اشرحلي", "عيد", "عيدلي", "تاني", "ايه ده", "مش واضح",
    "فهمني", "قول تاني", "اشرح تاني", "مفهمتش", "مش فاهمه",
    "وضح اكتر", "اعيد", "فسر", "فسرلي", "بالتفصيل",
]

# Ultimate fallback responses (when nothing matches at all)
ULTIMATE_FALLBACK_RESPONSES = [
    "سؤال جامد بس مش متأكد إني فاهمه 🤔 جرب تسأل بطريقة تانية؟",
    "أنا البوصلة متخصص في الدراسات الاجتماعية 🧭 اسألني عن تاريخ أو جغرافيا!",
    "ممكن توضح سؤالك؟ أنا هنا عشان أساعدك في الدراسات 📚",
    "مش قادر أفهم السؤال ده 😅 جرب تكتبه بشكل تاني!",
    "أنا شاطر في الدراسات الاجتماعية 🌍 اسألني عن أي حاجة فيها!",
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Arabic Text Normalization
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Tashkeel (diacritics) range
_TASHKEEL_RE = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]')

# Repeated chars (3+ of same char → 2)
_REPEATED_CHARS_RE = re.compile(r'(.)\1{2,}')

# Non-essential symbols (keep Arabic, English, digits, spaces, ?, !)
_SYMBOLS_RE = re.compile(r'[^\w\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s?!]')

# Multiple spaces
_MULTI_SPACE_RE = re.compile(r'\s+')


def normalize_arabic(text):
    """
    Normalize Arabic text for better matching:
    - Remove diacritics (tashkeel)
    - Unify hamzas: أ إ آ → ا
    - Unify ya: ى → ي
    - Careful taa marbuta handling: ة → ه (only at word end)
    - Remove excessive char repetition
    - Remove non-essential symbols
    - Collapse multiple spaces
    - Lowercase English text
    """
    if not text or not isinstance(text, str):
        return ""

    try:
        # Strip and lowercase English
        t = text.strip().lower()

        # Remove tashkeel
        t = _TASHKEEL_RE.sub('', t)

        # Unify hamzas
        t = t.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').replace('ٱ', 'ا')

        # Unify alef maqsura
        t = t.replace('ى', 'ي')

        # Taa marbuta → ha (careful: only at word boundaries)
        t = re.sub(r'ة(?=\s|$)', 'ه', t)

        # Remove excessive repetition (e.g., "اييييه" → "اييه")
        t = _REPEATED_CHARS_RE.sub(r'\1\1', t)

        # Remove non-essential symbols
        t = _SYMBOLS_RE.sub(' ', t)

        # Collapse multiple spaces
        t = _MULTI_SPACE_RE.sub(' ', t).strip()

        return t
    except Exception:
        return text.strip().lower() if text else ""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Fallback Matching (no sklearn)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def _simple_word_overlap_score(text_a, text_b):
    """Simple word-overlap similarity score (0-1) as fallback."""
    try:
        words_a = set(text_a.split())
        words_b = set(text_b.split())
        if not words_a or not words_b:
            return 0.0
        intersection = words_a & words_b
        union = words_a | words_b
        return len(intersection) / len(union) if union else 0.0
    except Exception:
        return 0.0


def _char_ngram_similarity(text_a, text_b, n=3):
    """Character n-gram Jaccard similarity as fallback."""
    try:
        def get_ngrams(text, n):
            return set(text[i:i+n] for i in range(len(text) - n + 1))

        ngrams_a = get_ngrams(text_a, n)
        ngrams_b = get_ngrams(text_b, n)
        if not ngrams_a or not ngrams_b:
            return 0.0
        intersection = ngrams_a & ngrams_b
        union = ngrams_a | ngrams_b
        return len(intersection) / len(union) if union else 0.0
    except Exception:
        return 0.0


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SmartBotBrain Class
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class SmartBotBrain:
    """
    Smart conversational AI engine for Al-Bawsala educational bot.
    
    Features:
    - TF-IDF + cosine similarity matching (with sklearn)
    - Character n-gram fallback (without sklearn)
    - Arabic text normalization
    - Contextual memory per user
    - Topic keyword detection
    - Clarification handling
    
    Thread-safe: No, designed for single-threaded bot handlers.
    Memory: Lightweight, all data loaded once at init.
    """

    def __init__(self):
        """Initialize the brain. Load data once. Build index."""
        self._intents = []
        self._social_intents = []
        self._educational_intents = []
        self._all_phrases = []       # flat list of (normalized_phrase, intent_index)
        self._user_context = {}      # user_id → {last_question, last_response, last_intent, timestamp}
        self._vectorizer = None
        self._tfidf_matrix = None
        self._ready = False
        self._enhancements = None  # Enhancement layer (optional)

        try:
            self._load_data()
            self._build_index()
            # Load enhancements safely (optional layer)
            try:
                if _HAS_ENHANCEMENTS and _SmartEnhancements:
                    self._enhancements = _SmartEnhancements()
            except Exception as enh_e:
                print(f"[SMART_BRAIN_INFO] Enhancements init skipped: {enh_e}")
                self._enhancements = None
            self._ready = True
            print("[SMART_BRAIN] ✅ SmartBotBrain initialized successfully")
        except Exception as e:
            print(f"[SMART_BRAIN_ERROR] Failed to initialize: {e}")
            self._ready = False

    def _load_data(self):
        """Load smart_qa_data.json once at startup."""
        data_path = os.path.join(os.path.dirname(__file__), "smart_qa_data.json")

        if not os.path.exists(data_path):
            raise FileNotFoundError(f"Data file not found: {data_path}")

        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._intents = data.get("intents", [])

        if not self._intents:
            raise ValueError("No intents found in data file")

        # Separate by type for priority matching
        self._social_intents = [i for i in self._intents if i.get("type") == "social"]
        self._educational_intents = [i for i in self._intents if i.get("type") == "educational"]

        print(f"[SMART_BRAIN] Loaded {len(self._intents)} intents "
              f"({len(self._educational_intents)} educational, {len(self._social_intents)} social)")

    def _build_index(self):
        """Build TF-IDF index or fallback phrase list."""
        # Build flat phrase list
        self._all_phrases = []
        raw_phrases = []

        for idx, intent in enumerate(self._intents):
            for phrase in intent.get("phrases", []):
                normalized = normalize_arabic(phrase)
                if normalized:
                    self._all_phrases.append((normalized, idx))
                    raw_phrases.append(normalized)

        if not raw_phrases:
            raise ValueError("No phrases found after normalization")

        # Build TF-IDF index if sklearn available
        if _HAS_SKLEARN and _TfidfVectorizer and _cosine_similarity:
            try:
                self._vectorizer = _TfidfVectorizer(
                    analyzer='char_wb',
                    ngram_range=(3, 5),
                    max_features=10000,
                    sublinear_tf=True
                )
                self._tfidf_matrix = self._vectorizer.fit_transform(raw_phrases)
                print(f"[SMART_BRAIN] TF-IDF index built: {self._tfidf_matrix.shape}")
            except Exception as e:
                print(f"[SMART_BRAIN_WARNING] TF-IDF build failed, using fallback: {e}")
                self._vectorizer = None
                self._tfidf_matrix = None
        else:
            print("[SMART_BRAIN] Using fallback matching (no sklearn)")

    def _cleanup_old_contexts(self):
        """Remove expired user contexts to prevent memory leaks."""
        try:
            if len(self._user_context) <= MAX_CONTEXT_HISTORY:
                return
            now = time.time()
            expired = [uid for uid, ctx in self._user_context.items()
                       if now - ctx.get("timestamp", 0) > CONTEXT_EXPIRY_SECONDS]
            for uid in expired:
                del self._user_context[uid]
            # If still too many, remove oldest
            if len(self._user_context) > MAX_CONTEXT_HISTORY:
                sorted_users = sorted(self._user_context.items(),
                                       key=lambda x: x[1].get("timestamp", 0))
                for uid, _ in sorted_users[:len(self._user_context) - MAX_CONTEXT_HISTORY]:
                    del self._user_context[uid]
        except Exception:
            pass

    def _get_context(self, user_id):
        """Get user context safely."""
        return self._user_context.get(str(user_id), {})

    def _set_context(self, user_id, question, response, intent_id):
        """Save user context."""
        try:
            uid = str(user_id)
            self._user_context[uid] = {
                "last_question": question,
                "last_response": response,
                "last_intent": intent_id,
                "timestamp": time.time()
            }
            self._cleanup_old_contexts()
        except Exception:
            pass

    def _is_clarification_request(self, normalized_text):
        """Check if user is asking for clarification of last answer."""
        try:
            for phrase in CLARIFY_PHRASES:
                norm_phrase = normalize_arabic(phrase)
                if norm_phrase in normalized_text or normalized_text in norm_phrase:
                    return True
            return False
        except Exception:
            return False

    def _handle_clarification(self, user_id):
        """Handle 'I don't understand' / 'explain more' requests."""
        try:
            ctx = self._get_context(user_id)
            if not ctx or not ctx.get("last_intent"):
                return None

            last_intent_id = ctx["last_intent"]
            last_response = ctx.get("last_response", "")

            # Find the intent
            intent = None
            for i in self._intents:
                if i.get("intent_id") == last_intent_id:
                    intent = i
                    break

            if not intent:
                return None

            # Pick a different response template
            templates = intent.get("response_templates", [])
            if not templates:
                return None

            # Try to pick one that's different from last response
            available = [t for t in templates if t != last_response]
            if available:
                response = random.choice(available)
            else:
                response = random.choice(templates)

            # Add clarification prefix
            prefixes = [
                "يعني ببساطة: ",
                "بشكل أبسط: ",
                "خليني أوضحلك: ",
                "تعالى نبسطها: ",
                "أوكي هفهمك: ",
            ]
            return random.choice(prefixes) + response

        except Exception as e:
            print(f"[SMART_BRAIN_ERROR] Clarification handling: {e}")
            return None

    def _match_social_quick(self, normalized_text):
        """Quick exact/substring check for social intents (fast path)."""
        try:
            best_match = None
            best_score = 0.0

            for intent in self._social_intents:
                for phrase in intent.get("phrases", []):
                    norm_phrase = normalize_arabic(phrase)
                    if not norm_phrase:
                        continue

                    # Exact match
                    if normalized_text == norm_phrase:
                        return intent, 1.0

                    # Substring match (short phrases)
                    if len(norm_phrase) <= 10:
                        if norm_phrase in normalized_text or normalized_text in norm_phrase:
                            score = 0.85
                            if score > best_score:
                                best_score = score
                                best_match = intent

            if best_match and best_score >= SIMILARITY_THRESHOLD:
                return best_match, best_score
            return None, 0.0
        except Exception:
            return None, 0.0

    def _match_tfidf(self, normalized_text):
        """TF-IDF + cosine similarity matching."""
        try:
            if not self._vectorizer or self._tfidf_matrix is None:
                return None, 0.0

            query_vec = self._vectorizer.transform([normalized_text])
            similarities = _cosine_similarity(query_vec, self._tfidf_matrix).flatten()

            best_idx = similarities.argmax()
            best_score = float(similarities[best_idx])

            if best_score >= SIMILARITY_THRESHOLD:
                _, intent_idx = self._all_phrases[best_idx]
                return self._intents[intent_idx], best_score

            return None, best_score
        except Exception as e:
            print(f"[SMART_BRAIN_ERROR] TF-IDF matching: {e}")
            return None, 0.0

    def _match_fallback(self, normalized_text):
        """Fallback matching using character n-grams (no sklearn)."""
        try:
            best_match = None
            best_score = 0.0

            for norm_phrase, intent_idx in self._all_phrases:
                # Combined score: 60% char ngram + 40% word overlap
                char_score = _char_ngram_similarity(normalized_text, norm_phrase, n=3)
                word_score = _simple_word_overlap_score(normalized_text, norm_phrase)
                combined = char_score * 0.6 + word_score * 0.4

                if combined > best_score:
                    best_score = combined
                    best_match = self._intents[intent_idx]

            if best_match and best_score >= SIMILARITY_THRESHOLD:
                return best_match, best_score
            return None, best_score
        except Exception:
            return None, 0.0

    def _match_keyword_fallback(self, normalized_text):
        """Keyword-based topic detection as last resort."""
        try:
            for keyword, topic in TOPIC_KEYWORDS.items():
                norm_kw = normalize_arabic(keyword)
                if norm_kw and norm_kw in normalized_text:
                    response = random.choice(GENERIC_TOPIC_RESPONSES).format(topic=topic)
                    return response, topic
            return None, None
        except Exception:
            return None, None

    def _enhance_response(self, response, intent_id, user_id):
        """Apply enhancement layers to a matched response (safe, optional)."""
        if not self._enhancements or not response:
            return response
        try:
            enh = self._enhancements
            # [6] Teaching mode: add follow-up question (30% chance)
            response = enh.add_teaching_followup(response, intent_id)
            # [9] Response diversity: avoid repeating same response
            # (we already have the response, just track it)
            uid = str(user_id) if user_id else "anon"
            enh._response_history[uid] = (enh._response_history.get(uid, []) + [response])[-10:]
            # [10] Adaptive: simplify if user is confused
            if user_id:
                confusion = enh.check_confusion_level(user_id)
                response = enh.simplify_response(response, confusion)
            # [3] Update enhanced context
            if user_id:
                topic = enh.extract_topic_entity("" , intent_id)
                enh.update_enhanced_context(user_id, topic=topic, intent_id=intent_id, response=response)
            return response
        except Exception:
            return response

    def get_response(self, text, user_id=None):
        """
        Main entry point. Get a smart response for user input.
        Enhanced with 10 smart layers (fail-safe, all optional).
        
        Args:
            text: User's message text
            user_id: Optional user identifier for context tracking
            
        Returns:
            str: Response text, or None if no confident match found
                 (so old system can take over)
        """
        if not self._ready:
            return None

        if not text or not isinstance(text, str) or len(text.strip()) < 2:
            return None

        try:
            normalized = normalize_arabic(text)
            if not normalized or len(normalized) < 2:
                return None

            enh = self._enhancements  # may be None

            # ━━ [Enhancement 4] Fuzzy spelling correction (internal only) ━━
            if enh:
                try:
                    normalized = enh.fuzzy_correct(normalized)
                except Exception:
                    pass

            # ━━ [Enhancement 8] Pronoun resolution ━━
            if enh and user_id:
                try:
                    normalized = enh.resolve_pronouns(normalized, user_id)
                except Exception:
                    pass

            # ━━ [Enhancement 7] Emotion detection (priority check) ━━
            if enh and user_id:
                try:
                    emotion = enh.detect_emotion(normalized)
                    if emotion == "positive":
                        enh.reset_confusion(user_id)
                        emotional_resp = enh.get_emotional_response(emotion, user_id)
                        if emotional_resp:
                            self._set_context(user_id, text, emotional_resp, "emotion_positive")
                            return emotional_resp
                    elif emotion == "negative":
                        # Check if it's also an educational question
                        has_edu_keyword = any(kw in normalized for kw in ["ايه", "اشرح", "عايز", "فين", "كام"])
                        if not has_edu_keyword:
                            emotional_resp = enh.get_emotional_response(emotion, user_id)
                            if emotional_resp:
                                self._set_context(user_id, text, emotional_resp, "emotion_negative")
                                return emotional_resp
                except Exception:
                    pass

            # ━━ [Enhancement 3] Continuation request detection ━━
            if enh and user_id:
                try:
                    if enh.is_continuation_request(normalized):
                        cont_resp = enh.handle_continuation(user_id, self._intents, self._get_context(user_id))
                        if cont_resp:
                            self._set_context(user_id, text, cont_resp,
                                              self._get_context(user_id).get("last_intent", ""))
                            return cont_resp
                except Exception:
                    pass

            # ── Step 0: Check if user is asking for clarification ──
            if user_id and self._is_clarification_request(normalized):
                clarification = self._handle_clarification(user_id)
                if clarification:
                    # [10] Track confusion
                    if enh:
                        try:
                            enh._confusion_counter[str(user_id)] = enh._confusion_counter.get(str(user_id), 0) + 1
                        except Exception:
                            pass
                    self._set_context(user_id, text, clarification,
                                      self._get_context(user_id).get("last_intent", ""))
                    return clarification

            # ━━ [Enhancement 2] Short message intent expansion ━━
            if enh:
                try:
                    short_intent, short_id = enh.expand_short_message(normalized, self._intents)
                    if short_intent:
                        templates = short_intent.get("response_templates", [""])
                        response = enh.pick_diverse_response(templates, user_id) if user_id else random.choice(templates)
                        response = self._enhance_response(response, short_id, user_id)
                        if user_id:
                            self._set_context(user_id, text, response, short_id)
                        return response
                except Exception:
                    pass

            # ── Step 1: Quick social intent matching ──
            social_match, social_score = self._match_social_quick(normalized)
            if social_match and social_score >= HIGH_CONFIDENCE:
                templates = social_match.get("response_templates", [""])
                # [9] Diverse response selection
                if enh and user_id:
                    response = enh.pick_diverse_response(templates, user_id)
                else:
                    response = random.choice(templates)
                if user_id:
                    self._set_context(user_id, text, response,
                                      social_match.get("intent_id", ""))
                    # [10] Reset confusion on social interaction
                    if enh:
                        try:
                            enh.reset_confusion(user_id)
                        except Exception:
                            pass
                return response

            # ━━ [Enhancement 1] Semantic loose matching (before TF-IDF) ━━
            if enh:
                try:
                    sem_match, sem_score = enh.semantic_keyword_match(
                        normalized, self._intents, normalize_arabic)
                    if sem_match and sem_score >= 0.60:
                        intent_id = sem_match.get("intent_id", "")
                        templates = sem_match.get("response_templates", [""])
                        response = enh.pick_diverse_response(templates, user_id) if user_id else random.choice(templates)
                        response = self._enhance_response(response, intent_id, user_id)
                        if user_id:
                            self._set_context(user_id, text, response, intent_id)
                        return response
                except Exception:
                    pass

            # ── Step 2: TF-IDF matching (if sklearn available) ──
            tfidf_match, tfidf_score = None, 0.0
            if _HAS_SKLEARN:
                tfidf_match, tfidf_score = self._match_tfidf(normalized)
            else:
                # Use fallback matching
                tfidf_match, tfidf_score = self._match_fallback(normalized)

            # If TF-IDF found a match, check if social quick also found one
            # and pick the better one
            if tfidf_match and tfidf_score >= SIMILARITY_THRESHOLD:
                # If social also matched, pick highest
                if social_match and social_score > tfidf_score:
                    chosen = social_match
                else:
                    chosen = tfidf_match

                intent_id = chosen.get("intent_id", "")
                templates = chosen.get("response_templates", [""])
                # [9] Diverse response selection
                if enh and user_id:
                    response = enh.pick_diverse_response(templates, user_id)
                else:
                    response = random.choice(templates)
                # [6,10] Apply enhancement layers
                response = self._enhance_response(response, intent_id, user_id)
                if user_id:
                    self._set_context(user_id, text, response, intent_id)

                # Only return if confidence is adequate
                if max(tfidf_score, social_score) >= SIMILARITY_THRESHOLD:
                    return response

            # ── Step 3: Keyword fallback ──
            kw_response, kw_topic = self._match_keyword_fallback(normalized)
            if kw_response:
                if user_id:
                    self._set_context(user_id, text, kw_response, f"topic_{kw_topic}")
                    if enh:
                        try:
                            enh.update_enhanced_context(user_id, topic=kw_topic)
                        except Exception:
                            pass
                return kw_response

            # ━━ [Enhancement 5] Smart clarification instead of giving up ━━
            if enh:
                try:
                    clarification = enh.generate_smart_clarification(normalized)
                    if clarification:
                        if user_id:
                            self._set_context(user_id, text, clarification, "smart_clarify")
                        return clarification
                except Exception:
                    pass

            # ── Step 4: Ultimate fallback → return None ──
            # Let the old system handle it
            return None

        except Exception as e:
            print(f"[SMART_BRAIN_ERROR] get_response: {e}")
            return None

    def get_response_with_fallback(self, text, user_id=None):
        """
        Like get_response but returns a generic response instead of None.
        Use this ONLY if the old system has no handler at all.
        """
        response = self.get_response(text, user_id)
        if response:
            return response
        return random.choice(ULTIMATE_FALLBACK_RESPONSES)

    @property
    def is_ready(self):
        """Check if the brain is initialized and ready."""
        return self._ready

    @property
    def intent_count(self):
        """Get total number of loaded intents."""
        return len(self._intents)

    @property
    def has_sklearn(self):
        """Check if sklearn is available for TF-IDF matching."""
        return _HAS_SKLEARN
