const fs = require('fs');

let sw = fs.readFileSync('sw.js', 'utf8');
sw = sw.replace(/const CACHE_VERSION = 'v\d+';/, "const CACHE_VERSION = 'v15';");
fs.writeFileSync('sw.js', sw, 'utf8');

let manifest = fs.readFileSync('manifest.json', 'utf8');
manifest = manifest.replace(/\?v=\d+/g, "?v=5");
fs.writeFileSync('manifest.json', manifest, 'utf8');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/logo\.png\?v=\d+/g, "logo.png?v=6");
    fs.writeFileSync(f, content, 'utf8');
});

console.log('Bumped cache to v15/v6 for teacher logo');
