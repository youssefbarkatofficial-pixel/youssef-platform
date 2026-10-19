import fs from 'fs';

const config = fs.readFileSync('C:/Users/mohammed/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const match = config.match(/oauth_token\s*=\s*"([^"]+)"/);
if (!match) {
  console.log('No oauth_token found');
  process.exit(1);
}
const token = match[1];

async function checkProject() {
  const res = await fetch('https://api.cloudflare.com/client/v4/accounts/07ba1709fc85915f811c97f8269ae394/pages/projects/youssefbarakat', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Success:', data.success);
  if (data.result) {
    console.log('Name:', data.result.name);
    console.log('Subdomain:', data.result.subdomain);
    console.log('Domains:', data.result.domains);
    console.log('Production Branch:', data.result.production_branch);
    console.log('Build Config:', data.result.build_config);
    console.log('Source:', data.result.source);
  } else {
    console.log('Errors:', data.errors);
  }
}

checkProject();
