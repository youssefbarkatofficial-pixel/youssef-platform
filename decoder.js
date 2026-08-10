const fs = require('fs');
const iconv = require('iconv-lite');

// Let's decode a specific file as a test
const file = 'index.html';
const rawBuffer = fs.readFileSync(file);
let utf8String = rawBuffer.toString('utf8');

// The file currently contains 'ط§ظ„ط¯ط±ط§ط³ط§طھ' which is UTF-8 Mojibake for Windows-1256.
// To fix this, we need to find all these Mojibake sequences and convert them back.
// The string was parsed as Windows-1256, encoded as UTF-8.
// To reverse: read the UTF-8 string into a binary buffer (latin1), then decode as Windows-1256.

// Let's test if this reverses it
function fixMojibake(text) {
    try {
        // Convert the utf-8 mojibake string to a raw byte buffer (treating each char as 1 byte)
        const buf = Buffer.from(text, 'latin1');
        // Decode those bytes as windows-1256
        return iconv.decode(buf, 'win1256');
    } catch (e) {
        return text;
    }
}

// Since the file has a mix of normal english (ASCII) and Mojibake, 
// fixing the whole string might work if it was purely encoded wrongly.
// Let's test a slice
const sample = utf8String.substring(utf8String.indexOf('ط§ظ„ط¯ط±ط§ط³ط§طھ'), utf8String.indexOf('ط§ظ„ط¯ط±ط§ط³ط§طھ') + 50);
console.log('Original Sample:', sample);
console.log('Fixed Sample:', fixMojibake(sample));

// Actually, the whole file was probably saved as UTF-8 containing these sequences.
// If we run the whole file through fixMojibake, will it break valid UTF-8?
// Yes, valid UTF-8 (if any exists) will get broken.
// Let's check if the whole file is pure ASCII + Mojibake.
const fullFix = fixMojibake(utf8String);
if (fullFix.includes('يوسف')) { // if it successfully decodes to Arabic 'يوسف'
    console.log('Full fix successful!');
    // overwrite file
    fs.writeFileSync(file, fullFix, 'utf8');
} else {
    console.log('Full fix failed to produce valid Arabic.');
}
