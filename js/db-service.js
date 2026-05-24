/**
 * Platform Hybrid Database Service
 * Temporarily uses localStorage, prepared for future Firebase migration.
 * 
 * ENHANCED: Supports AI Learning System (Admin Teaching & Dynamic Content)
 */
window.PlatformDB = {
    // Database Logic Interface
    db: {
        get(path) {
            return JSON.parse(localStorage.getItem(path) || 'null');
        },
        set(path, data) {
            localStorage.setItem(path, JSON.stringify(data));
        },
        update(path, newData) {
            const existing = this.get(path) || {};
            this.set(path, { ...existing, ...newData });
        },
        delete(path) {
            localStorage.removeItem(path);
        }
    },
    // Authentication Logic Interface
    auth: {
        getCurrentUser() {
            return JSON.parse(sessionStorage.getItem('currentStudent') || sessionStorage.getItem('currentAdmin') || 'null');
        },
        login(user, role = 'student') {
            if (role === 'admin') sessionStorage.setItem('currentAdmin', JSON.stringify(user));
            else sessionStorage.setItem('currentStudent', JSON.stringify(user));
        },
        logout() {
            sessionStorage.removeItem('currentStudent');
            sessionStorage.removeItem('currentAdmin');
            localStorage.removeItem('currentStudent');
            localStorage.removeItem('currentAdmin');
        }
    },
    // Storage Logic Interface (Images, Files)
    storage: {
        async uploadBase64(path, base64String) {
            // Currently just saves base64 string to localStorage.
            // Future Firebase: upload base64 to Storage, get download URL.
            localStorage.setItem(`storage_${path}`, base64String);
            return base64String;
        },
        get(path) {
            return localStorage.getItem(`storage_${path}`);
        }
    },
    
    // BACKUP SYSTEM (Admin Tools)
    backup: {
        exportData() {
            try {
                const data = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    data[key] = localStorage.getItem(key);
                }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `platform_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return true;
            } catch (e) {
                console.error("Backup export failed", e);
                return false;
            }
        },
        importData(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                for (let key in data) {
                    localStorage.setItem(key, data[key]);
                }
                return true;
            } catch (e) {
                console.error("Backup import failed", e);
                return false;
            }
        }
    },

    // ==================================================
    // AI LEARNING SYSTEM (New in v2.0)
    // ==================================================
    aiLearning: {
        // Get admin learning data
        getAdminLearning() {
            try {
                return JSON.parse(localStorage.getItem('pf_admin_learning_v1') || '{}');
            } catch (e) {
                console.error("Failed to load admin learning", e);
                return {};
            }
        },
        
        // Save admin learning data
        saveAdminLearning(data) {
            try {
                localStorage.setItem('pf_admin_learning_v1', JSON.stringify(data));
                return true;
            } catch (e) {
                console.error("Failed to save admin learning", e);
                return false;
            }
        },
        
        // Get AI training data
        getTraining() {
            try {
                return JSON.parse(localStorage.getItem('pf_ai_training_v1') || '{}');
            } catch (e) {
                console.error("Failed to load training", e);
                return {};
            }
        },
        
        // Get platform content analysis
        getPlatformContent() {
            try {
                return JSON.parse(localStorage.getItem('pf_platform_content_v1') || '{}');
            } catch (e) {
                console.error("Failed to load platform content", e);
                return {};
            }
        },
        
        // Save platform content
        savePlatformContent(data) {
            try {
                localStorage.setItem('pf_platform_content_v1', JSON.stringify(data));
                return true;
            } catch (e) {
                console.error("Failed to save platform content", e);
                return false;
            }
        },
        
        // Get learning statistics
        getStats() {
            const training = this.getTraining();
            const adminLearned = this.getAdminLearning();
            const platformContent = this.getPlatformContent();
            
            return {
                trainedResponses: Object.keys(training).length,
                adminLearnedResponses: Object.keys(adminLearned).length,
                platformContentItems: Object.keys(platformContent).length,
                totalLearning: Object.keys(training).length + Object.keys(adminLearned).length,
                lastUpdated: {
                    trained: Math.max(...Object.values(training).map(r => r.last || 0)),
                    adminLearned: Math.max(...Object.values(adminLearned).map(r => r.learned || 0))
                }
            };
        },
        
        // Clear all AI learning (admin reset)
        clearAllLearning() {
            try {
                localStorage.removeItem('pf_ai_training_v1');
                localStorage.removeItem('pf_admin_learning_v1');
                localStorage.removeItem('pf_platform_content_v1');
                return true;
            } catch (e) {
                console.error("Failed to clear learning", e);
                return false;
            }
        },
        
        // Export learning data for backup
        exportLearning() {
            const data = {
                training: this.getTraining(),
                adminLearned: this.getAdminLearning(),
                platformContent: this.getPlatformContent(),
                exportDate: new Date().toISOString()
            };
            return JSON.stringify(data, null, 2);
        },
        
        // Import learning data from backup
        importLearning(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                if (data.training) this.getTraining() && localStorage.setItem('pf_ai_training_v1', JSON.stringify(data.training));
                if (data.adminLearned) this.saveAdminLearning(data.adminLearned);
                if (data.platformContent) this.savePlatformContent(data.platformContent);
                return true;
            } catch (e) {
                console.error("Failed to import learning", e);
                return false;
            }
        }
    }
};

