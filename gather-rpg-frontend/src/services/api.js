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
 * URL del arte de mundos y mapas.
 *
 * Vive en `public/worlds/` del propio frontend, no en el backend: son pocas
 * imágenes, estables y cuadradas, así que viajan versionadas en git junto al
 * código y se sirven desde el mismo dominio. Eso las hace inmunes a que se
 * reconstruya EC2, a costa de necesitar un redeploy del front para añadir una.
 *
 * BASE_URL (en vez de "/" fijo) mantiene la ruta correcta si algún día la app
 * se sirve desde un subdirectorio.
 *
 * OJO: los archivos de `public/` se copian a `dist/` SIN hash de contenido, así
 * que reemplazar una imagen conservando el nombre puede seguir sirviéndose desde
 * la caché del navegador.
 */
export const worldArtUrl = (filename) =>
  (filename ? `${import.meta.env.BASE_URL}worlds/${filename}` : null);

export default api;
