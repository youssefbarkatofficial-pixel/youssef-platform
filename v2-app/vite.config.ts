import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/bot': {
        target: 'https://bot-worker.youssefbarkatofficial.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bot/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // مكتبات ثقيلة في ملفات منفصلة تتخزن في كاش المتصفح ولا تتحمل من جديد مع كل تحديث.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
});
