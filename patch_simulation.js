const fs = require('fs');

// Patch js/auth.js to set isStaff
let authJs = fs.readFileSync('js/auth.js', 'utf8');
if (!authJs.includes('slimUser.isStaff = true')) {
    const adminEmails = "['mariamassistant@gmail.com', 'youssefbarakatofficial@gmail.com']";
    authJs = authJs.replace(
        /const slimUser = \{[\s\S]*?\};/m,
        `$&
        // Grant staff privileges to admin/assistant emails
        if (slimUser.email && ${adminEmails}.includes(slimUser.email.toLowerCase())) {
            slimUser.isStaff = true;
        }`
    );
    // Also patch when updating session storage in login success
    authJs = authJs.replace(
        /let slim = \{[\s\S]*?\};/m,
        `$&
        if (slim.email && ${adminEmails}.includes(slim.email.toLowerCase())) {
            slim.isStaff = true;
        }`
    );
    fs.writeFileSync('js/auth.js', authJs, 'utf8');
}

// Patch course-details.html to bypass locks if isStaff or simulationMode
let cdHtml = fs.readFileSync('course-details.html', 'utf8');
if (!cdHtml.includes('if (dbUser.isStaff || (dbUser.simulationMode && !dbUser.simulationRestricted))')) {
    // Look for isEnrolled assignment
    // let isEnrolled = student && student.courses && student.courses.includes(course.id);
    cdHtml = cdHtml.replace(
        /let isEnrolled = student && student\.courses && student\.courses\.includes\(course\.id\);/g,
        `let isEnrolled = student && student.courses && student.courses.includes(course.id);
         if (dbUser && (dbUser.isStaff || (dbUser.simulationMode && !dbUser.simulationRestricted))) {
             isEnrolled = true;
         }`
    );
    
    // Bypass previous exams check or delay
    cdHtml = cdHtml.replace(
        /if \(delayHours > 0 && lastExamTime\)/g,
        `if (dbUser && (dbUser.isStaff || (dbUser.simulationMode && !dbUser.simulationRestricted))) {
            // Bypass delay
        } else if (delayHours > 0 && lastExamTime)`
    );

    cdHtml = cdHtml.replace(
        /if \(exam\.requirePrevious\)/g,
        `if (dbUser && (dbUser.isStaff || (dbUser.simulationMode && !dbUser.simulationRestricted))) {
            // Bypass prerequisites
        } else if (exam.requirePrevious)`
    );
    
    fs.writeFileSync('course-details.html', cdHtml, 'utf8');
}

// Patch admin-dashboard.html to add "Simulation Mode" section
let adminDb = fs.readFileSync('admin-dashboard.html', 'utf8');
if (!adminDb.includes('id="simulationSection"')) {
    const simulationHtml = `
    <!-- Simulation Mode Section -->
    <div class="dashboard-section" id="simulationSection" style="display:none;">
        <div class="section-header">
            <h2><i class="fas fa-mask"></i> وضع التجربة (Simulation Mode)</h2>
            <button class="btn btn-outline" onclick="closeSection('simulationSection')">إغلاق <i class="fas fa-times"></i></button>
        </div>
        <div class="glass-panel">
            <h3 style="margin-bottom:15px; color:var(--royal-gold);">جرب المنصة كطالب</h3>
            <p style="margin-bottom:20px; color:var(--text-secondary); line-height:1.6;">
                يمكنك هنا محاكاة الدخول للمنصة كطالب لاختبار تجربة المستخدم، عملية الدفع، أو حل الامتحانات. سيتم تحويلك إلى واجهة الطلاب ببيانات وهمية. لن يؤثر ذلك على حساب الإدارة الخاص بك.
            </p>
            <div style="display:flex; gap:15px; flex-wrap:wrap;">
                <button class="btn btn-green" onclick="startSimulation(false)">
                    <i class="fas fa-user-graduate"></i> تجربة كطالب جديد (يخضع للقيود والاشتراكات)
                </button>
                <button class="btn btn-gold" onclick="startSimulation(true)">
                    <i class="fas fa-unlock"></i> تجربة كطالب بجميع الصلاحيات (مفتوح بدون قيود)
                </button>
            </div>
            
            <script>
            function startSimulation(unrestricted) {
                const fakeStudent = {
                    uid: 'sim_' + Date.now(),
                    name: 'طالب تحت التجربة',
                    phone: '01000000000',
                    grade: '3',
                    simulationMode: true,
                    simulationRestricted: !unrestricted,
                    courses: unrestricted ? [] : []
                };
                sessionStorage.setItem('currentUser', JSON.stringify(fakeStudent));
                window.open('index.html', '_blank');
            }
            </script>
        </div>
    </div>
    `;
    
    adminDb = adminDb.replace('<!-- End Content -->', simulationHtml + '\n<!-- End Content -->');
    
    // Add button to sidebar
    const sidebarBtnHtml = `
            <a href="#" class="nav-item" onclick="switchSection('simulationSection')">
                <i class="fas fa-mask"></i>
                <span>وضع التجربة</span>
            </a>
    `;
    adminDb = adminDb.replace('<a href="#" class="nav-item" onclick="adminLogout()">', sidebarBtnHtml + '\n            <a href="#" class="nav-item" onclick="adminLogout()">');
    
    fs.writeFileSync('admin-dashboard.html', adminDb, 'utf8');
}

console.log('Fixed staff bypass and simulation mode.');
