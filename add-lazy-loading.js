const fs = require('fs');
const path = require('path');

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.includes('.tmp'));

let modifiedCount = 0;

for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace <img ... > with <img loading="lazy" ... > but only if not already lazy
    // Also ignore tiny placeholder images or tracking pixels if needed.
    // Simple regex: find <img, check if loading= is not there, then inject loading="lazy"
    
    let changed = false;
    // Replace all img tags that do not have loading attribute
    content = content.replace(/<img\s+(?![^>]*loading=)[^>]*>/gi, (match) => {
        changed = true;
        return match.replace(/<img\s+/i, '<img loading="lazy" ');
    });

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        modifiedCount++;
        console.log(`✅ Lazy load added: ${file}`);
    }
}

console.log(`\nDone. Optimized ${modifiedCount} files.`);
