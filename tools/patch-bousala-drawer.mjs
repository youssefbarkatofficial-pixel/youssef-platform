import fs from 'fs';

let drawer = fs.readFileSync('v2-app/src/components/student/BousalaChatDrawer.tsx', 'utf8');

// Ensure import auth
if (!drawer.includes("import { auth } from '../../lib/firebase';")) {
  drawer = drawer.replace("import { useAuth } from '../../hooks/useAuth';", "import { useAuth } from '../../hooks/useAuth';\nimport { auth } from '../../lib/firebase';");
}

const oldSendBlock = `    try {
      const token = firebaseUser ? await firebaseUser.getIdToken() : null;

      // تجهيز سجل المحادثة (بحد أقصى آخر 12 رسالة) بدون رسائل الخطأ
      const history = updatedMessages
        .slice(-12)
        .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role, content: m.content }));

      const data = await sendMessageToBot(token, {
        message: rawText,
        history,
      });

      // إذا رد الخادم برسالة انتظار المعلم
      if (data.reply.includes('بنراجع سؤالك ونرد عليك')) {
        setIsPaused(true);
      }

      const botReplyMsg: BotChatMessage = {
        id: \`bot_\${Date.now()}\`,
        role: 'assistant',
        content: data.reply,
        createdAt: Date.now(),
        lessonTitles: data.lessonTitles,
        logId: data.logId,
        source: data.source,
      };

      setMessages((prev) => [...prev, botReplyMsg]);
    } catch (err: any) {
      const rawMessage = (err?.message || '').toLowerCase();
      let categorizedError = '';

      if (
        rawMessage.includes('429') ||
        rawMessage.includes('رصيد') ||
        rawMessage.includes('استراحة') ||
        rawMessage.includes('استنفدت')
      ) {
        categorizedError = 'استراحة قصيرة، ارجع بعد شوية 🧭';
      } else if (
        rawMessage.includes('401') ||
        rawMessage.includes('صلاحية') ||
        rawMessage.includes('تسجيل الدخول') ||
        rawMessage.includes('token')
      ) {
        categorizedError = 'انتهت صلاحية تسجيل الدخول، يُرجى تسجيل الدخول مجددًا لمواصلة المحادثة.';
      } else if (
        rawMessage.includes('اتصال') ||
        rawMessage.includes('شبكة') ||
        rawMessage.includes('failed to fetch') ||
        rawMessage.includes('network') ||
        rawMessage.includes('cors') ||
        rawMessage.includes('typeerror')
      ) {
        categorizedError = 'تعذر الاتصال بالشبكة، يُرجى التحقق من اتصالك بالإنترنت والمحاولة مجددًا.';
      } else if (
        rawMessage.includes('500') ||
        rawMessage.includes('502') ||
        rawMessage.includes('503') ||
        rawMessage.includes('صيانة') ||
        rawMessage.includes('سيرفر') ||
        rawMessage.includes('خادم')
      ) {
        categorizedError = 'خادم البوصلة غير متاح حاليًا أو يخضع للصيانة الدورية، يُرجى المحاولة بعد قليل.';
      } else if (err?.message) {
        categorizedError = err.message;
      } else {
        categorizedError = 'حدث خطأ أثناء معالجة السؤال، يُرجى المحاولة مجددًا.';
      }`;

const newSendBlock = `    try {
      const currentUser = auth.currentUser || firebaseUser;
      let token = currentUser ? await currentUser.getIdToken() : null;

      // تجهيز سجل المحادثة (بحد أقصى آخر 12 رسالة) بدون رسائل الخطأ
      const history = updatedMessages
        .slice(-12)
        .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role, content: m.content }));

      let data: any = null;
      try {
        data = await sendMessageToBot(token, {
          message: rawText,
          history,
        });
      } catch (firstErr: any) {
        const is401 = firstErr?.status === 401 || (firstErr?.message || '').includes('401') || (firstErr?.message || '').includes('صلاحية');
        if (is401 && currentUser) {
          // تجديد إجباري للتوكن مرة واحدة فقط وإعادة الطلب
          const fresh = await currentUser.getIdToken(true);
          data = await sendMessageToBot(fresh, {
            message: rawText,
            history,
          });
        } else {
          throw firstErr;
        }
      }

      // إذا رد الخادم برسالة انتظار المعلم
      if (data.reply.includes('بنراجع سؤالك ونرد عليك')) {
        setIsPaused(true);
      }

      const botReplyMsg: BotChatMessage = {
        id: \`bot_\${Date.now()}\`,
        role: 'assistant',
        content: data.reply,
        createdAt: Date.now(),
        lessonTitles: data.lessonTitles,
        logId: data.logId,
        source: data.source,
      };

      setMessages((prev) => [...prev, botReplyMsg]);
    } catch (err: any) {
      const rawMessage = (err?.message || '').toLowerCase();
      const status = err?.status;
      const is401 = status === 401 || rawMessage.includes('401');
      const currentUser = auth.currentUser || firebaseUser;
      let categorizedError = '';

      if (
        status === 429 ||
        rawMessage.includes('429') ||
        rawMessage.includes('رصيد') ||
        rawMessage.includes('استراحة') ||
        rawMessage.includes('استنفدت')
      ) {
        categorizedError = 'استراحة قصيرة، ارجع بعد شوية 🧭';
      } else if (is401) {
        categorizedError = 'انتهت صلاحية تسجيل الدخول، يُرجى تسجيل الدخول مجددًا لمواصلة المحادثة.';
      } else if (currentUser) {
        // لو المستخدم مش null والخطأ مش 401 (مثلًا 404/500/اتصال)
        categorizedError = 'البوصلة مش متاحة حاليًا، جرّب بعد شوية';
      } else if (
        rawMessage.includes('اتصال') ||
        rawMessage.includes('شبكة') ||
        rawMessage.includes('failed to fetch') ||
        rawMessage.includes('network') ||
        rawMessage.includes('cors') ||
        rawMessage.includes('typeerror')
      ) {
        categorizedError = 'تعذر الاتصال بالشبكة، يُرجى التحقق من اتصالك بالإنترنت والمحاولة مجددًا.';
      } else if (err?.message) {
        categorizedError = err.message;
      } else {
        categorizedError = 'البوصلة مش متاحة حاليًا، جرّب بعد شوية';
      }`;

const isCrlf = drawer.includes('\r\n');
const target = isCrlf ? oldSendBlock.replace(/\n/g, '\r\n') : oldSendBlock.replace(/\r\n/g, '\n');
const repl = isCrlf ? newSendBlock.replace(/\n/g, '\r\n') : newSendBlock.replace(/\r\n/g, '\n');

if (drawer.includes(target)) {
  drawer = drawer.replace(target, repl);
  fs.writeFileSync('v2-app/src/components/student/BousalaChatDrawer.tsx', drawer, 'utf8');
  console.log('✔ Successfully patched BousalaChatDrawer.tsx');
} else {
  console.log('Target block not matched in BousalaChatDrawer.tsx');
}
