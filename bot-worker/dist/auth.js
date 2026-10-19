"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._testInjectToken = _testInjectToken;
exports.verifyFirebaseToken = verifyFirebaseToken;
exports.fetchStudentProfile = fetchStudentProfile;
exports.verifyAdmin = verifyAdmin;
exports.computeVisitorKey = computeVisitorKey;
let jwksCache = null;
const importedCryptoKeys = new Map();
const verifiedTokenCache = new Map();
function _testInjectToken(token, uid, email, env) {
    if (env?.ENVIRONMENT === 'production') {
        throw new Error('_testInjectToken is disabled in production environment');
    }
    verifiedTokenCache.set(token, { uid, email, exp: Math.floor(Date.now() / 1000) + 3600 });
}
// Base64URL decoder
function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    catch {
        throw new Error('Invalid base64url encoding in JWT');
    }
}
function parseJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
    }
    const headerJson = new TextDecoder().decode(base64UrlDecode(parts[0]));
    const payloadJson = new TextDecoder().decode(base64UrlDecode(parts[1]));
    const signature = base64UrlDecode(parts[2]);
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    return {
        header: JSON.parse(headerJson),
        payload: JSON.parse(payloadJson),
        signature,
        signedData
    };
}
async function getGoogleJwks() {
    const now = Date.now();
    if (jwksCache && jwksCache.expiresAt > now) {
        return jwksCache.keys;
    }
    const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if (!res.ok) {
        throw new Error(`Failed to fetch Google JWKS: ${res.status}`);
    }
    const data = await res.json();
    jwksCache = {
        keys: data.keys,
        expiresAt: now + 60 * 60 * 1000 // Cache for 1 hour
    };
    return data.keys;
}
async function verifyFirebaseToken(token, env) {
    const nowSec = Math.floor(Date.now() / 1000);
    // 1. Check in-memory verified cache (disabled in production)
    if (env.ENVIRONMENT !== 'production') {
        const cached = verifiedTokenCache.get(token);
        if (cached) {
            if (cached.exp > nowSec) {
                return { uid: cached.uid, email: cached.email };
            }
            verifiedTokenCache.delete(token);
        }
    }
    // 2. Parse JWT
    const { header, payload, signature, signedData } = parseJwt(token);
    if (header.alg !== 'RS256') {
        throw new Error(`Unsupported JWT algorithm: ${header.alg}`);
    }
    const expectedIssuer = `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`;
    if (payload.iss !== expectedIssuer) {
        throw new Error(`Invalid token issuer: ${payload.iss}`);
    }
    if (payload.aud !== env.FIREBASE_PROJECT_ID) {
        throw new Error(`Invalid token audience: ${payload.aud}`);
    }
    if (payload.exp < nowSec) {
        throw new Error('Token expired');
    }
    if (!payload.sub || typeof payload.sub !== 'string') {
        throw new Error('Token missing sub/uid');
    }
    // 3. Cryptographic Verification
    const jwks = await getGoogleJwks();
    const jwk = jwks.find(k => k.kid === header.kid);
    if (!jwk) {
        throw new Error(`Matching public key kid not found: ${header.kid}`);
    }
    let cryptoKey = importedCryptoKeys.get(header.kid);
    if (!cryptoKey) {
        cryptoKey = await crypto.subtle.importKey('jwk', {
            kty: jwk.kty,
            n: jwk.n,
            e: jwk.e,
            alg: 'RS256',
            ext: true
        }, {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
        }, false, ['verify']);
        importedCryptoKeys.set(header.kid, cryptoKey);
    }
    const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
    if (!isValid) {
        throw new Error('Invalid JWT cryptographic signature');
    }
    // 4. Cache verified result until expiration
    verifiedTokenCache.set(token, {
        uid: payload.sub,
        email: payload.email,
        exp: payload.exp
    });
    return {
        uid: payload.sub,
        email: payload.email
    };
}
// Fetch student profile using student's token
async function fetchStudentProfile(uid, token, env) {
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/students/${uid}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    if (!res.ok) {
        if (res.status === 404) {
            throw new Error('Student record not found in Firestore');
        }
        const errText = await res.text();
        throw new Error(`Firestore read error: ${res.status} ${errText}`);
    }
    const doc = await res.json();
    const fields = doc.fields || {};
    const name = fields.name?.stringValue || 'يا صديقي';
    const firstName = name.trim().split(' ')[0] || 'يا صديقي';
    const grade = fields.grade?.stringValue || '';
    const archived = fields.archived?.booleanValue || false;
    const email = fields.email?.stringValue;
    let courses = [];
    if (fields.courses?.arrayValue?.values) {
        courses = fields.courses.arrayValue.values.map((v) => v.stringValue || '').filter(Boolean);
    }
    if (archived) {
        throw new Error('Student account is archived');
    }
    return {
        uid,
        name,
        firstName,
        grade,
        courses,
        archived,
        email
    };
}
// Fetch admin profile using admin's token
async function verifyAdmin(email, token, env) {
    if (!email) {
        throw new Error('No email found in token for admin verification');
    }
    const lowerEmail = email.toLowerCase().trim();
    const ownerEmail = (env.OWNER_EMAIL || 'youssefbarkatofficial@gmail.com').toLowerCase().trim();
    // If email matches OWNER_EMAIL exactly, grant full owner access immediately without needing a doc in platformAdmins
    if (lowerEmail === ownerEmail) {
        return {
            email: lowerEmail,
            role: 'owner',
            isOwner: true,
            name: 'Owner'
        };
    }
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/platformAdmins/${lowerEmail}`;
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    if (!res.ok) {
        throw new Error('Access denied: You are not in platformAdmins');
    }
    const doc = await res.json();
    const fields = doc.fields || {};
    const role = fields.role?.stringValue || '';
    // Strict check: Assistant is NOT allowed for bot administration
    if (role === 'assistant') {
        throw new Error('Access denied: Assistant admins are not authorized for bot management');
    }
    const isOwner = role === 'owner';
    const name = fields.name?.stringValue || 'Admin';
    return {
        email: lowerEmail,
        role,
        isOwner,
        name
    };
}
/**
 * توليد معرّف مشفر للزائر بناءً على معرّف الجهاز وتجزئة IP مشفرة (بدون حفظ IP خام)
 */
async function computeVisitorKey(request) {
    const deviceId = request.headers.get('x-device-id') || 'dev_guest';
    const rawIp = request.headers.get('CF-Connecting-IP') ||
        request.headers.get('x-forwarded-for') ||
        '127.0.0.1';
    const cleanIp = rawIp.split(',')[0].trim();
    const salt = 'yb_visitor_salt_2026_antigravity';
    const raw = `${deviceId}:${cleanIp}:${salt}`;
    const buffer = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `vis_${hex.slice(0, 16)}`;
}
