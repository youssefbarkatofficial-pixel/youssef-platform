import fs from 'fs';

const config = fs.readFileSync('C:/Users/mohammed/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const match = config.match(/oauth_token\s*=\s*"([^"]+)"/);
if (!match) {
  console.log('No oauth_token found');
  process.exit(1);
}
const token = match[1];
const accountId = '07ba1709fc85915f811c97f8269ae394';
const projectName = 'youssefbarakat';

async function diagnose() {
  console.log('================ 1.b: BUILD SETTINGS & PROJECT CONFIG ================');
  const projRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const projData = await projRes.json();
  if (!projData.success) {
    console.error('Failed to get project:', projData.errors);
    return;
  }

  const proj = projData.result;
  console.log('Project Name:', proj.name);
  console.log('Production Branch:', proj.production_branch);
  console.log('Root Directory:', proj.build_config?.root_dir || '(root - not set)');
  console.log('Build Command:', proj.build_config?.build_command || '(not set)');
  console.log('Output Directory (Destination):', proj.build_config?.destination_dir || '(not set)');
  console.log('Production Script Name / Web Analytics:', proj.build_config?.web_analytics_tag);
  console.log('Source Type:', proj.source?.type, `(owner: ${proj.source?.config?.owner}, repo: ${proj.source?.config?.repo_name})`);
  console.log('Latest Deployment ID on Project:', proj.latest_deployment?.id);

  console.log('\n================ 1.a: LAST 10 DEPLOYMENTS ================');
  const depRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=15`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const depData = await depRes.json();
  if (!depData.success) {
    console.error('Failed to get deployments:', depData.errors);
    return;
  }

  const deployments = depData.result || [];
  console.log(`Found ${deployments.length} deployments. Listing last 10:\n`);

  deployments.slice(0, 10).forEach((d, idx) => {
    const isProd = d.environment === 'production';
    const commitHash = d.deployment_trigger?.metadata?.commit_hash?.slice(0, 7) || 'N/A';
    const commitMsg = (d.deployment_trigger?.metadata?.commit_message || '').split('\n')[0].slice(0, 50);
    const branch = d.deployment_trigger?.metadata?.branch || d.source?.config?.deployments_enabled === false ? 'Direct Upload' : (d.deployment_trigger?.metadata?.branch || 'N/A');
    const triggerType = d.deployment_trigger?.type || 'direct_upload'; // e.g. github, direct_upload
    const created = d.created_on;
    const isAliasesActive = (proj.canonical_deployment?.id === d.id) || (proj.latest_deployment?.id === d.id && isProd);

    console.log(`[${idx + 1}] ID: ${d.id}`);
    console.log(`    Status: ${d.latest_stage?.status} (${d.latest_stage?.name}) | Env: ${d.environment} ${isAliasesActive ? '★ ACTIVE LIVE PRODUCTION ★' : ''}`);
    console.log(`    Source/Trigger: ${triggerType} | Branch: ${branch} | Commit: ${commitHash} ("${commitMsg}")`);
    console.log(`    URL: ${d.url}`);
    console.log(`    Aliases: ${JSON.stringify(d.aliases || [])}`);
    console.log(`    Created: ${created}`);
    console.log('----------------------------------------------------');
  });

  console.log('\nCanonical Live Deployment:', proj.canonical_deployment?.id, proj.canonical_deployment?.url);
}

diagnose().catch(console.error);
