// Remembers, on the student's device, which courses he was allowed to open the
// last time the SERVER confirmed it. Used only to decide whether to show cached
// content while offline. It is a convenience gate, not security: real access
// control stays in Firestore rules / the server data.
//
// Rules while offline:
//  - same user as the one who was verified
//  - last server verification is not older than OFFLINE_GRACE_MS
//  - the course subscription had not expired (or has no expiry)
//  - device clock was not turned back
const KEY = 'bp_entitlements_v1';
const SEEN_KEY = 'bp_last_seen_v1';
export const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CourseEntitlement {
  /** epoch ms, or null if the access never expires */
  expiresAt: number | null;
}
interface Snapshot {
  uid: string;
  verifiedAt: number;
  courses: Record<string, CourseEntitlement>;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function read(): Snapshot | null {
  try {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

/** Call ONLY with data confirmed by the server (snapshot.metadata.fromCache === false). */
export function saveEntitlements(uid: string, courses: Record<string, CourseEntitlement>): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    const now = Date.now();
    const snap: Snapshot = { uid, verifiedAt: now, courses };
    storage.setItem(KEY, JSON.stringify(snap));
    storage.setItem(SEEN_KEY, String(now));
  } catch {
    /* storage full / blocked: offline gate just stays closed */
  }
}

export function clearEntitlements(): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(KEY);
    storage.removeItem(SEEN_KEY);
  } catch {
    /* ignore */
  }
}

export function canAccessCourseOffline(uid: string, courseId: string, now = Date.now()): boolean {
  const storage = getStorage();
  const snap = read();
  if (!snap || snap.uid !== uid) return false;

  // clock rolled back by more than 5 minutes -> deny
  const lastSeen = storage ? Number(storage.getItem(SEEN_KEY) || 0) : 0;
  if (lastSeen && now < lastSeen - 5 * 60 * 1000) return false;
  try {
    storage?.setItem(SEEN_KEY, String(Math.max(now, lastSeen)));
  } catch {
    /* ignore */
  }

  if (now - snap.verifiedAt > OFFLINE_GRACE_MS) return false;
  const c = snap.courses[courseId];
  if (!c) return false;
  return c.expiresAt === null || c.expiresAt > now;
}
