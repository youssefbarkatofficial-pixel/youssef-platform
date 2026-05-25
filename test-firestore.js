const https = require('https');

const url = "https://firestore.googleapis.com/v1/projects/youssefbarakatplatform-8abff/databases/(default)/documents/debug_test?key=AIzaSyCT05MbiNBz15USSAPzqx1xxdIiDxykvHs";

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
    });
}).on('error', err => {
    console.error('Error:', err.message);
});
