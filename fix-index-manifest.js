const fs = require('fs');
let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace('href="./manifest.json"', 'href="./manifest.json?v=' + Date.now() + '"');
fs.writeFileSync('index.html', indexHtml, 'utf8');
console.log('Fixed index.html');
