const fs = require('fs');
let content = fs.readFileSync('admin-upload.html', 'utf-8');

const target = `                    if(section === 'lectures') {
                        const attachLectureId = itemObj.attachLectureId;
                        delete itemObj.attachLectureId;
                        if(attachLectureId && attachToLecture(courses[idx], attachLectureId, itemObj)) {
                            // attached successfully
                        } else {
                            // Add as an independent item in lectures
                            courses[idx].contents.lectures.push(itemObj);
                        }
                    } else {
                        delete itemObj.attachLectureId;
                        courses[idx].contents[section].push(itemObj);
                    }`;

const replacement = `                    if(section === 'lectures' && itemObj.attachLectureId) {
                        const attachLectureId = itemObj.attachLectureId;
                        delete itemObj.attachLectureId;
                        if(attachLectureId && attachToLecture(courses[idx], attachLectureId, itemObj)) {
                            // attached successfully
                            return; // skip the rest to not push it normally
                        }
                    }
                    
                    delete itemObj.attachLectureId;
                    
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
                    }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    console.log("Success: Replaced section logic.");
} else {
    console.log("Error: Target not found.");
}

fs.writeFileSync('admin-upload.html', content, 'utf-8');
