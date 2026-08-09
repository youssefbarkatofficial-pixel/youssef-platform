const fs = require('fs');
let content = fs.readFileSync('course-details.html', 'utf-8');

const anchor1 = '<meta name="robots" content="index, follow">';
const anchor2 = '                    if (metaDesc && c.desc) metaDesc.setAttribute(\'content\', c.desc);';

const pos1 = content.indexOf(anchor1);
const pos2 = content.indexOf(anchor2);

if (pos1 !== -1 && pos2 !== -1 && pos1 < pos2) {
    const missingContent = `
    <link rel="canonical" href="https://youssefbarakat.pages.dev/course-details.html" />
    
    <!-- Open Graph (Social Media) -->
    <meta property="og:title" content="تفاصيل الكورس | منصة يوسف بركات للدراسات الاجتماعية">
    <meta property="og:description" content="تعرف على تفاصيل كورس الدراسات الاجتماعية مع مستر يوسف بركات.">
    <meta property="og:type" content="article">
    <meta property="og:locale" content="ar_EG">
    <meta property="og:url" content="https://youssefbarakat.pages.dev/course-details.html">
    <!-- Performance: Preconnect to external resources -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdnjs.cloudflare.com">
    <link rel="preconnect" href="https://www.gstatic.com">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/style.css?v=1785347365036">
    <link rel="stylesheet" href="css/mobile.css?v=3">
    <link rel="stylesheet" href="css/courses.css">
    <link rel="stylesheet" href="css/auth.css">
    <!-- Dynamic SEO title/OG per course -->
    <script>
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
    </script>
`;

    // Wait, the anchor2 is part of what we want to replace or keep?
    // In our new block, we ALREADY included the logic up to `} catch(e) {} })(); </script>`
    // The current file has:
    /*
    <meta name="robots" content="index, follow">
                    if (metaDesc && c.desc) metaDesc.setAttribute('content', c.desc);
                }
            }
        } catch(e) {}
    })();
    </script>
    */
    // We should replace from anchor1 to the end of the script tag!
    
    const endScript = '    </script>';
    const posEnd = content.indexOf(endScript, pos2);
    
    if (posEnd !== -1) {
        const toReplace = content.substring(pos1 + anchor1.length, posEnd + endScript.length);
        content = content.replace(toReplace, missingContent);
        fs.writeFileSync('course-details.html', content, 'utf-8');
        console.log('Restored and updated SEO script');
    } else {
        console.log('End script not found');
    }
} else {
    console.log('Anchors not found');
}
