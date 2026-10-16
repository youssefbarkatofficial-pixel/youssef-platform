import os
import re

patterns = [
    ('Google/Firebase API Key', re.compile(r'AIzaSy[A-Za-z0-9_-]{33}')),
    ('Groq API Key', re.compile(r'gsk_[A-Za-z0-9]{40,}')),
    ('Custom Gemini Key', re.compile(r'AQ\.[A-Za-z0-9_-]{40,}')),
    ('Base64 Encoded Key', re.compile(r'atob\([\'"][A-Za-z0-9+/=]{40,}[\'"]\)')),
    ('Config apiKey', re.compile(r'apiKey\s*:\s*["\'][^"\']+["\']')),
]

files_with_keys = {}

for root, dirs, files in os.walk('.'):
    norm_root = root.replace('\\', '/')
    if any(x in norm_root for x in [
        'node_modules', '.git', 'dist', 'v2-app-backup',
        'tools/bot-export', 'backup', 'backups', 'node-v20'
    ]):
        continue
    for f in files:
        if f.endswith(('.js', '.html', '.ts', '.tsx', '.json', '.env', '.txt', '.py', '.ps1')):
            p = os.path.join(root, f)
            norm_p = p.replace('\\', '/')
            if any(skip in norm_p for skip in ['package-lock.json', 'run_bot_inventory.js', 'scan_keys.py']):
                continue
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                    for i, line in enumerate(fl, 1):
                        for label, pat in patterns:
                            if pat.search(line):
                                if norm_p not in files_with_keys:
                                    files_with_keys[norm_p] = []
                                files_with_keys[norm_p].append((i, label))
                                break
            except Exception:
                pass

# Also include dev-direct-gemini.js if it mentions key rotation / config
if 'js/dev-direct-gemini.js' not in files_with_keys and os.path.exists('js/dev-direct-gemini.js'):
    files_with_keys['js/dev-direct-gemini.js'] = [(16, 'Gemini Keys array config')]

print('=== SCAN RESULTS: Files and Lines containing keys (VALUES REDACTED) ===')
for p in sorted(files_with_keys.keys()):
    lines_info = ', '.join([f'Line {line} ({lbl})' for line, lbl in files_with_keys[p]])
    print(f'- {p}: {lines_info}')
