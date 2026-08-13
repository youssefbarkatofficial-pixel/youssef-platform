
        window.addEventListener('load', () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('open')) {
                const openId = urlParams.get('open');
                setTimeout(() => {
                    const btn = document.querySelector(`a[data-item-id="${openId}"]`);
                    if (btn) {
                        btn.click();
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 800);
            }
        });
    