const fs = require('fs');
const path = require('path');

const snippet = `<script>
    if (!sessionStorage.getItem('currentAdmin')) { window.location.replace('admin-login'); }
    else { document.documentElement.style.display = 'none'; }
</script>`;

const files = fs.readdirSync(__dirname).filter(f => f.startsWith('admin-') && f.endsWith('.html') && !f.includes('login') && !f.includes('.tmp'));

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes("sessionStorage.getItem('currentAdmin')")) {
        content = content.replace(/<head>/i, `<head>\n    ${snippet}`);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Injected into ' + file);
    }
});
