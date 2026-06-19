function collectAssetUrls() {
  const urls = new Set(['/']);

  document.querySelectorAll('link[href], script[src], img[src], source[src]').forEach((node) => {
    const candidate = node.getAttribute('href') || node.getAttribute('src');
    if (!candidate) return;
    urls.add(new URL(candidate, window.location.origin).pathname);
  });

  performance.getEntriesByType('resource').forEach((entry) => {
    if (!entry.name.startsWith(window.location.origin)) return;
    urls.add(new URL(entry.name).pathname);
  });

  return Array.from(urls);
}

function warmServiceWorkerCache(registration) {
  const worker = registration.active || registration.waiting || registration.installing;
  if (!worker) return;
  worker.postMessage({ type: 'CACHE_URLS', urls: collectAssetUrls() });
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      navigator.serviceWorker.ready.then((readyRegistration) => {
        warmServiceWorkerCache(readyRegistration);
      });

      window.addEventListener('load', () => warmServiceWorkerCache(registration), { once: true });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  });
}
