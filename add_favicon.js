const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('<link rel="icon"')) {
        content = content.replace('</head>', '    <link rel="icon" type="image/png" href="images/logo.png?v=5">\n</head>');
        fs.writeFileSync(f, content, 'utf8');
    }
});
