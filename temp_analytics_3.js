
    document.addEventListener('DOMContentLoaded', () => {
        const adminStr = sessionStorage.getItem('currentAdmin');
        if (adminStr) {
            try {
                const adm = JSON.parse(adminStr);
                if (adm.role === 'assistant') {
                    setInterval(() => {
                        document.querySelectorAll('.btn-danger, [onclick*="delete"], [onclick*="remove"], [onclick*="wipe"]').forEach(btn => {
                            if (!btn.classList.contains('assistant-allowed')) {
                                btn.style.display = 'none';
                            }
                        });
                    }, 1000);
                }
            } catch(e) {}
        }
    });
    