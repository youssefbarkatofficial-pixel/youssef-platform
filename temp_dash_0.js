
        // Student welcome toast and chime on first dashboard access
        document.addEventListener('DOMContentLoaded', () => {
            try {
                const userStr = sessionStorage.getItem('currentStudent');
                if (!userStr) return;

                if (!sessionStorage.getItem('dashboardVisited')) {
                    sessionStorage.setItem('dashboardVisited', 'true');
                    if (window.audioManager) {
                        if (typeof window.audioManager.playStudentWelcome === 'function') {
                            window.audioManager.playStudentWelcome();
                        } else {
                            window.audioManager.play('welcomeStudent');
                        }
                    }
                }
            } catch (e) {
                console.warn('Dashboard welcome audio error:', e);
            }
        });

        // Sidebar toggle handled by mobile.js
    