const rawApiUrl = import.meta.env.VITE_API_URL || 'https://balanced-freedom-production-acd7.up.railway.app/api';

export const API_URL = rawApiUrl.replace(/\/$/, '');
export const API_ORIGIN = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;
export const UPLOADS_URL = `${API_ORIGIN}/uploads`;

export function toAbsoluteUploadUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
