export const onRequestPost: PagesFunction = async (context) => {
  const targetUrl = 'https://bot-worker.youssefbarkatofficial.workers.dev/chat';
  const newReq = new Request(targetUrl, {
    method: 'POST',
    headers: context.request.headers,
    body: context.request.body
  });
  return fetch(newReq);
};

export const onRequestOptions: PagesFunction = async (context) => {
  const targetUrl = 'https://bot-worker.youssefbarkatofficial.workers.dev/chat';
  const newReq = new Request(targetUrl, {
    method: 'OPTIONS',
    headers: context.request.headers
  });
  return fetch(newReq);
};
