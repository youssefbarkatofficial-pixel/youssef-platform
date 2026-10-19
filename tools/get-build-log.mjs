import fs from 'fs';

const config = fs.readFileSync('C:/Users/mohammed/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const token = config.match(/oauth_token\s*=\s*"([^"]+)"/)[1];

async function getLogLines() {
  const dRes = await fetch('https://api.cloudflare.com/client/v4/accounts/07ba1709fc85915f811c97f8269ae394/pages/projects/youssefbarakat/deployments/18f72079-2f7f-4981-8186-6b7c595d979d/history/logs', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await dRes.json();
  const logs = data.result?.data || [];
  for (let i = 0; i < Math.min(logs.length, 50); i++) {
    console.log(`[${i}] ${logs[i].line}`);
  }
}

getLogLines();
