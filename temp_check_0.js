
    (function(){
        try {
            const params = new URLSearchParams(window.location.search);
            const cid = params.get('id');
            if (cid) {
                const courses = JSON.parse(localStorage.getItem('adminCourses') || '[]');
                const c = courses.find(x => x.id === cid);
                if (c && c.title) {
                    document.title = c.title + ' | منصة يوسف بركات للدراسات الاجتماعية';
                    var ogTitle = document.querySelector('meta[property="og:title"]');
                    if (ogTitle) ogTitle.setAttribute('content', c.title + ' | منصة يوسف بركات');
                    var ogDesc = document.querySelector('meta[property="og:description"]');
                    if (ogDesc && c.desc) ogDesc.setAttribute('content', c.desc);
                    var metaDesc = document.querySelector('meta[name="description"]');
                    if (metaDesc && c.desc) metaDesc.setAttribute('content', c.desc);
                    
                    if (c.image && !c.image.startsWith('__local__')) {
                        var ogImage = document.querySelector('meta[property="og:image"]');
                        if (ogImage) {
                            ogImage.setAttribute('content', c.image);
                        } else {
                            var metaImg = document.createElement('meta');
                            metaImg.setAttribute('property', 'og:image');
                            metaImg.setAttribute('content', c.image);
                            document.head.appendChild(metaImg);
                        }
                    }
                }
            }
        } catch(e) {}
    })();
    