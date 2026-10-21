export const onRequestGet: PagesFunction = async (context) => {
  const targetUrl = 'https://bot-worker.youssefbarkatofficial.workers.dev/usage';
  const newReq = new Request(targetUrl, {
    method: 'GET',
    headers: context.request.headers
  });
  return fetch(newReq);
};
