export interface Env {
  DB: D1Database;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CORS_ORIGIN?: string;
  FIREBASE_PROJECT_ID: string;
  GROQ_PRIMARY_MODEL?: string;
  GROQ_FAST_MODEL?: string;
  OWNER_EMAIL?: string;
  ENVIRONMENT?: string;
}

export interface StudentProfile {
  uid: string;
  name: string;
  firstName: string;
  grade: string;
  courses: string[];
  archived: boolean;
  email?: string;
}

export interface AdminProfile {
  email: string;
  role: string;
  isOwner: boolean;
  name?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  examActive?: boolean;
}

export interface ChatResponse {
  reply: string;
  source: 'intent' | 'cache' | 'llm_groq' | 'llm_gemini' | 'system_override' | 'fallback' | 'direct' | 'teacher';
  remaining: number;
  lessonTitles?: string[];
  logId?: string;
  cpuMs?: number;
  paused?: boolean;
}

export interface LessonChunk {
  id: string;
  lesson_id?: string;
  lesson_title?: string;
  text: string;
  keywords: string[];
  grade?: string;
  unit?: string;
  subject?: string;
  created_at: number;
}
