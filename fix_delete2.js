const fs = require('fs');
let html = fs.readFileSync('admin-courses.html', 'utf8');

const oldLine = `c.contents.exams = c.contents.exams.filter(e => !(e.title && e.title.replace(/\\s+/g, '') === 'امتحانالدرسالأول-الوحدةالاولى3اعدادي'));`;
const newLine = `c.contents.exams = c.contents.exams.filter(e => !(e.title && e.title.trim() === 'امتحان الدرس الأول - الوحدة الاولى 3اعدادي'));`;

html = html.replace(oldLine, newLine);
fs.writeFileSync('admin-courses.html', html);
console.log("Fixed delete condition");
