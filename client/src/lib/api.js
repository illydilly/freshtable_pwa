import axios from 'axios';

const defaultApiBaseUrl = 'https://balanced-freedom-production-acd7.up.railway.app/api';
const apiBaseUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || defaultApiBaseUrl;
const apiOrigin = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl;

function toAbsoluteAssetUrl(value) {
  if (typeof value !== 'string' || !value) return value;
  // 이미 절대 URL이면 그대로
  if (/^https?:\/\//i.test(value)) return value;
  // blob: or data: URL은 그대로 (로컬 미리보기)
  if (value.startsWith('blob:') || value.startsWith('data:')) return value;
  // /uploads/ 또는 /api/ 경로면 서버 origin 붙이기
  if (value.startsWith('/uploads/') || value.startsWith('/api/')) {
    return `${apiOrigin}${value}`;
  }
  // uploads/ (슬래시 없이 시작)도 처리
  if (value.startsWith('uploads/')) {
    return `${apiOrigin}/${value}`;
  }
  return value;
}

function normalizeAssetUrls(data) {
  if (Array.isArray(data)) return data.map(normalizeAssetUrls);
  if (!data || typeof data !== 'object') return data;

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => {
      // 이미지/사진 URL 필드 정규화
      if (key === 'thumbnail' || key === 'photoUrl' || key === 'thumbnailUrl') {
        return [key, toAbsoluteAssetUrl(value)];
      }
      // mealItems 배열 안의 중첩 객체도 재귀 처리
      return [key, normalizeAssetUrls(value)];
    })
  );
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use((response) => ({
  ...response,
  data: normalizeAssetUrls(response.data)
}));
