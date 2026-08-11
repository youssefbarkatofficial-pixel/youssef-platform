const fs = require('fs');

let authJs = fs.readFileSync('js/auth.js', 'utf8');

if (!authJs.includes("checkId === 'mariamassistant@gmail.com'")) {
    const replacement = `
        // ASSISTANT DASHBOARD BYPASS
        if (checkId === 'mariamassistant@gmail.com' && pwd === '01023675235') {
            const assistantAdmin = {
                id: 'admin_assistant_001',
                name: 'مريم عباس (مساعدة)',
                email: 'mariamassistant@gmail.com',
                password: '01023675235',
                role: 'assistant'
            };
            
            try {
                sessionStorage.setItem('currentAdmin', JSON.stringify(assistantAdmin));
            } catch(e) {}
            
            if (rememberMe) {
                try { localStorage.setItem('rememberedCredentials', JSON.stringify({ phone: rawId, pwd })); } catch(e){}
                try { localStorage.setItem('currentAdmin', JSON.stringify(assistantAdmin)); } catch(e){}
            } else {
                localStorage.removeItem('rememberedCredentials');
            }
            
            if (window.showToast) window.showToast('أهلاً بكِ أستاذة مريم في لوحة التحكم.', 'success', { title: 'مرحباً', duration: 1500 });
            setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 1500);
            return;
        }
        
        // ADMIN DASHBOARD BYPASS`;
        
    authJs = authJs.replace('// ADMIN DASHBOARD BYPASS', replacement);
    fs.writeFileSync('js/auth.js', authJs, 'utf8');
    console.log('Fixed auth.js for assistant');
}
