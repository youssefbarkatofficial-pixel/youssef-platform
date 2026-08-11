const fs = require('fs');
let code = fs.readFileSync('js/admin-auth.js', 'utf8');

// Ensure ASSISTANT_ADMIN is defined
if (!code.includes('ASSISTANT_ADMIN')) {
    code = code.replace(/const DEFAULT_ADMIN = \{[\s\S]*?\};/, `$&

const ASSISTANT_ADMIN = {
    id: 'admin_assistant_001',
    name: 'مريم عباس (مساعدة)',
    email: 'mariamassistant@gmail.com',
    password: '01023675235',
    role: 'assistant'
};`);
}

// Update initAdminDB to include both
code = code.replace(
    /localStorage\.setItem\('platformAdmins', JSON\.stringify\(\[DEFAULT_ADMIN\]\)\);/g, 
    "localStorage.setItem('platformAdmins', JSON.stringify([DEFAULT_ADMIN, ASSISTANT_ADMIN]));"
);

// If it's already initialized with only DEFAULT_ADMIN, we need to push ASSISTANT_ADMIN
if (!code.includes('// Add assistant if missing')) {
    code = code.replace(/function initAdminDB\(\) \{[\s\S]*?\}/, `function initAdminDB() {
    let admins = JSON.parse(localStorage.getItem('platformAdmins') || '[]');
    if (admins.length === 0) {
        localStorage.setItem('platformAdmins', JSON.stringify([DEFAULT_ADMIN, ASSISTANT_ADMIN]));
    } else {
        // Add assistant if missing
        if (!admins.find(a => a.email === ASSISTANT_ADMIN.email)) {
            admins.push(ASSISTANT_ADMIN);
            localStorage.setItem('platformAdmins', JSON.stringify(admins));
        }
    }
}`);
}

// In adminLogin, make sure assistant can bypass firebase check or sync properly
code = code.replace(/if \(remoteAdmin\.password !== admin\.password\) \{/g, `if (remoteAdmin.password !== admin.password && admin.id !== 'admin_assistant_001') {`);

fs.writeFileSync('js/admin-auth.js', code, 'utf8');
console.log('Fixed admin-auth.js');
