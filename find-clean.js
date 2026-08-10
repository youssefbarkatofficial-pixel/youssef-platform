const fs = require('fs');
const cp = require('child_process');

// support-chat.js is corrupted with mojibake - restore from last clean git commit
// c8ad44e is the commit where encoding fix was applied - check if it's clean
const commits = ['3adabc7', '930c9c9', '0a2cd4c', 'c8ad44e'];
const supportFiles = ['js/support-chat.js', 'js/support-chat.backup.js', 'js/support-chat.original.js'];

for (const commitHash of commits) {
    try {
        const content = cp.execSync(`git show ${commitHash}:js/support-chat.js`, {encoding: 'buffer'});
        const hasFFfd = content.includes(Buffer.from([0xef, 0xbf, 0xbd]));
        const hasMoji = content.toString('utf8').includes('ط§') || content.toString('utf8').includes('ظ„');
        const hasBad = content.toString('utf8').includes('ط') || content.toString('utf8').includes('ط،');
        console.log(`${commitHash}: FFFD=${hasFFfd} Moji=${hasMoji} Bad=${hasBad}`);
        if (!hasFFfd && !hasMoji) {
            console.log(`  -> CLEAN at ${commitHash}`);
            break;
        }
    } catch(e) {
        console.log(`${commitHash}: NOT FOUND`);
    }
}
