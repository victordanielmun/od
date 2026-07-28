import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Auto logout if 401 Unauthorized
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Dispatch a custom event or force reload to clear app state
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

/**
 * URL absoluta de un archivo estático servido por el backend.
 *
 * Se construye desde el baseURL del cliente API, NUNCA con una ruta relativa
 * tipo "/api/...": en producción el frontend vive en odisea-rpg.com y la API en
 * api.odisea-rpg.com, así que una ruta relativa apuntaría al host del frontend y
 * daría 404. Detrás del proxy de desarrollo (baseURL = "/api") sigue funcionando
 * igual. Mismo criterio que getTTSAudioUrl en voiceApi.
 */
export const apiFileUrl = (path) => {
  const base = (api.defaults.baseURL || '/api').replace(/\/+$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

/** URL de una portada de mundo o preview de mapa (vacío → null). */
export const worldArtUrl = (filename) => (filename ? apiFileUrl(`/world-art/${filename}`) : null);

export default api;
