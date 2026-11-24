/**
 * Global API Configuration for Frontend (Vercel & Local)
 * Automatically redirects relative /api/* requests to VITE_API_URL when set.
 */
export const API_BASE_URL = ((import.meta.env.VITE_API_URL as string | undefined) || '').replace(/\/$/, '');

// Intercept window.fetch for relative /api/ calls when VITE_API_URL is configured
if (API_BASE_URL && typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = `${API_BASE_URL}${input}`;
    } else if (input instanceof URL && input.pathname.startsWith('/api/')) {
      input = new URL(`${API_BASE_URL}${input.pathname}${input.search}`);
    }
    return originalFetch.call(this, input, init);
  };
  console.log(`🔗 API Base configured for external backend: ${API_BASE_URL}`);
}
