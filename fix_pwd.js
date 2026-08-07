const fs = require('fs'); 
const files = ['admin-courses.html', 'admin-dashboard.html', 'admin-dashboard.test.html', 'admin-payments.html']; 
for(let f of files) { 
    let content = fs.readFileSync(f, 'utf8'); 
    content = content.replace(/pwd !== "My@36_172001"/g, 'pwd.trim() !== "My@36_172001"'); 
    fs.writeFileSync(f, content); 
}
