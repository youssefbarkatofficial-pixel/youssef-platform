const fs = require('fs');

const f = 'admin-payments.html';
let content = fs.readFileSync(f, 'utf-8');

const old_fetch = `            async function fetchProofImage(req) {
                if (req.proofImageUrl && req.proofImageUrl.startsWith('http')) return req.proofImageUrl;
                if (req.proofImage && req.proofImage.startsWith('data:image')) return req.proofImage;
                
                if (req.proofImageKey) {
                    return new Promise((resolve) => {
                        const request = indexedDB.open('platformPaymentDB', 1);
                        request.onsuccess = function() {
                            const db = request.result;
                            if (!db.objectStoreNames.contains('paymentProofs')) {
                                resolve(null);
                                return;
                            }
                            const tx = db.transaction('paymentProofs', 'readonly');
                            const store = tx.objectStore('paymentProofs');
                            const getReq = store.get(req.proofImageKey);
                            getReq.onsuccess = function() { resolve(getReq.result ? getReq.result.dataUrl : null); };
                            getReq.onerror = function() { resolve(null); };
                        };
                        request.onerror = function() { resolve(null); };
                    });
                }
                return null;
            }`;

const new_fetch = `            async function fetchProofImage(req) {
                if (req.proofImageUrl && req.proofImageUrl.startsWith('http')) return req.proofImageUrl;
                if (req.proofImage && req.proofImage.startsWith('data:image')) return req.proofImage;
                
                if (req.proofImageKey) {
                    try {
                        const img = await new Promise((resolve) => {
                            const request = indexedDB.open('platformPaymentDB', 1);
                            request.onsuccess = function() {
                                const db = request.result;
                                if (!db.objectStoreNames.contains('paymentProofs')) {
                                    resolve(null);
                                    return;
                                }
                                try {
                                    const tx = db.transaction('paymentProofs', 'readonly');
                                    const store = tx.objectStore('paymentProofs');
                                    const getReq = store.get(req.proofImageKey);
                                    getReq.onsuccess = function() { resolve(getReq.result ? getReq.result.dataUrl : null); };
                                    getReq.onerror = function() { resolve(null); };
                                } catch(e) { resolve(null); }
                            };
                            request.onerror = function() { resolve(null); };
                        });
                        if (img) return img;
                    } catch(e) {}
                }
                
                if (window.firebaseDb && req.id) {
                    try {
                        const doc = await window.firebaseDb.collection('paymentRequests').doc(req.id).get();
                        if (doc.exists && doc.data().proofImage) {
                            return doc.data().proofImage;
                        } else if (doc.exists && doc.data().proofImageUrl) {
                            return doc.data().proofImageUrl;
                        }
                    } catch(e) {}
                }
                
                return null;
            }`;

if (content.includes(old_fetch)) {
    content = content.replace(old_fetch, new_fetch);
    fs.writeFileSync(f, content, 'utf-8');
    console.log("Successfully replaced fetchProofImage in admin-payments.html");
} else {
    console.log("Could not find old_fetch block in admin-payments.html");
}
