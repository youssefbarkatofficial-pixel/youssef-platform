const fs = require('fs');

// Update sw.js
let sw = fs.readFileSync('sw.js', 'utf8');
sw = sw.replace(/const CACHE_VERSION = 'v\d+';/, "const CACHE_VERSION = 'v14';");
fs.writeFileSync('sw.js', sw, 'utf8');

// Update manifest.json
let manifest = fs.readFileSync('manifest.json', 'utf8');
manifest = manifest.replace(/\?v=\d+/g, "?v=4");
fs.writeFileSync('manifest.json', manifest, 'utf8');

// Update HTML files
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/logo\.png\?v=\d+/g, "logo.png?v=5");
    fs.writeFileSync(f, content, 'utf8');
});

console.log('Bumped cache versions for new logo');
