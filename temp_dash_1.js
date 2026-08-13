
        document.addEventListener('DOMContentLoaded', () => {
            const dashGrid = document.querySelector('.dashboard-grid');
            if(false && dashGrid) { // Temporarily hidden
                const gameBanner = document.createElement('div');
                gameBanner.className = 'glass-panel dash-panel';
                gameBanner.style.background = 'linear-gradient(45deg, #0F172A, #000000)';
                gameBanner.style.border = '1px solid #D4AF37';
                gameBanner.style.gridColumn = '1 / -1'; // يأخذ العرض بالكامل
                gameBanner.style.textAlign = 'center';
                gameBanner.style.padding = '30px';
                gameBanner.innerHTML = `
                    <h2 style="color: #D4AF37; margin-bottom: 10px;"><i class="fas fa-compass"></i> صراع البوصلة (تحدي الدراسات)</h2>
                    <p style="color: #94A3B8; margin-bottom: 20px;">ادخل ساحة المعركة واختبر معلوماتك لترفع رتبتك الآن!</p>
                    <button onclick="document.getElementById('gameWidgetModal').style.display='block'; document.body.style.overflow='hidden'; var b=document.getElementById('pfChatBtn'); if(b) b.style.display='none'; var c=document.getElementById('pfChatBubble'); if(c) c.style.display='none';" class="btn" style="background: #D4AF37; color: #000; font-weight: bold; padding: 10px 30px; border-radius: 30px; font-size: 1.1rem; border: none; cursor: pointer;">
                        افتح ويدجت اللعبة ًںڑ€
                    </button>
                `;
                dashGrid.insertBefore(gameBanner, dashGrid.firstChild);
            }
        });
    