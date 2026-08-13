const fs = require('fs');
const files = ['js/dashboard.js', 'course-details.html', 'homeworks.html', 'homeworks.head.html', 'my-courses.html', 'my-courses.head.html'];

const replacement = `
                let erLocal = Array.isArray(dbUser.examResults) ? dbUser.examResults : [];
                let erRemote = Array.isArray(typeof onlineUser !== 'undefined' ? onlineUser.examResults : (typeof remoteUser !== 'undefined' ? remoteUser.examResults : [])) ? (typeof onlineUser !== 'undefined' ? onlineUser.examResults : (typeof remoteUser !== 'undefined' ? remoteUser.examResults : [])) : [];
                let erMerged = [...erLocal, ...erRemote];
                let uniqueER = [];
                let erKeys = new Set();
                erMerged.forEach(r => {
                    let k = r.courseId + '_' + r.examTitle + '_' + r.attemptNumber;
                    if(!erKeys.has(k)) { erKeys.add(k); uniqueER.push(r); }
                });
                merged.examResults = uniqueER;
`;

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');
  let regex = /merged\.examResults = \{ \.\.\.\(dbUser\.examResults\|\|\{\}\), \.\.\.\(merged\.examResults\|\|\{\}\) \};/g;
  
  if (regex.test(c)) {
      c = c.replace(regex, replacement);
      fs.writeFileSync(f, c);
      console.log('Modified', f);
  }
});
