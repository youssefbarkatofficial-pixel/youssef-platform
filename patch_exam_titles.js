const fs = require('fs');
let html = fs.readFileSync('course-details.html', 'utf8');

// 1. Fix max attempts check
html = html.replace(
    /const prevAttempts = \(dbRec\.examResults \|\| \[\]\)\.filter\(r => r\.courseId === courseId && r\.examTitle === \(exam\.title \|\| ''\)\);/g,
    `const prevAttempts = (dbRec.examResults || []).filter(r => r.courseId === courseId && ( (r.examId && r.examId === exam.id) || (!r.examId && r.examTitle === (exam.title || '')) ));`
);

// 2. Fix grade rendering check
html = html.replace(
    /const results = \(dbRec\.examResults \|\| \[\]\)\.filter\(r => r\.courseId === course\.id && r\.examTitle === item\.title\);/g,
    `const results = (dbRec.examResults || []).filter(r => r.courseId === course.id && ( (r.examId && r.examId === item.id) || (!r.examId && r.examTitle === item.title) ));`
);

// 3. Fix saving result
html = html.replace(
    /dbRec\.examResults\.push\(\{ courseId, examTitle: exam\.title\|\|'', percent,/g,
    `dbRec.examResults.push({ courseId, examId: exam.id, examTitle: exam.title||'', percent,`
);

fs.writeFileSync('course-details.html', html);
console.log('Fixed course-details.html');
