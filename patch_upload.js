const fs = require('fs');

let html = fs.readFileSync('admin-upload.html', 'utf8');

// The original line is:
// if (courses[idx].contents.sections && Array.isArray(courses[idx].contents.sections)) {
// I will change it to:
// if (false && courses[idx].contents.sections && Array.isArray(courses[idx].contents.sections)) {
// So that it never pushes to sections, only legacy.

html = html.replace('if (courses[idx].contents.sections && Array.isArray(courses[idx].contents.sections)) {', 'if (false && courses[idx].contents.sections && Array.isArray(courses[idx].contents.sections)) {');

fs.writeFileSync('admin-upload.html', html);
console.log("Patched admin-upload.html");
