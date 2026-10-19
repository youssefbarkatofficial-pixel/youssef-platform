import fs from 'fs';

const authExport = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/auth_users_export.json', 'utf8'));
const authUsers = authExport.users || [];

const studentsDoc = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/pre_replacement_backups/firestore_collections/students.json', 'utf8'));

const adminsDoc = JSON.parse(fs.readFileSync('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/pre_replacement_backups/firestore_collections/platformAdmins.json', 'utf8'));

console.log('=== 1. OWNER AUTH CHECK ===');
const ownerEmailTarget = 'youssefbarkatofficial@gmail.com';
const ownerInAdmins = adminsDoc.find(a => a.name.toLowerCase().includes(ownerEmailTarget));
console.log('Owner in platformAdmins doc:', Boolean(ownerInAdmins));
if (ownerInAdmins) {
  console.log('Doc ID matches ownerEmail exactly:', ownerInAdmins.name.endsWith('/' + ownerEmailTarget));
  console.log('Stored role:', ownerInAdmins.fields?.role?.stringValue);
  console.log('Has stored password field in doc:', Boolean(ownerInAdmins.fields?.password?.stringValue));
}

const ownerInAuth = authUsers.find(u => (u.email || '').toLowerCase() === ownerEmailTarget);
console.log('Owner in Firebase Auth:', Boolean(ownerInAuth));
if (ownerInAuth) {
  console.log('Auth UID:', ownerInAuth.localId);
  console.log('Is Disabled:', Boolean(ownerInAuth.disabled));
  console.log('Email verified:', Boolean(ownerInAuth.emailVerified));
  console.log('Provider list:', ownerInAuth.providerUserInfo?.map(p => p.providerId));
  console.log('Last login timestamp:', ownerInAuth.lastLoginAt ? new Date(Number(ownerInAuth.lastLoginAt)).toISOString() : 'Never');
  console.log('Created at timestamp:', ownerInAuth.createdAt ? new Date(Number(ownerInAuth.createdAt)).toISOString() : 'Unknown');
} else {
  // Search for any user with similar email
  const similar = authUsers.filter(u => (u.email || '').includes('youssef') || (u.email || '').includes('barakat'));
  console.log('Similar auth accounts count:', similar.length);
}

console.log('\n=== 2. STATISTICAL AUDIT (NUMBERS ONLY - NO STUDENT PII) ===');
console.log('Total students in Firestore:', studentsDoc.length);
console.log('Total users in Firebase Auth:', authUsers.length);

const authUidSet = new Set(authUsers.map(u => u.localId));
const authEmailMap = new Map(authUsers.map(u => [(u.email || '').toLowerCase(), u]));

let studentsWithoutAuth = 0;
let studentsWithAuth = 0;
let formatIssueCount = 0;
let duplicatePhoneCount = 0;
const seenPhones = new Set();

for (const s of studentsDoc) {
  const docId = s.name.split('/').pop();
  const fields = s.fields || {};
  const phone = fields.phone?.stringValue || '';
  const email = fields.email?.stringValue || '';

  const hasUidAuth = authUidSet.has(docId);
  const syntheticEmail = (phone + '@student.youssefbarakat.com').toLowerCase();
  const hasEmailAuth = authEmailMap.has(email.toLowerCase()) || authEmailMap.has(syntheticEmail);

  if (hasUidAuth || hasEmailAuth) {
    studentsWithAuth++;
  } else {
    studentsWithoutAuth++;
  }

  // Format checks
  if (phone) {
    if (seenPhones.has(phone)) duplicatePhoneCount++;
    seenPhones.add(phone);

    // check if phone contains non-ascii, spaces, arabic numerals, or country code
    if (/[٠-٩]/.test(phone) || /\s/.test(phone) || /^\+/.test(phone) || /^00/.test(phone)) {
      formatIssueCount++;
    }
  }
}

console.log('Students in Firestore WITH matching Auth user:', studentsWithAuth);
console.log('Students in Firestore WITHOUT matching Auth user:', studentsWithoutAuth);

const studentDocIdSet = new Set(studentsDoc.map(s => s.name.split('/').pop()));
let authUsersWithoutStudentDoc = 0;
let authUsersWithStudentDoc = 0;
let disabledAuthCount = 0;

for (const u of authUsers) {
  if (u.disabled) disabledAuthCount++;

  const isStudent = (u.email || '').endsWith('@student.youssefbarakat.com');
  const isAdmin = (u.email || '').includes('@') && !(u.email || '').endsWith('@student.youssefbarakat.com');

  if (studentDocIdSet.has(u.localId)) {
    authUsersWithStudentDoc++;
  } else {
    authUsersWithoutStudentDoc++;
  }
}

console.log('Auth users WITH matching Firestore student doc:', authUsersWithStudentDoc);
console.log('Auth users WITHOUT matching Firestore student doc:', authUsersWithoutStudentDoc);
console.log('Disabled Auth users count:', disabledAuthCount);
console.log('Phone numbers with duplicate occurrences:', duplicatePhoneCount);
console.log('Phone numbers with non-standard format (Arabic numerals/spaces/+20):', formatIssueCount);
