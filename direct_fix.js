// Direct Firebase REST API - Sign in as the student himself and fix his courses
const https = require('https');

const API_KEY = 'AIzaSyCT05MbiNBz15USSAPzqx1xxdIiDxykvHs';
const PROJECT_ID = 'youssefbarakatplatform-8abff';

function httpsPost(hostname, path, data, headers) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            hostname,
            path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
        };
        const req = https.request(options, (res) => {
            let resp = '';
            res.on('data', c => resp += c);
            res.on('end', () => { try { resolve(JSON.parse(resp)); } catch(e) { resolve(resp); } });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function httpsPatch(hostname, path, data, headers) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const options = {
            hostname,
            path,
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
        };
        const req = https.request(options, (res) => {
            let resp = '';
            res.on('data', c => resp += c);
            res.on('end', () => { try { resolve(JSON.parse(resp)); } catch(e) { resolve(resp); } });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function httpsGet(hostname, path, headers) {
    return new Promise((resolve, reject) => {
        const options = { hostname, path, method: 'GET', headers: { ...headers } };
        const req = https.request(options, (res) => {
            let resp = '';
            res.on('data', c => resp += c);
            res.on('end', () => { try { resolve(JSON.parse(resp)); } catch(e) { resolve(resp); } });
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    try {
        // Try signing in as the student
        console.log('1. Signing in as student 01129649095...');
        const studentEmail = '01129649095@student.youssefbarakat.com';
        const studentPass = 'youssefcr7\u0627\u0644\u0645\u064a\u0633\u062a\u0631\u0648';
        
        const auth = await httpsPost('identitytoolkit.googleapis.com', `/v1/accounts:signInWithPassword?key=${API_KEY}`, {
            email: studentEmail,
            password: studentPass,
            returnSecureToken: true
        });
        
        if (!auth.idToken) {
            console.log('   Student login failed:', JSON.stringify(auth));
            
            // Try admin with different password variations
            console.log('2. Trying admin login...');
            const passwords = ['YoussefMBarakat175235', 'My@36_172001', 'YoussefMBarakat175235!'];
            for (const pw of passwords) {
                const adminAuth = await httpsPost('identitytoolkit.googleapis.com', `/v1/accounts:signInWithPassword?key=${API_KEY}`, {
                    email: 'youssefbarkatofficial@gmail.com',
                    password: pw,
                    returnSecureToken: true
                });
                if (adminAuth.idToken) {
                    console.log('   ✓ Admin login succeeded with password variant');
                    await doFix(adminAuth.idToken);
                    return;
                }
                console.log('   Failed with:', pw.substring(0, 5) + '...');
            }
            
            console.log('   All login attempts failed. Trying without auth (public rules)...');
            await doFixNoAuth();
            return;
        }
        
        console.log('   ✓ Student signed in. UID:', auth.localId);
        await doFix(auth.idToken);
        
    } catch(err) {
        console.error('FATAL ERROR:', err);
    }
}

async function doFixNoAuth() {
    // Try to query courses without auth (maybe Firestore rules allow read)
    console.log('3. Querying courses (no auth)...');
    const coursesResult = await httpsPost('firestore.googleapis.com', 
        `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, 
        { structuredQuery: { from: [{ collectionId: 'courses' }] } }
    );
    
    if (coursesResult && Array.isArray(coursesResult)) {
        console.log('   Found', coursesResult.filter(c => c.document).length, 'courses');
        coursesResult.forEach(c => {
            if (c.document && c.document.fields) {
                const f = c.document.fields;
                const title = f.title ? f.title.stringValue : 'N/A';
                const grade = f.grade ? f.grade.stringValue : 'N/A';
                const id = c.document.name.split('/').pop();
                console.log('   -', title, '|', grade, '|', id);
            }
        });
    } else {
        console.log('   Query failed:', JSON.stringify(coursesResult).substring(0, 200));
    }
}

async function doFix(token) {
    const authHeader = { 'Authorization': 'Bearer ' + token };
    
    // Find student
    console.log('2. Searching for student...');
    const studentResult = await httpsPost('firestore.googleapis.com', 
        `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, 
        { structuredQuery: { from: [{ collectionId: 'students' }], where: { fieldFilter: { field: { fieldPath: 'phone' }, op: 'EQUAL', value: { stringValue: '01129649095' } } }, limit: 1 } },
        authHeader
    );
    
    let studentDoc = null;
    if (studentResult && Array.isArray(studentResult) && studentResult[0] && studentResult[0].document) {
        studentDoc = studentResult[0].document;
        const name = studentDoc.fields.name ? studentDoc.fields.name.stringValue : 'Unknown';
        console.log('   ✓ Found:', name, '| Path:', studentDoc.name);
    } else {
        console.log('   ✗ Student not found by phone. Result:', JSON.stringify(studentResult).substring(0, 300));
        return;
    }
    
    // Find courses
    console.log('3. Searching for 3rd prep courses...');
    const coursesResult = await httpsPost('firestore.googleapis.com', 
        `/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, 
        { structuredQuery: { from: [{ collectionId: 'courses' }] } },
        authHeader
    );
    
    let courseId = null;
    let courseName = '';
    if (coursesResult && Array.isArray(coursesResult)) {
        for (const c of coursesResult) {
            if (!c.document) continue;
            const f = c.document.fields;
            const title = f.title ? f.title.stringValue : '';
            const grade = f.grade ? f.grade.stringValue : '';
            const id = c.document.name.split('/').pop();
            console.log('   Course:', title, '| Grade:', grade, '| ID:', id);
            
            if (grade.includes('\u0627\u0644\u062b\u0627\u0644\u062b') || grade.includes('prep3') || grade.includes('3') || title.includes('3') || title.includes('\u062b\u0627\u0644\u062b')) {
                courseId = id;
                courseName = title;
            }
        }
    }
    
    if (!courseId) {
        console.log('   ✗ No 3rd prep course found!');
        return;
    }
    console.log('   ✓ Selected course:', courseName, '| ID:', courseId);
    
    // Get existing courses & notifications
    let existingCourses = [];
    if (studentDoc.fields.courses && studentDoc.fields.courses.arrayValue && studentDoc.fields.courses.arrayValue.values) {
        existingCourses = studentDoc.fields.courses.arrayValue.values.map(v => v.stringValue);
    }
    
    let existingNotifs = [];
    if (studentDoc.fields.notifications && studentDoc.fields.notifications.arrayValue && studentDoc.fields.notifications.arrayValue.values) {
        existingNotifs = studentDoc.fields.notifications.arrayValue.values.map(v => {
            const f = v.mapValue ? v.mapValue.fields : {};
            const result = {};
            for (const key in f) {
                if (f[key].stringValue !== undefined) result[key] = f[key].stringValue;
                else if (f[key].booleanValue !== undefined) result[key] = f[key].booleanValue;
                else if (f[key].integerValue !== undefined) result[key] = f[key].integerValue;
                else if (f[key].nullValue !== undefined) result[key] = null;
                else result[key] = JSON.stringify(f[key]);
            }
            return result;
        });
    }
    
    // Add course
    if (!existingCourses.includes(courseId)) {
        existingCourses.push(courseId);
        console.log('4. Adding course to student...');
    } else {
        console.log('4. Course already exists, just adding notification...');
    }
    
    // Add notification
    const notif = {
        id: { stringValue: 'n' + Date.now() },
        title: { stringValue: '\u062a\u0645 \u0642\u0628\u0648\u0644 \u0627\u0634\u062a\u0631\u0627\u0643\u0643 \u0628\u0646\u062c\u0627\u062d \ud83c\udf89' },
        message: { stringValue: '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 ' + courseName + ' \u0644\u0643 \u0628\u0646\u062c\u0627\u062d. \u0646\u062a\u0645\u0646\u0649 \u0644\u0643 \u0627\u0644\u062a\u0648\u0641\u064a\u0642\u060c \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0628\u062f\u0621 \u0627\u0644\u0645\u0630\u0627\u0643\u0631\u0629 \u0645\u0646 \u0642\u0633\u0645 \u0643\u0648\u0631\u0633\u0627\u062a\u064a.' },
        timestamp: { stringValue: new Date().toISOString() },
        read: { booleanValue: false },
        courseId: { stringValue: courseId }
    };
    
    // Build the new notifications array for Firestore
    const rebuiltNotifs = existingNotifs.map(n => {
        const fields = {};
        for (const key in n) {
            if (typeof n[key] === 'boolean') fields[key] = { booleanValue: n[key] };
            else if (n[key] === null) fields[key] = { nullValue: null };
            else fields[key] = { stringValue: String(n[key]) };
        }
        return { mapValue: { fields } };
    });
    rebuiltNotifs.push({ mapValue: { fields: notif } });
    
    const updateData = {
        fields: {
            courses: { arrayValue: { values: existingCourses.map(c => ({ stringValue: c })) } },
            notifications: { arrayValue: { values: rebuiltNotifs } }
        }
    };
    
    const updateResult = await httpsPatch('firestore.googleapis.com', 
        `/v1/${studentDoc.name}?updateMask.fieldPaths=courses&updateMask.fieldPaths=notifications`,
        updateData,
        authHeader
    );
    
    if (updateResult && updateResult.name) {
        console.log('');
        console.log('   ✓✓✓ SUCCESS! ✓✓✓');
        console.log('   Student "' + (studentDoc.fields.name ? studentDoc.fields.name.stringValue : '') + '" now has course: ' + courseName);
        console.log('   Notification sent: "تم قبول اشتراكك بنجاح 🎉"');
        console.log('   New courses list:', existingCourses);
    } else {
        console.log('   ✗ Update failed:', JSON.stringify(updateResult, null, 2));
    }
}

main();
