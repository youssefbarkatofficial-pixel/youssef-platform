async function verifySW() {
  const urls = [
    'https://youssefbarakat.pages.dev/sw.js',
    'https://03330351.youssefbarakat.pages.dev/sw.js'
  ];
  for (const u of urls) {
    console.log('=== Checking:', u, '===');
    const res = await fetch(u, { cache: 'no-store' });
    console.log('HTTP Status:', res.status);
    console.log('Headers:');
    for (const [k, v] of res.headers.entries()) {
      if (['cache-control', 'content-type', 'service-worker-allowed', 'cf-cache-status', 'last-modified', 'etag'].includes(k)) {
        console.log(`  ${k}: ${v}`);
      }
    }
    const text = await res.text();
    console.log('Content preview:');
    console.log(text.slice(0, 300));
    console.log('Contains kill-switch comments:', text.includes('Kill-switch'));
    console.log('Contains unregister:', text.includes('unregister'));
    console.log('Contains delete cache:', text.includes('caches.delete'));
    console.log('-------------------------------------------');
  }
}
verifySW();
