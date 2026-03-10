import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL!;

function toSnake(str: string): string {
  return str.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`);
}
function deepSnake(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepSnake);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [toSnake(k), deepSnake(v)])
    );
  }
  return obj;
}
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function deepCamel(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepCamel);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [toCamel(k), deepCamel(v)])
    );
  }
  return obj;
}

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use(config => {
  const raw = localStorage.getItem('crm-auth');
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`;
    } catch { /* ignore */ }
  }
  if (config.data && typeof config.data === 'object') {
    config.data = deepCamel(config.data);
  }
  return config;
});

apiClient.interceptors.response.use(
  res => {
    if (res.data && typeof res.data === 'object') {
      res.data = deepSnake(res.data);
    }
    return res;
  },
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('crm-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default apiClient;
