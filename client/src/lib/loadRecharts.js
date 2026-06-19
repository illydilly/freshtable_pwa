let rechartsPromise;

export async function loadRechartsFromCdn() {
  if (window.Recharts) return window.Recharts;

  if (!rechartsPromise) {
    rechartsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/recharts@2.13.0/umd/Recharts.min.js';
      script.async = true;
      script.onload = () => resolve(window.Recharts);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  return rechartsPromise;
}
