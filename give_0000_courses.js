const fs = require('fs');
const files = ['js/dashboard.js', 'my-courses.html', 'my-courses.head.html', 'course-details.html', 'homeworks.html', 'homeworks.head.html'];

files.forEach(f => {
  if (fs.existsSync(f)) {
      let c = fs.readFileSync(f, 'utf8');
      const replacement = `if (user.phone === '0000') { let ac = JSON.parse(localStorage.getItem('adminCourses')) || []; if (ac.length > 0) merged.courses = ac.map(x => x.id); }\n                dbUser = merged;`;
      if (c.includes('dbUser = merged;')) {
          c = c.replace(/dbUser = merged;/g, replacement);
          fs.writeFileSync(f, c);
          console.log('Modified', f);
      }
  }
});
