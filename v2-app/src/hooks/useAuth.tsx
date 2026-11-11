import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { clearEntitlements, saveEntitlements } from '../lib/entitlementCache';
import type { CourseEntitlement } from '../lib/entitlementCache';
import { extractStudentCourseGrant } from '../lib/subscriptions';
import { purgeExpiredOrForeignVideoCaches } from '../lib/videoCache';
import { getAdminRole } from '../services/admins';
import type { AdminRole } from '../services/admins';
import { invalidateCoursesCache } from '../services/courses';
import { getStudent, subscribeStudent } from '../services/students';
import type { Student } from '../services/students';
import { flushPendingWatchQueue } from '../services/watchProgress';

interface AuthContextValue {
  firebaseUser: User | null;
  student: Student | null;
  isAdmin: boolean;
  adminRole: AdminRole | null;
  // المالك أو الأدمن الكامل (ليس المساعد)
  isSeniorAdmin: boolean;
  loading: boolean;
  profileError: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface StudentResult {
  value: Student | null;
  failed: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  // آخر طلب تحميل فقط هو الذي يُعتمد، حتى لا تكتب نتيجة قديمة فوق نتيجة أحدث.
  const requestId = useRef(0);

  const loadProfile = useCallback(async (user: User) => {
    requestId.current += 1;
    const currentId = requestId.current;

    const [admin, studentResult] = await Promise.all([
      getAdminRole(user.email),
      getStudent(user.uid)
        .then((value): StudentResult => ({ value, failed: false }))
        .catch((): StudentResult => ({ value: null, failed: true })),
    ]);

    if (currentId !== requestId.current) return;

    setAdminRole(admin);
    setStudent(studentResult.value);
    setProfileError(studentResult.failed && admin === null);
    setLoading(false);
  }, []);

  useEffect(() => {
    let unsubStudent: (() => void) | null = null;
    let removeOnlineListener: (() => void) | null = null;

    const cleanupUserListeners = () => {
      if (unsubStudent) {
        unsubStudent();
        unsubStudent = null;
      }
      if (removeOnlineListener) {
        removeOnlineListener();
        removeOnlineListener = null;
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      cleanupUserListeners();

      if (!user) {
        clearEntitlements();
        requestId.current += 1;
        setFirebaseUser(null);
        setStudent(null);
        setAdminRole(null);
        setProfileError(false);
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      setLoading(true);
      void loadProfile(user);
      void purgeExpiredOrForeignVideoCaches(user.uid);

      // تحديث لحظي لملف الطالب واشتراكاته فور حدوث أي تغيير أو عودة الإنترنت دون إعادة تشغيل
      unsubStudent = subscribeStudent(user.uid, (nextStudent, meta) => {
        if (!nextStudent) return;
        // حفظ بوابة الصلاحيات الأوفلاين فقط عند تأكيد البيانات من السيرفر (fromCache === false)
        if (!meta.fromCache) {
          const entitlements: Record<string, CourseEntitlement> = {};
          if (!nextStudent.archived) {
            nextStudent.courses.forEach((cid) => {
              const grant = extractStudentCourseGrant(nextStudent, cid);
              entitlements[cid] = {
                expiresAt: grant && grant.expiresAt > 0 ? grant.expiresAt : null,
              };
            });
            Object.entries(nextStudent.accessGrants || {}).forEach(([cid, grant]) => {
              if (!grant) return;
              entitlements[cid] = {
                expiresAt:
                  grant.type === 'full_term' || !grant.expiresAt || grant.expiresAt <= 0
                    ? null
                    : grant.expiresAt,
              };
            });
          }
          saveEntitlements(nextStudent.id, entitlements);
        }
        setStudent((prev) => ({
          ...nextStudent,
          plainPassword: nextStudent.plainPassword || prev?.plainPassword,
        }));
        setProfileError(false);
        setLoading(false);
        void purgeExpiredOrForeignVideoCaches(user.uid);
      });

      const handleOnline = () => {
        invalidateCoursesCache();
        void flushPendingWatchQueue(user.uid);
        void loadProfile(user);
      };
      if (typeof window !== 'undefined') {
        window.addEventListener('online', handleOnline);
        removeOnlineListener = () => window.removeEventListener('online', handleOnline);
      }
    });

    return () => {
      cleanupUserListeners();
      unsubscribeAuth();
    };
  }, [loadProfile]);

  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      await loadProfile(user);
    }
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      firebaseUser,
      student,
      isAdmin: adminRole !== null,
      adminRole,
      isSeniorAdmin: adminRole === 'owner' || adminRole === 'admin',
      loading,
      profileError,
      refresh,
    }),
    [firebaseUser, student, adminRole, loading, profileError, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider');
  }
  return context;
}
