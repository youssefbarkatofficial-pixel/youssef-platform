const fs = require('fs');
const html = fs.readFileSync('course-details.html', 'utf8');
const match = html.match(/<script>\s*document\.addEventListener\('DOMContentLoaded'[\s\S]*?<\/script>/);
if (match) {
    fs.writeFileSync('temp_check.js', match[0].replace(/<\/?script>/g, ''));
    console.log('Written to temp_check.js');
} else {
    console.log('No match found');
}
