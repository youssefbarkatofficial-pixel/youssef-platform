const fs = require('fs');
let html = fs.readFileSync('course-details.html', 'utf8');

// 1. Add style
html = html.replace('</head>', '<style>body.strict-exam-active #pfChatBtn, body.strict-exam-active #pfChatBubble, body.strict-exam-active #pfChatWindow { display: none !important; }</style>\n</head>');

// 2. Add class on exam start
html = html.replace("document.getElementById('examModalTitle').textContent = (exam.title || examTypeName)", "if(exam.strictMode) { document.body.classList.add('strict-exam-active'); }\n                        document.getElementById('examModalTitle').textContent = (exam.title || examTypeName)");

// 3. Remove class on exam close
html = html.replace(/examModal\.classList\.remove\('active'\);/g, "examModal.classList.remove('active'); document.body.classList.remove('strict-exam-active');");

fs.writeFileSync('course-details.html', html);
console.log('Strict mode fix applied.');
