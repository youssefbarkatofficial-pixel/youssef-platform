// مستندات طلاب يجب تجاهلها في كل صفحات الأدمن وعمليات المراجعة:
// التوائم القديمة (sync_<رقم الموبايل>) وحساب الدعم (support_000).
// الطلاب الحقيقيون هم مستندات uid فقط.
export function isIgnoredStudentId(id: string): boolean {
  const value = id.trim();
  return value.startsWith('sync_') || value === 'support_000';
}
