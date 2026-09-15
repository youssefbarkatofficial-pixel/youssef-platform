const fs = require('fs');
let c = fs.readFileSync('js/firebase-service.js', 'utf8');
let m = c.match(/apiKey:\s*['"]([^'"]+)['"]/);
let m2 = c.match(/projectId:\s*['"]([^'"]+)['"]/);
console.log(m ? m[1] : 'No apiKey');
console.log(m2 ? m2[1] : 'No projectId');
