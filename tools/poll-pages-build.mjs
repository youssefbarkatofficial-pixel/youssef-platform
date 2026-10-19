import fs from 'fs';

const config = fs.readFileSync('C:/Users/mohammed/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const match = config.match(/oauth_token\s*=\s*"([^"]+)"/);
const token = match[1];

async function pollDeployment() {
  const res = await fetch('https://api.cloudflare.com/client/v4/accounts/07ba1709fc85915f811c97f8269ae394/pages/projects/youssefbarakat/deployments', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const latest = data.result?.[0];
  if (!latest) {
    console.log('No deployments found');
    return;
  }
  console.log(`Latest Deployment: ${latest.id}`);
  console.log(`Commit: ${latest.deployment_trigger?.metadata?.commit_hash?.substring(0, 7)} - "${latest.deployment_trigger?.metadata?.commit_message}"`);
  console.log(`Status: ${latest.latest_stage?.status} (Stage: ${latest.latest_stage?.name})`);
  console.log(`URL: ${latest.url}`);
}

pollDeployment();
