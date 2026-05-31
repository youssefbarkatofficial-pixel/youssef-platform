"""
integration_example.py - Safe Integration Example for Al-Bawsala Bot
====================================================================
This file shows HOW to safely integrate SmartBotBrain into your existing bot.
DO NOT modify your existing bot files directly. Instead, add these safe wrappers.

IMPORTANT: This is a REFERENCE FILE, not meant to be imported directly.
Copy the relevant patterns into your bot's message handler.
"""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 1: Safe Import (put this at the top of your bot file)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
try:
    from bot_addons.ai_core import SmartBotBrain
    brain = SmartBotBrain()
    if brain.is_ready:
        print(f"[BOT] SmartBrain loaded: {brain.intent_count} intents, sklearn={brain.has_sklearn}")
    else:
        brain = None
        print("[BOT] SmartBrain failed to initialize, using old system only")
except Exception as e:
    brain = None
    print(f"[AI_CORE_LOAD_ERROR] {e}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Step 2: Safe Response (put this in your message handler)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def handle_message(text, user_id):
    """Example message handler with safe AI integration."""

    response = None

    # Try smart AI first
    try:
        if brain:
            response = brain.get_response(text, user_id)
    except Exception as e:
        print(f"[AI_RESPONSE_ERROR] {e}")

    # If AI found a confident match, return it
    if response:
        return response

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # OLD SYSTEM CONTINUES HERE - UNTOUCHED
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Your existing bot logic goes here exactly as before
    # Nothing is removed or modified
    # ...
    pass


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Example: Telegram Bot Integration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
# In your existing telegram handler:

@bot.message_handler(func=lambda message: True)
def handle_all(message):
    text = message.text
    user_id = message.from_user.id

    response = None

    # Try smart AI
    try:
        if brain:
            response = brain.get_response(text, user_id)
    except Exception as e:
        print(f"[AI_RESPONSE_ERROR] {e}")

    if response:
        bot.reply_to(message, response)
        return

    # OLD HANDLER LOGIC CONTINUES HERE (unchanged)
    # ...
"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Example: Discord Bot Integration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
# In your existing discord handler:

@client.event
async def on_message(message):
    if message.author.bot:
        return

    text = message.content
    user_id = message.author.id

    response = None

    try:
        if brain:
            response = brain.get_response(text, user_id)
    except Exception as e:
        print(f"[AI_RESPONSE_ERROR] {e}")

    if response:
        await message.channel.send(response)
        return

    # OLD HANDLER LOGIC CONTINUES HERE (unchanged)
    # ...
"""
