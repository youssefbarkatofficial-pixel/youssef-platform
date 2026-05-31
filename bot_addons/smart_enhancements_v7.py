"""
smart_enhancements_v7.py - Enhancements 111-130 for SmartBotBrain
================================================================
ADDITIVE ONLY / FAIL-SAFE / OFFLINE / MODULAR

Implements the Lightweight Long-Term Memory Architecture & Human Illusion.
"""

import os
import json
import time
import random

# File for lightweight persistent memory
MEMORY_FILE = os.path.join(os.path.dirname(__file__), "user_profiles.json")

class MemoryManager:
    """Handles loading and saving lightweight user profiles."""
    def __init__(self):
        self.profiles = {}
        self.last_save = time.time()
        self._load()

    def _load(self):
        try:
            if os.path.exists(MEMORY_FILE):
                with open(MEMORY_FILE, 'r', encoding='utf-8') as f:
                    self.profiles = json.load(f)
        except Exception as e:
            print(f"[V7_MEMORY] Load error: {e}")
            self.profiles = {}

    def _save(self):
        try:
            with open(MEMORY_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.profiles, f, ensure_ascii=False)
            self.last_save = time.time()
        except Exception as e:
            print(f"[V7_MEMORY] Save error: {e}")

    def get_profile(self, user_id):
        uid = str(user_id)
        if uid not in self.profiles:
            self.profiles[uid] = {
                "topics": [],            # [121] Topic Timeline
                "confusion_count": 0,    # [114/116] Track if student struggles often
                "last_emotion": "neutral",# [119] Emotional memory
                "exam_hits": 0,          # [120] Exam period tracking
                "last_active": time.time(),
                "level": "simple",       # [117/128] Personalized style
                "praise_count": 0
            }
        return self.profiles[uid]

    def update_profile(self, user_id, updates):
        uid = str(user_id)
        profile = self.get_profile(uid)
        profile.update(updates)
        
        # [127] Smart Forgetting
        if "topics" in profile:
            # Keep only last 5 topics
            profile["topics"] = profile["topics"][-5:]
        
        profile["last_active"] = time.time()
        
        # Save lazily (every 10 seconds to avoid disk spam)
        if time.time() - self.last_save > 10:
            self._save()


class SmartEnhancementsV7:
    """Enhancements 111-130: Long-Term Memory, Session Recovery, Personalized Teaching."""

    def __init__(self):
        self.memory = MemoryManager()
        self.session_resumed = set()
        print("[ENHANCEMENTS_V7] ✅ SmartEnhancementsV7 loaded (Long Memory)")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # [113/118/124] Smart Session Recovery
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def handle_session_recovery(self, user_id, normalized_text):
        try:
            uid = str(user_id)
            profile = self.memory.get_profile(uid)
            last_active = profile.get("last_active", time.time())
            
            # If user returns after 30 minutes
            if time.time() - last_active > 1800:
                self.session_resumed.add(uid)
                topics = profile.get("topics", [])
                
                # If they say something generic like "نكمل"
                if any(w in normalized_text for w in ["نكمل", "يلا", "جاهز"]) and topics:
                    last_topic = topics[-1]
                    return f"أهلاً بيك من جديد 😄! كنا بنتكلم عن {last_topic}.. تحب نكمل ولا ندخل في موضوع جديد؟"
            
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Pre-processing [111/119/120]
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def pre_process(self, normalized_text, layers, tags, user_id=None):
        """Update memory with current message state before generating response."""
        try:
            if not user_id:
                return None
            
            uid = str(user_id)
            profile = self.memory.get_profile(uid)
            
            # [113] Check recovery
            recovery_msg = self.handle_session_recovery(uid, normalized_text)
            if recovery_msg:
                return recovery_msg
            
            # [119] Emotional Memory Application
            if profile.get("last_emotion") == "frustrated" and layers.get("emotion") != "frustrated":
                tags["needs_gentle"] = True
                
            # [120] Exam Period Tracking
            if layers.get("urgency") or "امتحان" in normalized_text:
                profile["exam_hits"] = profile.get("exam_hits", 0) + 1
            
            if profile.get("exam_hits", 0) > 3:
                tags["exam_period_mode"] = True
                
            # [114/116] Repeated Confusion
            if tags.get("confused"):
                profile["confusion_count"] = profile.get("confusion_count", 0) + 1
            if profile.get("confusion_count", 0) >= 3:
                tags["ultra_simple"] = True
                
            self.memory.update_profile(uid, profile)
            return None
        except Exception:
            return None

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # MASTER: Post-processing [115/125/126/130]
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    def post_process(self, response, intent_id, layers, tags, user_id=None):
        """Apply memory-based formatting and update profile."""
        try:
            if not user_id:
                return response
                
            uid = str(user_id)
            profile = self.memory.get_profile(uid)
            topics = profile.get("topics", [])
            
            # Record topic
            if intent_id and (not topics or topics[-1] != intent_id):
                topics.append(intent_id)
            
            # [119] Emotional state update
            profile["last_emotion"] = layers.get("emotion", "neutral")
            
            # [125] Learning Progress Illusion
            if not tags.get("confused") and len(topics) >= 3:
                # User is making progress
                if profile.get("praise_count", 0) < 2 and random.random() < 0.2:
                    response += "\n\n(واضح إن مستواك بيتطور 👏 استمر!)"
                    profile["praise_count"] = profile.get("praise_count", 0) + 1
                    
            # [126/130] Gentle opening if they were frustrated last time
            if tags.get("needs_gentle") and random.random() < 0.5:
                response = f"عاش يا بطل، أحسن من المرة اللي فاتت! 🎯\n{response}"
                profile["last_emotion"] = "neutral"  # Reset
                
            # [116] Ultra simple modifier
            if tags.get("ultra_simple") and random.random() < 0.4:
                response = f"بص، هقولهالك بأبسط طريقة ممكنة 🧠:\n{response}"
                
            self.memory.update_profile(uid, {"topics": topics, "last_emotion": profile["last_emotion"]})
            
            return response
        except Exception:
            return response
