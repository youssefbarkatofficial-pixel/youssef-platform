import fs from 'fs';

const config = fs.readFileSync('C:/Users/mohammed/AppData/Roaming/xdg.config/.wrangler/config/default.toml', 'utf8');
const match = config.match(/oauth_token\s*=\s*"([^"]+)"/);
const token = match[1];

const envVars = {
  VITE_FIREBASE_API_KEY: { value: 'AIzaSyCT05MbiNBz15USSAPzqx1xxdIiDxykvHs' },
  VITE_FIREBASE_AUTH_DOMAIN: { value: 'youssefbarakatplatform-8abff.firebaseapp.com' },
  VITE_FIREBASE_PROJECT_ID: { value: 'youssefbarakatplatform-8abff' },
  VITE_FIREBASE_STORAGE_BUCKET: { value: 'youssefbarakatplatform-8abff.firebasestorage.app' },
  VITE_FIREBASE_MESSAGING_SENDER_ID: { value: '861961495531' },
  VITE_FIREBASE_APP_ID: { value: '1:861961495531:web:303098945fd4bdbf0eefae' },
  VITE_CLIENT_GRADING_FALLBACK: { value: 'true' },
  VITE_BOT_URL: { value: 'https://bot-worker.youssefbarkatofficial.workers.dev' }
};

async function updateProject() {
  console.log('--- تحديث إعدادات Cloudflare Pages عبر API ---');
  const res = await fetch('https://api.cloudflare.com/client/v4/accounts/07ba1709fc85915f811c97f8269ae394/pages/projects/youssefbarakat', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      build_config: {
        build_command: 'npm run build',
        destination_dir: 'dist',
        root_dir: 'v2-app'
      },
      deployment_configs: {
        production: {
          env_vars: envVars
        },
        preview: {
          env_vars: envVars
        }
      }
    })
  });

  const data = await res.json();
  console.log('Update success:', data.success);
  if (data.result) {
    console.log('New Build Config:', data.result.build_config);
    console.log('Env vars configured:', Object.keys(data.result.deployment_configs?.production?.env_vars || {}));
  } else {
    console.log('Errors:', data.errors);
  }
}

updateProject();
