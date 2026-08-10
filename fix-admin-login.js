const fs = require('fs');

let content = fs.readFileSync('admin-login.html', 'utf8');

// Replace FFFD sequences manually 
// The replacement character U+FFFD appears as \uFFFD in JS
const FFFD = '\uFFFD';

// Fix title
content = content.replace(new RegExp('<title>[' + FFFD + ' ]+<\\/title>'), '<title>يوسف بركات | لوحة الإدارة</title>');

// Fix h1 admin-title
content = content.replace(new RegExp('<h1 class="admin-title">[' + FFFD + ' ]+<\\/h1>'), '<h1 class="admin-title">لوحة تحكم الإدارة</h1>');

// Fix p admin-subtitle
content = content.replace(new RegExp('<p class="admin-subtitle">[' + FFFD + ' ]+<\\/p>'), '<p class="admin-subtitle">الوصول مسموح فقط لمالك المنصة</p>');

// Fix email placeholder
content = content.replace(
    new RegExp('placeholder="[' + FFFD + ' ]+" required autocomplete="email"'),
    'placeholder="البريد الإلكتروني للإدارة" required autocomplete="email"'
);

// Fix password placeholder  
content = content.replace(
    new RegExp('placeholder="[' + FFFD + ' ]+" required autocomplete="current-password"'),
    'placeholder="كلمة المرور" required autocomplete="current-password"'
);

// Fix submit button
content = content.replace(
    new RegExp('<button type="submit" class="btn-admin">[' + FFFD + ' ]+<\\/button>'),
    '<button type="submit" class="btn-admin">تسجيل الدخول</button>'
);

fs.writeFileSync('admin-login.html', content, 'utf8');
console.log('Done!');

// Verify
const check = fs.readFileSync('admin-login.html', 'utf8');
console.log('Has FFFD left:', check.includes('\uFFFD'));
console.log('Has Arabic:', check.includes('لوحة'));
