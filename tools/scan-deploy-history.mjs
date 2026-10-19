import fs from 'fs';
import readline from 'readline';

async function scanLogs() {
  const fileStream = fs.createReadStream('C:/Users/mohammed/.gemini/antigravity/brain/1d6c450a-94c1-4c40-b814-bff021014ff4/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const deployCommands = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const toolCalls = entry.tool_calls || [];
      for (const tc of toolCalls) {
        if (tc.name === 'run_command') {
          const cmd = tc.arguments?.CommandLine || '';
          if (cmd.includes('deploy') || cmd.includes('firebase') || cmd.includes('wrangler') || cmd.includes('push') || cmd.includes('build')) {
            deployCommands.push({
              time: entry.created_at,
              cmd: cmd.slice(0, 160),
              cwd: tc.arguments?.Cwd
            });
          }
        }
      }
    } catch (e) {}
  }

  console.log('Total matching commands found in transcript:', deployCommands.length);
  deployCommands.forEach((c, idx) => {
    console.log(`[${idx + 1}] ${c.time} | ${c.cmd}`);
  });
}

scanLogs().catch(console.error);
