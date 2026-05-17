# Lockstrm — Plataforma privada de streaming de vídeo

Plataforma B2B de vídeo bajo demanda con control de acceso por grupos, analíticas de visualización y streaming seguro mediante Service Worker. Desarrollada como proyecto final de ciclo con Spring Boot + Angular + MySQL, desplegada con Docker Compose.

---

## Índice

1. [Qué hace la aplicación](#qué-hace-la-aplicación)
2. [Stack técnico](#stack-técnico)
3. [Arquitectura](#arquitectura)
4. [Cómo levantar el proyecto](#cómo-levantar-el-proyecto)
5. [Variables de entorno](#variables-de-entorno)
6. [Decisiones técnicas destacadas](#decisiones-técnicas-destacadas)
7. [Endpoints principales](#endpoints-principales)
8. [Estructura del proyecto](#estructura-del-proyecto)

---

## Qué hace la aplicación

Lockstrm permite a organizaciones gestionar y distribuir vídeos de forma privada:

- **Subida de vídeos** con generación automática de miniatura, validación por magic bytes y límite de 200 MB
- **Grupos con roles**: MIEMBRO → EDITOR → ADMIN → SUPER_ADMIN. Cada grupo controla qué vídeos pueden ver sus miembros
- **Streaming HTTP 206** con soporte completo de seeking sin cargar el vídeo completo en memoria
- **Token JWT invisible en el streaming**: un Service Worker inyecta la cabecera `Authorization` de forma transparente, sin que el token aparezca en ninguna URL ni log
- **Analíticas anti-trampa**: el tiempo de visualización se acumula en servidor a razón de 5 segundos por ping, ignorando el `currentTime` del player (no se puede inflar saltando al final)
- **Cuota de almacenamiento** de 5 GB por usuario, calculada en tiempo real sobre el sistema de ficheros
- **Dashboard** con vídeos más vistos y subidas recientes

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Spring Boot 3.2.3 · Java 21 · Maven |
| Base de datos | MySQL 8.0 · Flyway · JPA/Hibernate (`ddl-auto=validate`) |
| Autenticación | JWT stateless · JJWT 0.12.6 · BCrypt |
| Frontend | Angular 21 · TypeScript 5.9 · RxJS |
| Servidor web | Nginx Alpine (reverse proxy + SPA fallback) |
| Infraestructura | Docker Compose · multi-stage builds |

---

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│  Navegador                                       │
│                                                  │
│  Angular 21 (SPA)                                │
│  ┌───────────────────────────────────────────┐   │
│  │ Service Worker (stream-proxy.sw.js)        │   │
│  │ Intercepta /video-proxy/* → inyecta JWT   │   │
│  └───────────────────────────────────────────┘   │
└──────────────────┬──────────────────────────────┘
                   │ HTTP (puerto 4200 en local)
┌──────────────────▼──────────────────────────────┐
│  Nginx                                           │
│  /api/* → proxy → backend:8080                  │
│  /*     → SPA fallback (index.html)             │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  Spring Boot (puerto 8080)                       │
│                                                  │
│  JwtAuthenticationFilter                        │
│  RateLimitFilter (10 req/min en /api/auth/*)    │
│                                                  │
│  Controllers → Services → Repositories          │
│                                                  │
│  Volúmenes Docker:                              │
│  /var/lockstrm/videos      (ficheros de vídeo)  │
│  /var/lockstrm/thumbnails  (miniaturas JPEG)    │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│  MySQL 8                                         │
│  Volumen Docker: /var/lib/mysql                 │
└─────────────────────────────────────────────────┘
```

### Por qué un Service Worker para el streaming

Un elemento `<video src="...">` del navegador no puede enviar cabeceras HTTP personalizadas. Sin Service Worker, el JWT tendría que ir en la query string (`?token=...`), lo que lo expone en logs del servidor, historial del navegador y cabecera Referer.

**Solución**: el frontend construye URLs con prefijo `/video-proxy/`. El Service Worker intercepta esas peticiones, las reescribe apuntando al backend real (`/api/videos/stream/`) e inyecta `Authorization: Bearer {token}` — sin que el JWT toque ninguna URL visible.

Si el Service Worker no está disponible (HTTP sin HTTPS, navegadores muy antiguos), el sistema cae automáticamente a un fallback con `?token=` en la URL, que el backend acepta exclusivamente en las rutas `/stream/`.

---

## Cómo levantar el proyecto

### Requisitos

- Docker Desktop (o Docker Engine + Compose plugin)
- Git

### Pasos

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd Lockstrm

# 2. Crear el fichero de variables de entorno
cp .env.example .env

# 3. Editar .env con tus valores (ver sección siguiente)
# En Linux/Mac: nano .env
# En Windows:   notepad .env

# 4. Levantar todos los servicios
docker compose up --build
```

La primera vez tarda 3-5 minutos (Maven descarga dependencias, Node compila Angular). Las siguientes levanta en segundos desde caché.

| Servicio | URL |
|---|---|
| Aplicación (frontend) | http://localhost:4200 |
| API (backend) | http://localhost:8080 |
| Base de datos | localhost:3306 |

```bash
# Parar los servicios (conserva datos)
docker compose down

# Parar y borrar todos los datos (vídeos, BD)
docker compose down -v
```

### Lo que Docker gestiona automáticamente

- La base de datos y todas las tablas se crean solas al primer arranque
- El backend espera a que MySQL esté listo antes de arrancar (healthcheck)
- Los vídeos, miniaturas y la base de datos persisten aunque reinicies los contenedores
- Si un servicio cae, Docker lo reinicia solo (`restart: unless-stopped`)

---

## Variables de entorno

Copia `.env.example` a `.env` y rellena los valores:

```env
# Base de datos
MYSQL_ROOT_PASSWORD=contraseñaSegura
MYSQL_USER=lockstrm
MYSQL_PASSWORD=otraContraseñaSegura

# JWT — genera un secreto seguro con:
#   openssl rand -base64 32
JWT_SECRET=tu_secreto_aqui

# CORS — URL del frontend sin barra final
# Local:       http://localhost:4200
# Producción:  https://tudominio.com
CORS_ORIGIN=http://localhost:4200
```

> **Importante**: el fichero `.env` está en `.gitignore` y nunca debe subirse al repositorio.

---

## Decisiones técnicas destacadas

### Validación de vídeo por firma binaria (magic bytes)

La extensión del fichero y el `Content-Type` del navegador son falsificables. El validador [`VideoMimeValidator`](src/main/java/com/lockstrm/platform/services/VideoMimeValidator.java) lee los primeros 16 bytes del fichero y verifica la firma binaria real:

| Formato | Firma |
|---|---|
| MP4 / MOV / M4V | Bytes 4-7 == `ftyp` |
| WebM / MKV | `0x1A 0x45 0xDF 0xA3` |
| AVI | `RIFF` + `AVI ` en posiciones 0-3 y 8-11 |

Si el contenido no coincide con ningún formato de vídeo conocido, el fichero se rechaza antes de escribir nada en disco.

### Heartbeat anti-fraude para analíticas

El player emite un ping cada 5 segundos mientras el vídeo está en reproducción activa. El backend acumula exactamente 5 segundos por ping recibido — **ignorando el `currentTime`** reportado por el cliente. Arrastrar la barra al final del vídeo no computa tiempo de visualización. Cada apertura del reproductor genera un `sessionId` UUID nuevo, creando una fila independiente en `logs`, lo que permite distinguir "visto 3 veces" de "3 usuarios distintos".

### Relación N:M vídeo-grupo

Un vídeo puede pertenecer a múltiples grupos simultáneamente. Las analíticas segregan por grupo: el mismo vídeo visto desde el Grupo A y desde el Grupo B genera métricas independientes gracias al campo `grupoId` nullable en la tabla `logs`.

### Edición de permisos de grupo sin estado parcial

Al editar los grupos de un vídeo se valida el rol del propietario en **todos** los grupos destino antes de tocar la base de datos. Si alguna validación falla, la operación aborta sin dejar estado parcial. La implementación borra todas las filas de `PermisosGrupo` y las reinserta (con `flush()` explícito entre ambas operaciones para evitar conflictos de PK en la sesión Hibernate).

### Seguridad HTTP

- **CSP** estricta: `default-src 'self'`; `media-src 'self' blob:`; sin `unsafe-eval`
- **HSTS**: `max-age=31536000; includeSubDomains`
- **Rate limiting**: 10 peticiones/minuto por IP en `/api/auth/*`
- **CSRF**: desactivado (sesiones stateless con JWT)
- **Path traversal**: todos los accesos a disco validan `filePath.startsWith(baseDir)`
- **DTOs**: ninguna entidad JPA se expone directamente al cliente

---

## Endpoints principales

### Autenticación — `/api/auth`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/registro` | Registro de usuario |
| POST | `/login` | Login → devuelve JWT |
| GET | `/check-email` | Comprueba disponibilidad de email |
| GET | `/check-username` | Comprueba disponibilidad de username |

### Vídeos — `/api/videos`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/subir` | Sí | Sube vídeo + miniatura (multipart) |
| GET | `/mios` | Sí | Lista los vídeos del usuario |
| GET | `/stream/{fileName}` | Sí* | Streaming HTTP 206 |
| GET | `/thumbnails/{fileName}` | No | Sirve miniatura JPEG |
| PATCH | `/{idVideo}` | Sí | Edita título y grupos |
| DELETE | `/{idVideo}` | Sí | Elimina vídeo y ficheros |
| POST | `/{idVideo}/heartbeat` | Sí | Registra pulso de reproducción |
| GET | `/espacio` | Sí | Cuota de almacenamiento usada |

*El JWT puede ir en cabecera `Authorization: Bearer` o en `?token=` (solo en esta ruta).

### Grupos — `/api/grupos`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Lista grupos del usuario |
| GET | `/creados` | Lista grupos donde es admin |
| POST | `/` | Crea un grupo nuevo |
| GET | `/{id}` | Detalle del grupo |
| PATCH | `/{id}/nombre` | Renombra el grupo |
| DELETE | `/{id}` | Elimina el grupo |
| GET | `/{id}/videos` | Vídeos del grupo |
| POST | `/{id}/miembros` | Añade miembro |
| DELETE | `/{id}/miembros/{userId}` | Expulsa miembro |
| PATCH | `/{id}/miembros/{userId}/rol` | Cambia rol |
| GET | `/{id}/analiticas` | Analíticas del grupo |

### Analíticas — `/api/analiticas`

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/globales` | Resumen global del usuario |
| GET | `/videos/{idVideo}/logs` | Sesiones de un vídeo (filtros: grupoId, desde, hasta) |

---

## Estructura del proyecto

```
Lockstrm/
├── src/main/java/com/lockstrm/platform/
│   ├── config/          # SecurityConfig, CorsConfig, AppConfig
│   ├── controllers/     # AuthController, VideoController, GrupoController…
│   ├── dto/             # DTOs de request/response (nunca entidades raw)
│   ├── entities/        # JPA: Usuario, Video, Grupo, Log, MiembrosGrupo…
│   ├── enums/           # RolGrupo (MIEMBRO → EDITOR → ADMIN → SUPER_ADMIN)
│   ├── exceptions/      # GlobalExceptionHandler, excepciones de dominio
│   ├── repositories/    # Spring Data JPA con queries JPQL custom
│   ├── security/        # JwtAuthenticationFilter, JwtService, RateLimitFilter
│   └── services/        # VideoService, LogService, GrupoService…
│
├── lockstrm-front/
│   └── src/app/
│       ├── core/
│       │   ├── guards/       # authGuard, noAuthGuard
│       │   ├── interceptors/ # JwtInterceptor, ErrorInterceptor
│       │   ├── layouts/      # AppShell, PrivateLayout, PublicLayout
│       │   └── services/     # VideoService, AuthService, VideoStreamService…
│       ├── features/
│       │   ├── videos/       # Biblioteca, reproductor, heartbeat
│       │   ├── grupos/       # Lista y detalle de grupos
│       │   ├── analiticas/   # Dashboard global y por vídeo
│       │   ├── dashboard/    # Vista principal
│       │   └── auth/         # Login y registro
│       └── shared/
│           ├── pipes/        # VideoDurationPipe, ThumbnailSrcPipe…
│           └── utils/        # Paginator, ErrorUtils
│
├── docker-compose.yml   # Orquestación: MySQL + Backend + Frontend/Nginx
├── Dockerfile           # Multi-stage: Maven → JRE Alpine
├── .dockerignore
├── .env.example         # Plantilla de variables de entorno
└── lockstrm-front/
    ├── Dockerfile       # Multi-stage: Node → Nginx Alpine
    ├── .dockerignore
    └── nginx.conf       # SPA fallback + proxy /api/ → backend
```
