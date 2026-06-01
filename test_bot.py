import sys
import os

# Add the project directory to sys.path so we can import bot_addons
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from bot_addons.ai_core import SmartBotBrain

def main():
    brain = SmartBotBrain()
    print("Bot Ready:", brain.is_ready)
    
    test_cases = [
        "ازايك",
        "عامل ايه",
        "صباح الخير",
        "النيل",
        "مش فاهم",
        "قناة السويس"
    ]
    
    for text in test_cases:
        print(f"\nUser: {text}")
        response = brain.get_response_with_fallback(text, user_id="guest_123")
        print(f"Bot: {response}")

if __name__ == "__main__":
    main()
