const DEFAULT_LOCAL_API_BASE_URL = 'http://127.0.0.1:8000';
const DEFAULT_PRODUCTION_API_BASE_URL = 'https://dashboard-web-backend.onrender.com';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD ? DEFAULT_PRODUCTION_API_BASE_URL : DEFAULT_LOCAL_API_BASE_URL)
);

export async function parseApiError(response, fallback = 'Request failed.') {
  const payload = await response.json().catch(() => null);

  if (typeof payload?.detail === 'string') {
    return payload.detail;
  }

  if (Array.isArray(payload?.detail)) {
    return payload.detail
      .map((item) => item.msg || item.message)
      .filter(Boolean)
      .join(' ') || fallback;
  }

  return fallback;
}
