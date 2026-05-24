# Temporary script to decode mojibake samples from support-chat.js
samples = [
    'ط§ظ„ظƒط±ط³',
    'ط§ظ„ط¨ظˆطµظ„ط©',
    'ط§ظ„ط­ط§طھط§',
    'ط³ظ„ط§ظ…',
    'ط§ظ„ظ…ظ†طµظ‰',
    'ظ…ط´ ط¹ط±ظپ',
    'ط§ط¥طھط¨ط§ط¹',
    'ط§ظ„ط³ط¤ط§ظ„',
    'ظ…ظ…ظƒظ†',
    'ط§ظ„ط§ط³طھط§ط°',
    'ظˆظ…ط§ط¶ظٹ',
    'ط§ظ„طھط§ط¬'
]
for s in samples:
    try:
        b = s.encode('utf-8')
        print(s, '->', b.decode('cp1256'))
    except Exception as e:
        print('ERROR', s, e)
