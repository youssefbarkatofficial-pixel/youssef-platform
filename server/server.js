import express from 'express';
import cors from 'cors';
import { handleChatStream } from './ai-tutor.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.post('/chat/stream', async (req, res) => {
  await handleChatStream(req, res);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'البوصلة AI Tutor' });
});

app.listen(port, () => {
  console.log(`البوصلة AI server running on http://localhost:${port}`);
  console.log('Ensure OPENAI_API_KEY and optionally SERPAPI_API_KEY are set.');
});
