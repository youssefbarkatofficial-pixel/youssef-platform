export const onRequestGet: PagesFunction = async (context) => {
  const targetUrl = 'https://bot-worker.youssefbarkatofficial.workers.dev/health';
  return fetch(targetUrl);
};
