const fs = require('fs');
let content = fs.readFileSync('admin-upload.html', 'utf-8');

const regex = /if\(section === 'lectures'\) \{\s*const attachLectureId = itemObj\.attachLectureId;\s*delete itemObj\.attachLectureId;\s*if\(attachLectureId && attachToLecture\(courses\[idx\], attachLectureId, itemObj\)\) \{\s*\/\/ attached successfully\s*\} else \{\s*\/\/ Add as an independent item in lectures\s*courses\[idx\]\.contents\.lectures\.push\(itemObj\);\s*\}\s*\} else \{\s*delete itemObj\.attachLectureId;\s*courses\[idx\]\.contents\[section\]\.push\(itemObj\);\s*\}/;

const replacement = `if(section === 'lectures' && itemObj.attachLectureId) {
                        const attachLectureId = itemObj.attachLectureId;
                        delete itemObj.attachLectureId;
                        if(attachLectureId && attachToLecture(courses[idx], attachLectureId, itemObj)) {
                            // attached successfully
                            return; // Wait, we can't return here because we need to save! Let's use a flag.
                        }
                    }
                    // Wait, let's just do it correctly without return.`;

const actualReplacement = `let addedToLecture = false;
                    if(section === 'lectures' && itemObj.attachLectureId) {
                        const attachLectureId = itemObj.attachLectureId;
                        delete itemObj.attachLectureId;
                        if(attachLectureId && attachToLecture(courses[idx], attachLectureId, itemObj)) {
                            addedToLecture = true;
                        }
                    }
                    
                    delete itemObj.attachLectureId;
                    
                    if(!addedToLecture) {
                        if (courses[idx].contents.sections && Array.isArray(courses[idx].contents.sections)) {
                            let secId = 'sec_' + section;
                            let secObj = courses[idx].contents.sections.find(s => s.id === secId);
                            if (!secObj) {
                                let titles = { lectures: 'المحاضرات', homeworks: 'الواجبات', exams: 'الامتحانات', trainings: 'التدريبات' };
                                secObj = { id: secId, title: titles[section] || 'قسم جديد', items: [] };
                                courses[idx].contents.sections.push(secObj);
                            }
                            if (!secObj.items) secObj.items = [];
                            secObj.items.push(itemObj);
                        } else {
                            courses[idx].contents[section].push(itemObj);
                        }
                    }`;

if (regex.test(content)) {
    content = content.replace(regex, actualReplacement);
    console.log("Success");
} else {
    console.log("Failed");
}

fs.writeFileSync('admin-upload.html', content, 'utf-8');
