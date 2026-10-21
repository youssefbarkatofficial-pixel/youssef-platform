import { execSync } from 'child_process';
import fs from 'fs';

fs.writeFileSync('bot-worker/test_q.sql', 'SELECT id, keywords, SUBSTR(text, 1, 100) as snippet FROM lesson_chunks LIMIT 5;');
const out = execSync('node ./node_modules/wrangler/bin/wrangler.js d1 execute bousala-db --remote --json --file=test_q.sql', { cwd: 'bot-worker' });
console.log(out.toString());
fs.unlinkSync('bot-worker/test_q.sql');
