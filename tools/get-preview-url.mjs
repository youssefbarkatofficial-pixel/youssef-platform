import fs from 'node:fs';

const accountId = '07ba1709fc85915f811c97f8269ae394';
const project = 'youssefbarakat';
const tomlPath = 'C:\\Users\\mohammed\\AppData\\Roaming\\xdg.config\\.wrangler\\config\\default.toml';
const content = fs.readFileSync(tomlPath, 'utf8');
const token = content.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments/6759cafc-c968-4242-8a5c-7b75b32cd48c`, {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
console.log('Preview URL:', data.result?.url);
console.log('Aliases:', data.result?.aliases);
console.log('Environment:', data.result?.environment);
console.log('Stage Status:', data.result?.latest_stage?.status);
