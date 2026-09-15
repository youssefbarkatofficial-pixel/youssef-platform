const fs = require('fs'); 
let code = fs.readFileSync('sw.js', 'utf8'); 
code = code.replace(/const CACHE_NAME = 'youssef-platform-v[0-9]+';/, 'const CACHE_NAME = \\'youssef-platform-v' + Date.now() + '\\';'); 
fs.writeFileSync('sw.js', code);
