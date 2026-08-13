const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') && !f.includes('tmp'));

const searchStr = `let dbUser = JSON.parse(localStorage.getItem(\`db_\${user.phone}\`)) || { courses: [] };
            try {
                if (window.FirebaseService && typeof window.FirebaseService.getUser === 'function') {
                    const onlineUser = await window.FirebaseService.getUser(user.phone);
                    if (onlineUser) {
                        dbUser = onlineUser;
                        localStorage.setItem(\`db_\${user.phone}\`, JSON.stringify(dbUser));
                    }
                }
            } catch (e) { console.warn('Firebase user sync failed:', e); }`;

const replaceStr = `let dbUser = JSON.parse(localStorage.getItem(\`db_\${user.phone}\`)) || { courses: [] };
            try {
                if (window.FirebaseService && typeof window.FirebaseService.getUser === 'function') {
                    const onlineUser = await window.FirebaseService.getUser(user.phone);
                    if (onlineUser) {
                        // SMART MERGE TO PREVENT DATA LOSS
                        let merged = { ...dbUser, ...onlineUser };
                        merged.courses = [...new Set([...(dbUser.courses||[]), ...(onlineUser.courses||[])])];
                        merged.completedItems = [...new Set([...(dbUser.completedItems||[]), ...(onlineUser.completedItems||[])])];
                        merged.examResults = { ...(dbUser.examResults||{}), ...(onlineUser.examResults||{}) };
                        merged.watchProgress = { ...(dbUser.watchProgress||{}), ...(onlineUser.watchProgress||{}) };
                        
                        // SELF-HEALING FROM CACHED PAYMENT REQUESTS
                        let payments = JSON.parse(localStorage.getItem('paymentRequests')) || [];
                        let unlocked = payments.filter(p => p.userPhone === user.phone && p.status === 'unlocked').map(p => p.courseId);
                        if(unlocked.length > 0) {
                            merged.courses = [...new Set([...merged.courses, ...unlocked])];
                        }
                        
                        dbUser = merged;
                        localStorage.setItem(\`db_\${user.phone}\`, JSON.stringify(dbUser));
                        
                        // Try syncing healed data back to cloud
                        if(window.FirebaseService && typeof window.FirebaseService.syncLocalToFirestore === 'function') {
                            setTimeout(() => window.FirebaseService.syncLocalToFirestore(), 2000);
                        }
                    }
                }
            } catch (e) { console.warn('Firebase user sync failed:', e); }`;

let mod = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(f, content);
    console.log('Modified:', f);
    mod++;
  } else {
      // Sometimes spacing is slightly different. Try regex.
      let regex = /let dbUser = JSON\.parse\(localStorage\.getItem\(`db_\$\{user\.phone\}`\)\) \|\| \{ courses: \[\] \};\s*try \{\s*if \(window\.FirebaseService && typeof window\.FirebaseService\.getUser === 'function'\) \{\s*const onlineUser = await window\.FirebaseService\.getUser\(user\.phone\);\s*if \(onlineUser\) \{\s*dbUser = onlineUser;\s*localStorage\.setItem\(`db_\$\{user\.phone\}`,\s*JSON\.stringify\(dbUser\)\);\s*\}\s*\}\s*\} catch \(e\) \{ console\.warn\('Firebase user sync failed:', e\); \}/;
      if (regex.test(content)) {
          content = content.replace(regex, replaceStr);
          fs.writeFileSync(f, content);
          console.log('Modified (Regex):', f);
          mod++;
      }
  }
});
console.log('Total files modified:', mod);
