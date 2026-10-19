import fs from 'node:fs';

const accountId = '07ba1709fc85915f811c97f8269ae394';
const project = 'youssefbarakat';

// read wrangler token
let token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  try {
    const tomlPath = 'C:\\Users\\mohammed\\AppData\\Roaming\\xdg.config\\.wrangler\\config\\default.toml';
    const content = fs.readFileSync(tomlPath, 'utf8');
    const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
    if (match) token = match[1];
  } catch (e) {}
}

const targetCommit = (process.argv[2] || 'b819cb1').slice(0, 7);

async function main() {
  console.log(`Waiting for Cloudflare Pages deployment of commit ${targetCommit}...`);
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const d = data.result?.[0];
      const commit = d?.deployment_trigger?.metadata?.commit_hash?.slice(0, 7);
      const stage = d?.latest_stage?.name;
      const status = d?.latest_stage?.status;
      console.log(`[${new Date().toISOString()}] #${i+1}: ID=${d?.id} | Stage=${stage} (${status}) | Commit=${commit} | Env=${d?.environment}`);

      if (commit === targetCommit) {
        if (status === 'success' && stage === 'deploy') {
          console.log('\n=== SUCCESS: PRODUCTION DEPLOYMENT FINISHED ===');
          console.log(`Deployment ID: ${d.id}`);
          console.log(`Commit: ${commit}`);
          console.log(`URL: ${d.url}`);
          console.log(`Environment: ${d.environment}`);
          console.log(`Created: ${d.created_on}`);
          return;
        } else if (status === 'failure') {
          console.error(`\n=== FAILED: Deployment failed at stage ${stage} ===`);
          process.exit(1);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err.message);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
}

main();
