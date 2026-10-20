import fs from 'node:fs';

const accountId = '07ba1709fc85915f811c97f8269ae394';
const project = 'youssefbarakat';
const tomlPath = 'C:\\Users\\mohammed\\AppData\\Roaming\\xdg.config\\.wrangler\\config\\default.toml';
const content = fs.readFileSync(tomlPath, 'utf8');
const token = content.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments?per_page=5`, {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();
console.log('Success:', data.success, 'Errors:', data.errors);
if (data.result) {
  console.log(JSON.stringify(data.result.map((d) => ({
    id: d.id,
    branch: d.deployment_trigger?.metadata?.branch,
    commit: d.deployment_trigger?.metadata?.commit_hash?.slice(0, 7),
    status: d.latest_stage?.status,
    url: d.url,
    aliases: d.aliases,
    environment: d.environment,
    created: d.created_on
  })), null, 2));
} else {
  console.log('Full response:', data);
}
