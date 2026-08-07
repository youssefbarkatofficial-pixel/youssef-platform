const fs = require('fs');
let code = fs.readFileSync('js/support-chat.js', 'utf8');

// Mock browser objects
global.window = { addEventListener: () => {} };
global.localStorage = {
    getItem: (k) => null,
    setItem: () => {}
};
global.sessionStorage = {
    getItem: (k) => null,
    setItem: () => {}
};
global.console = {
    warn: () => {},
    log: () => {},
    error: () => {}
};
global.document = {
    getElementById: () => null,
    createElement: () => ({ style: {} }),
    head: { appendChild: () => {} }
};

// run script
new Function("window", "localStorage", "sessionStorage", "document", "console", code)(global.window, global.localStorage, global.sessionStorage, global.document, global.console);

if (typeof global.window.askGeminiDirectly !== 'function') {
    process.stdout.write("Error: askGeminiDirectly not bound to window\n");
    process.exit(1);
}

async function run() {
    process.stdout.write("SENDING MESSAGE: 'ما هو منهج الدراسات؟'\n");
    try {
        const res = await global.window.askGeminiDirectly('ما هو منهج الدراسات؟', []);
        process.stdout.write("RESPONSE RECEIVED:\n" + JSON.stringify(res, null, 2) + "\n");
    } catch(e) {
        process.stdout.write("CRASH: " + e.message + "\n");
    }
}

run();
