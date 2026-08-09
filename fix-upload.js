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

const replacement = `                    const attachLectureId = itemObj.attachLectureId;
                    delete itemObj.attachLectureId;
                    
                    let added = false;
                    if(section === 'lectures' && attachLectureId) {
                        added = attachToLecture(courses[idx], attachLectureId, itemObj);
                    }
                    
                    if(!added) {
                        if (courses[idx].contents.sections && Array.isArray(courses[idx].contents.sections)) {
                            // New System: Push to sections
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
                            // Legacy System
                            courses[idx].contents[section].push(itemObj);
                        }
                    }`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
} else {
    console.log('Target string not found!');
}
    
const missing = `                if (window.FirebaseService && typeof window.FirebaseService.getCourses === 'function') {
                    try {
                        const sc = await window.FirebaseService.getCourses();
                        if(sc && sc.length) courses = sc;
                    } catch(e) {}
                }`;

if (!content.includes('getCourses()')) {
    const idx_target = `                const idx = courses.findIndex(c => c.id === courseId);`;
    content = content.replace(idx_target, missing + '\n\n' + idx_target);
}

fs.writeFileSync('admin-upload.html', content, 'utf-8');
console.log('Done!');
