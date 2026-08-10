/**
 * SURGICAL FIX SCRIPT
 * Fixes specific garbled Arabic texts that slipped through the master fix
 * These were incorrectly converted - now doing precise replacements
 */
const fs = require('fs');

const EXACT_FIXES = [
    // stats.html - subtitle garbled
    { file: 'stats.html', bad: "تابع تقدمك الحقيقي وحللظ' أداط،ك بدقة", good: 'تابع تقدمك الحقيقي وحلل أداءك بدقة' },
    // stats.html - userNameDisplay
    { file: 'stats.html', bad: 'ط·الب', good: 'طالب' },
    // login.html - subtitle
    { file: 'login.html', bad: 'مروّراتك مُحفظة في منصة', good: 'مرحباً بك في منصة يوسف بركات' },
    // index.html nav-brand link fix (links to index.html not /)
    // Check all sidebar pages for leftover garbled text
];

// Scan all HTML for remaining garbled fragments
const garbledPatterns = [
    /[ط-ي][،؛ء-ي]*ظ[^ه]/g,  // mojibake remnants
    /أداط/g,
    /حللظ/g,
    /بدخة/g,
    /أدانطب/g,
];

const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));

let totalFixes = 0;

// Apply exact fixes first
for (const { file, bad, good } of EXACT_FIXES) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes(bad)) {
        content = content.split(bad).join(good);
        fs.writeFileSync(file, content, 'utf8');
        console.log(`✅ Fixed in ${file}: "${bad}" -> "${good}"`);
        totalFixes++;
    }
}

// Now scan all files for remaining issues and print them for manual inspection
console.log('\n--- Scanning remaining issues ---');
htmlFiles.forEach(f => {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
        if (line.includes('أداط') || line.includes('حللظ') || line.includes('بدخة') || 
            line.includes('أدانطب') || line.includes('ط·') || line.includes('ط§ط')) {
            console.log(`  ${f}:${i+1}: ${line.trim().substring(0, 100)}`);
        }
    });
});

console.log(`\nTotal exact fixes applied: ${totalFixes}`);
