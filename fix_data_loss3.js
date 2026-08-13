const fs = require('fs');
const files = ['js/dashboard.js', 'course-details.html', 'exams.html', 'stats.html'];

const newCode = `
                let merged = { ...dbUser, ...(typeof onlineUser !== 'undefined' ? onlineUser : (typeof remoteUser !== 'undefined' ? remoteUser : {})) };
                merged.courses = [...new Set([...(dbUser.courses||[]), ...(merged.courses||[])])];
                merged.completedItems = [...new Set([...(dbUser.completedItems||[]), ...(merged.completedItems||[])])];
                merged.examResults = { ...(dbUser.examResults||{}), ...(merged.examResults||{}) };
                merged.watchProgress = { ...(dbUser.watchProgress||{}), ...(merged.watchProgress||{}) };
                
                let payments = JSON.parse(localStorage.getItem('paymentRequests')) || [];
                let unlocked = payments.filter(p => p.userPhone === user.phone && p.status === 'unlocked').map(p => p.courseId);
                if(unlocked.length > 0) {
                    merged.courses = [...new Set([...merged.courses, ...unlocked])];
                }
                
                dbUser = merged;
                localStorage.setItem(\`db_\${user.phone}\`, JSON.stringify(dbUser));
                
                if(window.FirebaseService && typeof window.FirebaseService.syncLocalToFirestore === 'function') {
                    setTimeout(() => window.FirebaseService.syncLocalToFirestore(), 2000);
                }
`;

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');
  let regex = /dbUser\s*=\s*(?:Object\.assign\(dbUser,\s*onlineUser\)|onlineUser|remoteUser|Object\.assign\(dbUser,\s*remoteUser\));\s*localStorage\.setItem\(`db_\$\{user\.phone\}`,\s*JSON\.stringify\(dbUser\)\);/g;
  
  if (regex.test(c)) {
      c = c.replace(regex, newCode);
      fs.writeFileSync(f, c);
      console.log('Modified', f);
  } else {
      console.log('Not found in', f);
  }
});
