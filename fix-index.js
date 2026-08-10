const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') || f.endsWith('.js'));
files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    if (c.includes('/index.html')) {
        console.log(f, 'contains /index.html');
        c = c.replace(/href="\/index\.html"/g, 'href="index.html"');
        c = c.replace(/window\.location\.href\s*=\s*['"]\/index\.html['"]/g, 'window.location.href = "index.html"');
        fs.writeFileSync(f, c, 'utf8');
    }
});
