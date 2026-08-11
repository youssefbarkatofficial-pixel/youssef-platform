const fs = require('fs');

// 1. Update index.html
let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(
    /<img loading="lazy" id="navLogoImg" src=".*?"\s*style="display:none;/g,
    '<img loading="lazy" id="navLogoImg" src="images/logo.png?v=4"\n                    style="display:block;'
);
// Make sure the span is hidden
indexHtml = indexHtml.replace('<span id="navLogoText">ي</span>', '<span id="navLogoText" style="display:none;">ي</span>');
fs.writeFileSync('index.html', indexHtml, 'utf8');

// 2. Update js/owner-editor.js to NOT override navLogoImg with base64
let ownerJs = fs.readFileSync('js/owner-editor.js', 'utf8');
ownerJs = ownerJs.replace(
    /\} else if \(key === 'ownerNavLogoImage'\) \{[\s\S]*?\} else if \(key === 'ownerFeaturesLogoImage'\)/m,
    `} else if (key === 'ownerFeaturesLogoImage')`
);
fs.writeFileSync('js/owner-editor.js', ownerJs, 'utf8');

console.log('Fixed navbar logo to always use images/logo.png');
