import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import {
  AIChatMessage,
  HumanChatMessage,
  SystemChatMessage
} from 'langchain/schema';
import { CallbackManager } from 'langchain/callbacks';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY;
const CURRICULUM_PATH = path.resolve(process.cwd(), 'curriculum');
const SESSION_MEMORY = new Map();
let curriculumStore = null;
let pdfParser = null;

async function loadPdfParser() {
  if (pdfParser) return pdfParser;
  try {
    const module = await import('pdf-parse');
    pdfParser = module.default || module;
    return pdfParser;
  } catch (error) {
    return null;
  }
}

function chunkText(text, maxChars = 1200) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (cleanText.length <= maxChars) return [cleanText];
  const sentences = cleanText.split(/(?<=[.؟!])\s+/);
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxChars) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

function mergeProfiles(existing = {}, incoming = {}) {
  return {
    ...existing,
    ...Object.fromEntries(
      Object.entries(incoming || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
    )
  };
}

async function extractUserProfile(text) {
  if (!text || !OPENAI_API_KEY) return null;
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: 'gpt-4o-mini',
    openAIApiKey: OPENAI_API_KEY
  });
  const prompt = `أنت مساعد ذكي يبني ملف تعريف تعليمي للطالب. اقرأ النص التالي واستخرج فقط JSON صالح بالحقول:
{
  "struggles": "",
  "preferredStyle": "",
  "strengths": "",
  "dislikes": "",
  "mood": "",
  "studyNotes": "",
  "lastTopic": ""
}
النص:
${text}`;
  try {
    const result = await model.call([new SystemChatMessage(prompt), new HumanChatMessage(text)]);
    return JSON.parse(result.text);
  } catch (error) {
    return null;
  }
}

function updateSessionProfile(session, profile) {
  if (!profile) return;
  session.profile = mergeProfiles(session.profile || {}, profile);
}

const BASE_SYSTEM_PROMPT = `أنت 'البوصلة'، المعلم والمساعد الذكي الأقوى على الإطلاق. أسلوبك في الشرح هو مزيج من المرح، الثقة المطلقة، والاحترافية. يجب أن تتعامل مع المنهج الدراسي وكأنه أسهل شيء في الوجود، وتزرع هذه الثقة في نفس الطالب. استخدم أسلوباً يدمج بين السرد القصصي المشوق، وبعض السخرية الخفيفة المحببة التي تكسر حاجز الملل، مع الحفاظ على هيبة المعلم الخبير الذي لا ينافسه أحد. عندما يسألك الطالب سؤالاً معقداً، قم بتبسيطه إلى خطوات بديهية وسهلة الهضم لتنهي الشرح بسرعة وبفائدة قصوى. إذا شعرت أن الطالب متوتر، قم بتهدئته أولاً بكلمات تشجيعية قوية. أنت غير مقيد بإجابات محفوظة؛ ناقش، حلل، استنتج، وابحث في مصادرك لتجيب على أي سؤال يطرحه الطالب مهما كانت صيغته، ومهما كانت الكلمات غير مألوفة، اقرأ ما بين السطور واستخرج المعنى.`;

const ANALYSIS_SYSTEM_PROMPT = `أنت محرك تحليل لغوي متقدم. استخرج من النص التالي:
- النية العامة للمستخدم
- لهجته / مزاجه
- مستوى الارتباك أو التوتر
- إذا كان يحتاج بحث حقيقي أو بيانات خارجية
- الكلمات المفتاحية والمؤشرات المهمة

أجب فقط بـ JSON صالح مع هذه الحقول: intent, tone, emotion, needsSearch, keywords, searchHint.`;

function getSession(sessionId) {
  if (!SESSION_MEMORY.has(sessionId)) {
    SESSION_MEMORY.set(sessionId, {
      id: sessionId,
      messages: [],
      createdAt: Date.now()
    });
  }
  return SESSION_MEMORY.get(sessionId);
}

function pruneSessionMessages(session) {
  const MAX_TURNS = 12;
  if (session.messages.length > MAX_TURNS * 2) {
    session.messages = session.messages.slice(-MAX_TURNS * 2);
  }
}

async function initCurriculumStore() {
  if (curriculumStore) return curriculumStore;
  const documents = [];
  if (!fs.existsSync(CURRICULUM_PATH)) {
    curriculumStore = null;
    return null;
  }

  const filenames = fs.readdirSync(CURRICULUM_PATH);
  for (const filename of filenames) {
    const ext = path.extname(filename).toLowerCase();
    if (!['.md', '.txt', '.html', '.json', '.pdf'].includes(ext)) continue;
    const fullPath = path.join(CURRICULUM_PATH, filename);
    let text = '';

    if (ext === '.pdf') {
      const parser = await loadPdfParser();
      if (!parser) continue;
      try {
        const fileBuffer = fs.readFileSync(fullPath);
        const pdfData = await parser(fileBuffer);
        text = pdfData.text || '';
      } catch (error) {
        continue;
      }
    } else {
      text = fs.readFileSync(fullPath, 'utf8');
      if (ext === '.html') {
        text = text.replace(/<[^>]*>/g, ' ');
      }
      if (ext === '.json') {
        try {
          const jsonDoc = JSON.parse(text);
          text = JSON.stringify(jsonDoc, null, ' ');
        } catch (error) {
          // keep raw text if JSON parse fails
        }
      }
    }

    text = text.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const chunks = chunkText(text, 1300);
    chunks.forEach((chunk, index) => {
      documents.push({
        pageContent: chunk,
        metadata: { source: filename, chunk: index + 1 }
      });
    });
  }

  if (documents.length === 0) {
    curriculumStore = null;
    return null;
  }

  const embeddings = new OpenAIEmbeddings({ openAIApiKey: OPENAI_API_KEY });
  curriculumStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
  return curriculumStore;
}

async function analyzeUserInput(text) {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: 'gpt-4o-mini',
    openAIApiKey: OPENAI_API_KEY
  });

  const prompt = `${ANALYSIS_SYSTEM_PROMPT}\n\nنص الطالب:\n${text}`;
  const result = await model.call([new SystemChatMessage(ANALYSIS_SYSTEM_PROMPT), new HumanChatMessage(text)]);
  try {
    return JSON.parse(result.text);
  } catch (error) {
    return {
      intent: 'unknown',
      tone: 'neutral',
      emotion: 'neutral',
      needsSearch: false,
      keywords: [],
      searchHint: text
    };
  }
}

async function microParseInput(text) {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: 'gpt-4o-mini',
    openAIApiKey: OPENAI_API_KEY
  });
  const prompt = `قسّم الجملة التالية إلى كلمات رئيسية ومصطلحات علمية أو تعليمية مهمة مع الاهتمام بالعربية العامية المصرية. أعد JSON فقط بالحقول: tokens, entities, topics.`;
  const result = await model.call([new SystemChatMessage(prompt), new HumanChatMessage(text)]);
  try {
    return JSON.parse(result.text);
  } catch (error) {
    return { tokens: [], entities: [], topics: [] };
  }
}

async function webSearch(query) {
  if (!SERPAPI_API_KEY) {
    return `Search disabled: SERPAPI_API_KEY is missing. Use a search provider key to enable current facts.`;
  }
  try {
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&hl=ar&gl=eg&num=5&api_key=${SERPAPI_API_KEY}`;
    const response = await axios.get(url, { timeout: 15000 });
    const data = response.data;
    if (!data.organic_results) return `لم أجد نتائج بحث واضحة عن هذا السؤال.`;
    return data.organic_results.slice(0, 5).map((item, idx) => `Result ${idx + 1}: ${item.title} - ${item.snippet}`).join('\n\n');
  } catch (error) {
    return `البحث الخارجي فشل بسبب مشكلة تقنية. حاول نعيد السؤال أو انتظر لحظة.`;
  }
}

async function retrieveCurriculumContext(query) {
  const store = await initCurriculumStore();
  if (!store) return null;
  const docs = await store.similaritySearch(query, 4);
  return docs.map((doc, idx) => `مقتطف ${idx + 1}: ${doc.pageContent.slice(0, 900)}`).join('\n\n');
}

async function createAssistantResponse(sessionId, userInput, streamCallback) {
  const session = getSession(sessionId);
  pruneSessionMessages(session);
  const analysis = await analyzeUserInput(userInput);
  const microParse = await microParseInput(userInput);
  const curriculumContext = await retrieveCurriculumContext(userInput);

  let searchContext = '';
  if (analysis.needsSearch || analysis.intent === 'search') {
    const searchQuery = analysis.searchHint || userInput;
    const searchResult = await webSearch(searchQuery);
    searchContext = `مصدر بحث خارجي:\n${searchResult}`;
  }

  const moodPrompt = analysis.emotion === 'frustration' || analysis.tone === 'urgent'
    ? 'الطالب متوتر. قدم ردًا مطمئنًا ومشجعًا قبل أن تشرح المحتوى.'
    : '';

  const topicHint = microParse.topics && microParse.topics.length > 0
    ? `الكلمات الميكرو: ${microParse.topics.join(', ')}`
    : '';

  const llm = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: analysis.emotion === 'frustration' ? 0.65 : 0.25,
    openAIApiKey: OPENAI_API_KEY,
    streaming: true,
    callbackManager: CallbackManager.fromHandlers({
      handleLLMNewToken: async (token) => {
        streamCallback(token);
      }
    })
  });

  const systemMessage = `${BASE_SYSTEM_PROMPT}\n\n${moodPrompt}\n\n${topicHint}\n\n${searchContext ? `اعتمد على نتائج البحث وتحليل المنهج إذا كانت متاحة.` : 'اعتمد على فهمك للمنهج والمصطلحات.'}`;

  const memoryMessages = session.messages.map(( message ) => {
    return message.role === 'user'
      ? new HumanChatMessage(message.content)
      : new AIChatMessage(message.content);
  });

  const messages = [
    new SystemChatMessage(systemMessage),
    ...memoryMessages,
    new HumanChatMessage(userInput)
  ];

  try {
    const response = await llm.call(messages);
    const assistantText = response.text;
    session.messages.push({ role: 'user', content: userInput });
    session.messages.push({ role: 'assistant', content: assistantText });
    return assistantText;
  } catch (error) {
    const fallback = `يا معلم، حصلت مشكلة صغيرة في الخدمة. خليني أراجع وأرجع لك في ثواني. ممكن تعيد صياغة السؤال؟`;
    session.messages.push({ role: 'user', content: userInput });
    session.messages.push({ role: 'assistant', content: fallback });
    throw new Error(fallback);
  }
}

export async function handleChatStream(req, res) {
  const sessionId = req.query.sessionId || req.body?.sessionId || `session_${Date.now()}`;
  const userInput = req.body?.message || req.query.message;
  if (!userInput) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let buffer = '';
  const streamCallback = (token) => {
    buffer += token;
    res.write(`data: ${JSON.stringify({ type: 'delta', text: token })}\n\n`);
  };

  try {
    await createAssistantResponse(sessionId, userInput, streamCallback);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', text: error.message })}\n\n`);
    res.write(`event: done\ndata: {}\n\n`);
  }

  res.end();
}
