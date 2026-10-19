/**
 * bot.ts
 * واجهة الاتصال بين تطبيق المنصة (v2-app) وخادم بوت البوصلة (Cloudflare Worker)
 * ملاحظة أمان: لا توجد أي مفاتيح سرية في الكود، والاتصال يتم حصرياً عبر Firebase ID Token للمستخدم المسجل.
 */

export interface BotChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  lessonTitles?: string[];
  logId?: string;
  rating?: 1 | -1 | null;
  ratingLoading?: boolean;
  error?: boolean;
  source?: 'direct' | 'cache' | 'learned' | 'llm' | 'teacher';
}

export interface SendChatParams {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ChatResponseData {
  reply: string;
  source: 'direct' | 'cache' | 'learned' | 'llm' | 'teacher';
  remaining: number;
  lessonTitles?: string[];
  logId: string;
  cpuMs?: number;
}

export interface UsageResponseData {
  remaining: number;
  dailyLimit: number;
  paused?: boolean;
}

export interface ChatUpdateItem {
  id: string;
  source: string;
  reply: string;
  created_at: number;
}

export interface ChatUpdatesResponse {
  paused: boolean;
  updates: ChatUpdateItem[];
}

// ---------------- Admin Interfaces ----------------

export interface AdminConversationItem {
  student_uid: string;
  bot_paused: number;
  admin_active: number;
  last_student_message_at: number | null;
  last_admin_message_at: number | null;
  last_activity_at: number;
  unread_for_admin: number;
  last_user_message: string | null;
  last_bot_reply: string | null;
  last_source: string | null;
}

export interface AdminChatMessage {
  id: string;
  student_uid: string;
  user_message: string;
  bot_reply: string;
  source: string;
  cpu_ms: number;
  rating: number | null;
  created_at: number;
}

export interface AdminConversationDetails {
  messages: AdminChatMessage[];
  state: {
    bot_paused: number;
    admin_active: number;
    unread_for_admin: number;
  };
}

export interface AdminStatsData {
  todayMessages: number;
  todayStudents: number;
  totalMessages: number;
  thumbsUp: number;
  thumbsDown: number;
  avgCpuMs: number;
  pausedConversations: number;
}

export interface AdminNegativeFeedbackItem {
  id: string;
  student_uid: string;
  user_message: string;
  bot_reply: string;
  source: string;
  cpu_ms: number;
  created_at: number;
}

export interface AdminSelfLearningItem {
  id: string;
  text: string;
  keywords: string;
  grade: string;
  unit: string;
  subject: string;
  status: string;
  created_at: number;
}

export interface GetAdminSelfLearningParams {
  page?: number;
  limit?: number;
  status?: string;
  grade?: string;
}

export interface AdminSelfLearningResponse {
  items: AdminSelfLearningItem[];
  total: number;
  limit: number;
  offset: number;
  grades?: string[];
}

export interface AdminLearnedAnswerItem {
  id: string;
  question: string;
  question_norm: string;
  answer: string;
  created_at: number;
  updated_at: number;
}

export interface AdminLessonItem {
  id: string;
  title: string;
  subject: string;
  grade: string;
  unit: string;
  archived: number;
  created_at: number;
  chunks_count: number;
}

export interface CreateAdminLessonParams {
  title: string;
  subject?: string;
  grade?: string;
  unit?: string;
  content: string;
}

// ---------------- Config ----------------

const DEFAULT_BOT_URL = 'https://bot-worker.youssefbarkatofficial.workers.dev';

export function getBotBaseUrl(): string {
  const url = import.meta.env.VITE_BOT_URL || DEFAULT_BOT_URL;
  return url.replace(/\/+$/, '');
}

export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem('yb_visitor_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('yb_visitor_device_id', id);
    }
    return id;
  } catch {
    return 'dev_ephemeral_' + Date.now();
  }
}

// ---------------- Student API ----------------

/**
 * إرسال رسالة شات جديدة للبوت
 */
export async function sendMessageToBot(
  token?: string | null,
  params: SendChatParams = { message: '' },
): Promise<ChatResponseData> {
  const baseUrl = getBotBaseUrl();
  const deviceId = getOrCreateDeviceId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-device-id': deviceId,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
  } catch {
    if (!navigator.onLine) {
      throw new Error('لا يوجد اتصال بالإنترنت، يُرجى التحقق من الشبكة والمحاولة مجددًا.');
    }
    throw new Error('تعذر الاتصال بخادم البوصلة، يُرجى التحقق من اتصالك بالإنترنت والمحاولة مجددًا.');
  }

  if (!response.ok) {
    let errorMsg = '';
    try {
      const data = await response.json();
      errorMsg = data?.error || '';
    } catch {
      // Ignored
    }

    if (response.status === 401) {
      throw new Error(errorMsg || 'انتهت صلاحية تسجيل الدخول، يُرجى تسجيل الدخول مجددًا.');
    }
    if (response.status === 429) {
      throw new Error(
        errorMsg || 'استراحة قصيرة، ارجع بعد شوية',
      );
    }
    if (response.status === 503 || response.status >= 500) {
      throw new Error(
        errorMsg || 'نظام البوصلة غير متاح حاليًا أو تحت الصيانة، يُرجى المحاولة بعد قليل.',
      );
    }
    throw new Error(errorMsg || `حدث خطأ أثناء معالجة الطلب (${response.status})`);
  }

  return response.json();
}

/**
 * إرسال تقييم رد البوت (👍 إعجاب / 👎 عدم إعجاب)
 */
export async function sendFeedback(
  token: string,
  logId: string,
  rating: 1 | -1,
): Promise<void> {
  const baseUrl = getBotBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ logId, rating }),
    });
  } catch {
    throw new Error('فشل إرسال التقييم بسبب مشكلة في الاتصال.');
  }

  if (!response.ok) {
    let errorMsg = '';
    try {
      const data = await response.json();
      errorMsg = data?.error;
    } catch {
      // Ignored
    }
    throw new Error(errorMsg || 'تعذر إرسال التقييم حاليًا.');
  }
}

/**
 * جلب الرصيد اليومي المتبقي للطالب وحالة الإيقاف
 */
export async function getBotUsage(token: string): Promise<UsageResponseData> {
  const baseUrl = getBotBaseUrl();

  const response = await fetch(`${baseUrl}/usage`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('تعذر جلب بيانات الرصيد اليومي');
  }

  return response.json();
}

/**
 * استطلاع تحديثات وردود المعلم المباشرة للطالب (Polling)
 */
export async function getChatUpdates(
  token: string,
  since: number,
): Promise<ChatUpdatesResponse> {
  const baseUrl = getBotBaseUrl();

  const response = await fetch(`${baseUrl}/chat/updates?since=${since}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('تعذر جلب تحديثات المحادثة');
  }

  return response.json();
}

// ---------------- Admin API ----------------

/**
 * جلب إحصائيات البوت للمالك
 */
export async function getAdminStats(token: string): Promise<AdminStatsData> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر جلب إحصائيات البوت');
  return res.json();
}

/**
 * جلب قائمة المحادثات الحية
 */
export async function getAdminConversations(token: string): Promise<AdminConversationItem[]> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر جلب المحادثات الحية');
  const data = await res.json();
  return data.conversations || [];
}

/**
 * جلب تفاصيل ورسائل محادثة طالب معينة
 */
export async function getAdminConversationMessages(
  token: string,
  uid: string,
): Promise<AdminConversationDetails> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/conversations/${encodeURIComponent(uid)}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر جلب رسائل المحادثة');
  return res.json();
}

/**
 * إيقاف البوت لمحادثة الطالب ليجيب المعلم بنفسه
 */
export async function pauseAdminConversation(
  token: string,
  uid: string,
): Promise<{ success: boolean; bot_paused: boolean }> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/conversations/${encodeURIComponent(uid)}/pause`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر إيقاف البوت');
  return res.json();
}

/**
 * استئناف البوت لمحادثة الطالب
 */
export async function resumeAdminConversation(
  token: string,
  uid: string,
): Promise<{ success: boolean; bot_paused: boolean }> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/conversations/${encodeURIComponent(uid)}/resume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر استئناف البوت');
  return res.json();
}

/**
 * إرسال رد المعلم المباشر للطالب
 */
export async function sendTeacherReply(
  token: string,
  uid: string,
  reply: string,
): Promise<{ success: boolean; logId: string }> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/conversations/${encodeURIComponent(uid)}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reply }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'تعذر إرسال رد المعلم');
  }
  return res.json();
}

/**
 * جلب إعدادات ومواعيد البوت
 */
export async function getAdminSettings(token: string): Promise<Record<string, string>> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر جلب الإعدادات');
  const data = await res.json();
  return data.settings || {};
}

/**
 * حفظ وتحديث إعدادات ومواعيد البوت
 */
export async function updateAdminSettings(
  token: string,
  settings: Record<string, string>,
): Promise<void> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ settings }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'تعذر حفظ الإعدادات');
  }
}

/**
 * جلب الملاحظات والردود السلبية التي قيّمها الطلاب بـ 👎
 */
export async function getAdminNegativeFeedback(
  token: string,
): Promise<AdminNegativeFeedbackItem[]> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/feedback/negative`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر جلب الملاحظات السلبية');
  const data = await res.json();
  return data.negativeFeedback || [];
}

/**
 * إضافة إجابة معتمدة إلى قاعدة بيانات البوت (learned_answers)
 */
export async function addLearnedAnswer(
  token: string,
  question: string,
  answer: string,
): Promise<{ success: boolean; id: string }> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/learned`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, answer }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'تعذر حفظ الإجابة المعتمدة');
  }
  return res.json();
}

/**
 * جلب قائمة الإجابات المعتمدة
 */
export async function getAdminLearnedAnswers(
  token: string,
): Promise<AdminLearnedAnswerItem[]> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/learned`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر جلب الإجابات المعتمدة');
  const data = await res.json();
  return data.learned || [];
}

/**
 * جلب قائمة أسئلة التعلم الذاتي المعلقة للمراجعة مع ترقيم وفلاتر من السيرفر
 */
export async function getAdminSelfLearning(
  token: string,
  params?: GetAdminSelfLearningParams,
): Promise<AdminSelfLearningResponse> {
  const baseUrl = getBotBaseUrl();
  const query = new URLSearchParams();
  const limit = params?.limit || 15;
  const page = params?.page || 1;
  const offset = (page - 1) * limit;

  query.set('limit', String(limit));
  query.set('offset', String(offset));
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params?.grade && params.grade !== 'all') {
    query.set('grade', params.grade);
  }

  const res = await fetch(`${baseUrl}/admin/self-learning?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر جلب أسئلة التعلم الذاتي');
  return res.json();
}

/**
 * اعتماد سؤال تعلم ذاتي مع إمكانية كتابة أو تعديل الإجابة
 */
export async function approveAdminSelfLearning(
  token: string,
  id: string,
  answer?: string,
): Promise<void> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/self-learning/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ answer: answer || '' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'تعذر اعتماد السؤال');
  }
}

/**
 * رفض سؤال تعلم ذاتي
 */
export async function rejectAdminSelfLearning(
  token: string,
  id: string,
): Promise<void> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/self-learning/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر رفض السؤال');
}

/**
 * جلب قائمة الدروس ومقاطعها وحالة الأرشفة
 */
export async function getAdminLessons(token: string): Promise<AdminLessonItem[]> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/lessons`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('تعذر جلب قائمة الدروس');
  const data = await res.json();
  return data.lessons || [];
}

/**
 * إنشاء درس جديد وتقطيعه إلى مقاطع RAG (بحد أقصى 50 ألف حرف)
 */
export async function createAdminLesson(
  token: string,
  params: CreateAdminLessonParams,
): Promise<{ success: boolean; lessonId: string; chunksCreated: number }> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/lessons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'تعذر رفع الدرس');
  }
  return res.json();
}

/**
 * أرشفة أو إلغاء أرشفة درس (لا حذف نهائي)
 */
export async function toggleArchiveAdminLesson(
  token: string,
  lessonId: string,
  archived: boolean,
): Promise<{ success: boolean; lessonId: string; archived: boolean }> {
  const baseUrl = getBotBaseUrl();
  const res = await fetch(`${baseUrl}/admin/lessons/${encodeURIComponent(lessonId)}/archive`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ archived }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'تعذر تغيير حالة أرشفة الدرس');
  }
  return res.json();
}

