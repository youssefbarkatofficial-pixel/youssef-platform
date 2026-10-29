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

export function resolveStudentPassword(student: {
  id?: string;
  phone?: string;
  plainPassword?: string;
}): string {
  // 1. فحص أي تعديل يدوي للأدمن في المتصفح
  const adminOverride =
    getStoredAdminPassword(student.id) || (student.phone ? getStoredAdminPassword(student.phone) : null);
  if (adminOverride) return adminOverride;

  // 2. كلمة المرور المسجلة (plainPassword) سواء من مستند الطالب أو المستند التوأم sync_*
  if (student.plainPassword && student.plainPassword !== 'مخفية') {
    return student.plainPassword;
  }

  // 3. كلمة المرور الافتراضية للطلاب الجدد (رقم الهاتف كما في المنصة الأصلية)
  if (student.phone && student.phone.trim().length > 0) {
    return student.phone.trim();
  }

  return '123456';
}
