// إدارة واسترجاع كلمات مرور الطلاب للأدمن مع التوافق مع المنصة القديمة والمستندات التوأم sync_*
export function getStoredAdminPassword(phoneOrId?: string): string | null {
  if (!phoneOrId || typeof window === 'undefined') return null;
  const key = `yb_student_pwd_${phoneOrId.trim()}`;
  try {
    const direct = localStorage.getItem(key);
    if (direct) return direct;

    // توافق مع المنصة القديمة (strictUsers / cached_students)
    const strictUsersRaw = localStorage.getItem('strictUsers');
    if (strictUsersRaw) {
      try {
        const list = JSON.parse(strictUsersRaw);
        if (Array.isArray(list)) {
          const found = list.find(
            (u) =>
              (u.phone && String(u.phone).trim() === phoneOrId.trim()) ||
              (u.id && String(u.id).trim() === phoneOrId.trim()) ||
              (u.uid && String(u.uid).trim() === phoneOrId.trim()),
          );
          if (found && (found.password || found.plainPassword)) {
            return String(found.password || found.plainPassword);
          }
        }
      } catch {
        // ignore parse error
      }
    }

    const cachedRaw = localStorage.getItem('cached_students');
    if (cachedRaw) {
      try {
        const list = JSON.parse(cachedRaw);
        if (Array.isArray(list)) {
          const found = list.find(
            (u) =>
              (u.phone && String(u.phone).trim() === phoneOrId.trim()) ||
              (u.id && String(u.id).trim() === phoneOrId.trim()),
          );
          if (found && (found.password || found.plainPassword)) {
            return String(found.password || found.plainPassword);
          }
        }
      } catch {
        // ignore parse error
      }
    }
  } catch {
    // localStorage may be disabled or restricted
  }
  return null;
}

export function setStoredAdminPassword(phoneOrId: string, newPassword: string, studentPhone?: string): void {
  if (typeof window === 'undefined' || !newPassword) return;
  try {
    if (phoneOrId) {
      localStorage.setItem(`yb_student_pwd_${phoneOrId.trim()}`, newPassword);
    }
    if (studentPhone && studentPhone !== phoneOrId) {
      localStorage.setItem(`yb_student_pwd_${studentPhone.trim()}`, newPassword);
    }

    // مزامنة مع strictUsers القديم إن وُجد للحفاظ على التوافق الكامل
    const strictUsersRaw = localStorage.getItem('strictUsers');
    if (strictUsersRaw) {
      try {
        const list = JSON.parse(strictUsersRaw);
        if (Array.isArray(list)) {
          let updated = false;
          const mapped = list.map((u) => {
            if (
              (u.phone && studentPhone && String(u.phone).trim() === studentPhone.trim()) ||
              (u.id && String(u.id).trim() === phoneOrId.trim())
            ) {
              updated = true;
              return { ...u, password: newPassword, plainPassword: newPassword };
            }
            return u;
          });
          if (updated) {
            localStorage.setItem('strictUsers', JSON.stringify(mapped));
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

/** فحص هل قام الطالب بإعادة تعيين كلمة المرور الإلزامية */
export function isPasswordResetDone(studentIdOrPhone?: string): boolean {
  if (!studentIdOrPhone || typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`yb_pwd_reset_done_${studentIdOrPhone.trim()}`) === 'true';
  } catch {
    return false;
  }
}

/** تسجيل إتمام الطالب لإعادة تعيين كلمة المرور */
export function markPasswordResetDone(studentIdOrPhone: string): void {
  if (!studentIdOrPhone || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`yb_pwd_reset_done_${studentIdOrPhone.trim()}`, 'true');
  } catch {
    // ignore
  }
}

/**
 * استخراج كلمة المرور الحقيقية للطالب.
 * لا نعيد رقم هاتف الطالب أبداً كبديل لكلمة المرور.
 * إن لم تكن معروفة بعد، نعيد null ليظهر في الجدول أنها بانتظار التجديد الإجباري.
 */
export function resolveStudentPassword(student: {
  id?: string;
  phone?: string;
  plainPassword?: string;
}): string | null {
  // 1. فحص أي كلمة مرور مسجلة محلياً أو معدلة من الأدمن أو المستعادة
  const adminOverride =
    getStoredAdminPassword(student.id) || (student.phone ? getStoredAdminPassword(student.phone) : null);
  if (adminOverride) return adminOverride;

  // 2. كلمة المرور المسجلة (plainPassword) سواء من مستند الطالب أو المستند التوأم sync_*
  if (student.plainPassword && student.plainPassword !== 'مخفية') {
    return student.plainPassword;
  }

  // إذا لم تكن كلمة المرور مسجلة بعد، لا نضع رقم الهاتف! نعيد null ليعرض النظام أنها بانتظار التجديد
  return null;
}
