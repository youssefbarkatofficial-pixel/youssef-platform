async function check() {
  const urls = [
    'https://youssefbarakat.pages.dev',
    'https://youssefbarakat.com',
    'https://www.youssefbarakat.com'
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { redirect: 'manual' });
      console.log('========================================');
      console.log('URL:', u);
      console.log('Status:', res.status, res.statusText);
      console.log('Headers:', {
        server: res.headers.get('server'),
        cfRay: res.headers.get('cf-ray'),
        location: res.headers.get('location'),
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
        cacheControl: res.headers.get('cache-control')
      });
      const html = await res.text();
      console.log('Length:', html.length);
      console.log('Title:', html.match(/<title>([^<]+)<\/title>/i)?.[1]);
      const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
      console.log('Scripts:', scripts);
      const isV2 = html.includes('dist/assets') || html.includes('/assets/index') || html.includes('id="root"');
      const isLegacy = html.includes('id="app"') || html.includes('firebase-app.js') || html.includes('auth.js');
      console.log('Markers: isV2 =', isV2, '| isLegacy =', isLegacy);
      console.log('Snippet:', html.slice(0, 400));
    } catch (e) {
      console.error('Error fetching', u, e.message);
    }
  }
}
check();
