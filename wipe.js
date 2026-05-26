const projectId = 'youssefbarakatplatform-8abff';
const baseUrl = https://firestore.googleapis.com/v1/projects/+projectId+/databases/(default)/documents;

async function deleteCollection(collectionId) {
    const res = await fetch(baseUrl + '/' + collectionId);
    if (!res.ok) {
        console.log(Failed to fetch );
        return;
    }
    const data = await res.json();
    if (!data.documents) {
        console.log(Collection  is empty.);
        return;
    }
    for (let doc of data.documents) {
        const docName = doc.name; // full path
        const delRes = await fetch(https://firestore.googleapis.com/v1/ + docName, { method: 'DELETE' });
        if (delRes.ok) {
            console.log(Deleted );
        } else {
            console.log(Failed to delete );
        }
    }
}

async function run() {
    console.log('Wiping students...');
    await deleteCollection('students');
    console.log('Wiping paymentRequests...');
    await deleteCollection('paymentRequests');
    console.log('Wiping compassChat...');
    await deleteCollection('compassChat');
    console.log('Done!');
}
run();