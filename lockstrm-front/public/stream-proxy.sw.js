/**
 * Lockstrm — Service Worker Proxy para streaming seguro.
 *
 * Problema: <video src="..."> no puede enviar la cabecera Authorization,
 * por lo que el JWT quedaría expuesto en la query string de los logs del servidor.
 *
 * Solución: el frontend construye una URL same-origin (/video-proxy/{id}).
 * Este SW la intercepta, la reescribe apuntando al backend real, e inyecta
 * la cabecera Authorization — sin que el JWT aparezca en ninguna URL visible.
 *
 * Ventajas sobre el enfoque Blob/createObjectURL:
 *   - Streaming nativo con soporte completo de Range requests (seeking)
 *   - Sin carga de vídeo completo en memoria (sin colapso de RAM)
 *   - El token nunca toca la barra de direcciones ni los logs HTTP
 */
'use strict';

const PROXY_PREFIX = '/video-proxy/';

let authToken = null;
let apiBase   = '';   // p.ej. "http://localhost:8080" o "https://api.lockstrm.com"

// ── Ciclo de vida ─────────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  // Activa inmediatamente sin esperar a que se cierren las pestañas existentes.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Toma el control de las páginas ya abiertas sin requerir recarga.
  event.waitUntil(self.clients.claim());
});

// ── Mensajes desde la app ─────────────────────────────────────────────────────

self.addEventListener('message', ({ data }) => {
  if (!data) return;

  if (data.type === 'LOCKSTRM_INIT') {
    // Recibe token + base URL de la API en el arranque / login
    authToken = data.token ?? null;
    apiBase   = data.apiBase ?? '';
  } else if (data.type === 'LOCKSTRM_SET_TOKEN') {
    // Actualización de token (refresco / logout)
    authToken = data.token ?? null;
  }
});

// ── Intercepción de peticiones ────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Solo interceptamos la ruta proxy; el resto pasa sin tocar.
  if (!url.pathname.startsWith(PROXY_PREFIX)) return;

  event.respondWith(handleProxy(event.request, url));
});

/**
 * Reescribe la petición proxy hacia el backend real inyectando el JWT.
 * Conserva la cabecera Range para que el seeking de vídeo funcione correctamente.
 */
async function handleProxy(request, proxyUrl) {
  const idVideo   = proxyUrl.pathname.slice(PROXY_PREFIX.length);
  const targetUrl = `${apiBase}/api/videos/stream/${idVideo}`;

  const headers = {};

  // Cabecera Range crítica para que el navegador pueda saltar a cualquier punto del vídeo
  const range = request.headers.get('Range');
  if (range) headers['Range'] = range;

  // JWT en cabecera en lugar de query string → no aparece en logs del servidor
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  try {
    return await fetch(targetUrl, {
      method:      'GET',
      headers,
      mode:        'cors',
      credentials: 'omit',
      cache:       'no-store',
    });
  } catch (err) {
    // Red caída o backend inaccesible: devuelve 503 sin romper la app
    return new Response('Streaming no disponible', { status: 503 });
  }
}
