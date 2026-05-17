# Revisión crítica — Documentación técnica Lockstrm (UT5)

Análisis comparado entre **el enunciado UT5** (requisitos obligatorios), **la documentación actual** (PDF entregado) y **el estado real del código** en el repositorio.

Marcado:
- [ ] = pendiente de corregir / añadir
- 🔴 CRÍTICO (incumple el enunciado, o miente sobre el código)
- 🟠 IMPORTANTE (mejora sustancial de calidad)
- 🟡 MENOR (pulido / forma)

---

## 1. Apartados del enunciado y su estado actual

| # | Apartado obligatorio según enunciado | Estado en tu PDF |
|---|---|---|
| 1 | Título del proyecto | ✅ Aparece en portada |
| 2 | Índice | ⚠️ Existe, pero está **incompleto** (faltan 6.10, 7, 8, 9, 10, 11 con sus subapartados) |
| 3 | Estudio del sector productivo | ✅ Bien escrito |
| 4 | Finalidad del proyecto | ✅ Bien, aunque con problema de formato (ver §3) |
| 5 | Descripción básica del proyecto | ✅ Correcto pero corto y desordenado |
| 6.1 | Herramientas de desarrollo software | ✅ |
| 6.2 | Diseño del proyecto (BD, E/R, clases, casos de uso) | ⚠️ Falta diagrama E/R, diagrama de clases y diagrama de casos de uso |
| 6.3 | Esquema de funcionamiento | ⚠️ Sólo prosa, **sin diagrama** |
| 6.4 | Descomposición modular e interrelación | ⚠️ Sólo prosa, **sin esquema** |
| 6.5 | Descripción de los módulos | ⚠️ Solo backend. Frontend no se descompone como módulo |
| 6.6 | Descripción de la interfaz de usuario | ⚠️ Solo "CAPTURAS\*\*\*\*\*" — **no hay capturas reales** |
| 6.7 | Descripción de listados e informes | ⚠️ Muy breve, no describe los informes/listados como tales |
| 6.8 | Manual de usuario | ⚠️ "CAPTURAS\*\*\*\*\*" sin capturas reales |
| 6.9 | Manual de instalación o despliegue | ⚠️ Falta detalle del `.env`, requisitos exactos, primer admin |
| **6.10** | **Presentación de la aplicación (vídeo ≤ 5 min)** | 🔴 **NO MENCIONADO EN ABSOLUTO** |
| 7 | Planificación del proyecto | ⚠️ Sin diagrama Gantt, sin valoración económica, sin permisos/autorizaciones |
| 8 | Control de la ejecución | ✅ Bien argumentado, aunque sin indicadores de calidad formales |
| 9 | Dificultades encontradas | ✅ Muy bueno |
| **10** | **Propuestas de mejora** | 🔴 **NO EXISTE** |
| **11** | **Conclusión final** | 🔴 **NO EXISTE** |

> **El documento entregado está truncado**: el PDF termina en el apartado 9 ("Dificultades encontradas") sin llegar a 10 y 11, que son obligatorios. Esto por sí solo suspende el cumplimiento del enunciado.

---

## 2. ERRORES CRÍTICOS — Cosas que dicen lo contrario que el código (CORREGIR YA)

### 2.1 🔴 El Service Worker NO inyecta el token por query param: inyecta cabecera `Authorization`
- [ ] En el apartado 6.3 ("Esquema de funcionamiento") y 6.5.3 ("Streaming") afirmas:
  > "el Service Worker intercepta esas peticiones salientes hacia el endpoint de streaming […] y reescribe la URL añadiendo el token como query parameter (?token=...). En el backend, un filtro específico para esa ruta acepta el token tanto por cabecera como por query string"
- Pero en `lockstrm-front/public/stream-proxy.sw.js` el SW reescribe la URL **a `/api/videos/stream/{id}` y añade `headers['Authorization'] = Bearer ${authToken}`**. El comentario del propio código lo subraya: *"JWT en cabecera en lugar de query string → no aparece en logs del servidor"*.
- Además, el flujo real usa **un "stream ticket" distinto del JWT principal**, firmado y atado al `fileName`, con TTL de ~60 s (`JwtService.generateStreamTicket` + endpoint `POST /api/videos/stream-ticket/{fileName}`). El JWT general nunca viaja por query param. Esto es bastante más elegante de lo que pintas — y lo estás contando **mal y al revés**.

### 2.2 🔴 La descripción de la arquitectura Docker no se corresponde con `docker-compose.yml`
- [ ] Dices que docker-compose define: backend, base de datos, **proxy inverso Nginx** y **Prometheus** como contenedor.
- El `docker-compose.yml` real define **3 servicios**: `db`, `backend`, `frontend`. **No hay servicio Nginx independiente** (Nginx vive dentro del contenedor `frontend` y se construye con su `lockstrm-front/Dockerfile`). **No hay servicio Prometheus**.
- También dices que Nginx hace **terminación TLS, redirección HTTP→HTTPS** y **caché**. No es cierto: el contenedor frontend expone el puerto **80** sin TLS, el nginx.conf hace sólo SPA fallback + proxy `/api/`. La terminación TLS no está en este repo.
- [ ] O ajustas la documentación a la realidad (frontend monolítico con Nginx interno, sin TLS en el compose, Prometheus deshabilitado), o configuras de verdad ese stack.

### 2.3 🔴 Endpoint del heartbeat: dirección incorrecta
- [ ] Dices: *"el cliente emite latidos periódicos al endpoint `POST /api/logs/heartbeat`"*.
- Realidad: `VideoController @PostMapping("/{idVideo}/heartbeat")` → **`POST /api/videos/{idVideo}/heartbeat`**. No existe `/api/logs/heartbeat`.

### 2.4 🔴 Frecuencia de heartbeat: la maquillas como "cada pocos segundos"
- [ ] Realidad: el intervalo es **fijo a 5 segundos** (`LogService.HEARTBEAT_INTERVAL_SECONDS = 5`) y **se suma una constante, no el `currentTime` del cliente**. Esto es precisamente el truco anti-fraude (no se puede inflar el tiempo arrastrando la barra al final) y la documentación **se lo pierde**. El README lo explica bien, pero la memoria técnica no.

### 2.5 🔴 Cuota de almacenamiento por usuario (5 GB): omitida por completo
- [ ] El README documenta una **cuota de 5 GB por usuario calculada en tiempo real** (endpoint `GET /api/videos/espacio`). La memoria no la menciona. Es una funcionalidad de producto, no un detalle.

### 2.6 🔴 Tamaño máximo de subida (200 MB): omitido
- [ ] `spring.servlet.multipart.max-file-size=200MB` está fijado en `application.properties`. En el apartado 9 hablas vagamente de "subí un vídeo de 300 MB y el sistema petó por una capa intermedia" pero **nunca documentas el límite vigente**.

### 2.7 🔴 Inconsistencia de número de commits
- [ ] Dices: *"114 commits entre diciembre de 2025 y mayo de 2026"*.
- Realidad: **115 commits** entre **2025-12-10** y **2026-05-14**. Diferencia menor pero ya que citas números, citalos bien.

### 2.8 🔴 Exportar a CSV: prometes algo que no existe
- [ ] En el manual de usuario (6.8.5) dices: *"Los datos pueden exportarse en formato CSV para análisis posterior en hoja de cálculo."*.
- No hay ningún endpoint ni servicio que exporte CSV en el código (`grep -rn "CSV" src/main/java/` no devuelve nada). **O implementas el export o quitas la afirmación.**

### 2.9 🔴 Caducidad de tokens JWT
- [ ] Texto: "JWT […] con una caducidad de ocho horas". Coherente con `jwt.expiration=28800000` (8 h). ✅ Esto sí es correcto. Pero olvidas mencionar el **stream ticket de 60 s** que sí existe en el código (`STREAM_TICKET_TTL_SECONDS` en `JwtService`).

### 2.10 🔴 Convención de nombres del rol
- [ ] La doc cita `SUPER_ADMIN > ADMIN > EDITOR > MIEMBRO`. Coherente con `enums/GroupRole.java`. ✅
- 🟡 El README está **desactualizado** (`VIEWER → EDITOR → ADMIN → SUPER_ADMIN`). No corrige nada en la doc, pero **deberías corregir el README** para que el evaluador no vea contradicciones entre los dos documentos del repo.

### 2.11 🔴 Recuperación de contraseña: la documentas pero falta describir que requiere SMTP
- [ ] El `application.properties` configura SMTP (`spring.mail.host`, `MAIL_USERNAME`, `MAIL_PASSWORD`, etc.) para enviar el enlace de recuperación. Esto **no aparece** en 6.9 (Manual de despliegue) ni en 6.1 (Herramientas). Si el evaluador clona y no configura el SMTP, la recuperación no funcionará y no tendrá ni idea de por qué.

### 2.12 🔴 Inconsistencia en la "índice"
- [ ] El índice del PDF no incluye:
  - 6.10 Presentación de la aplicación
  - 7. Planificación del proyecto (sí aparece en cuerpo)
  - 8. Control de la ejecución (sí aparece en cuerpo)
  - 9. Dificultades encontradas (sí aparece en cuerpo)
  - 10. Propuestas de mejora (no existe)
  - 11. Conclusión final (no existe)
- El índice y el cuerpo tienen que coincidir.

---

## 3. ERRORES DE REDACCIÓN/MAQUETACIÓN A CORREGIR

### 3.1 🔴 Apartado 4 (Finalidad del proyecto): párrafos desordenados
- [ ] En el PDF, el texto se desordena: aparecen primero las "soluciones" y después los "problemas":
  > *"Lockstrm sustituye esa lógica por una autenticación con credenciales […]"* (solución) y **después** *"El control de acceso debe ser real, no aparente. Un enlace oculto no protege"* (problema).
- Hay 5 pares problema/solución y todos están **invertidos**. El lector llega a la solución antes de entender el problema. Hay que reordenar todos los párrafos en este apartado.

### 3.2 🔴 Apartado 5 (Descripción básica): primer párrafo descolocado
- [ ] El primer párrafo arranca con *"Internamente se estructura como una aplicación cliente-servidor desacoplada…"* antes de haber dicho qué es Lockstrm. El párrafo que dice *"Lockstrm es una plataforma web full-stack pensada para…"* debería ir **antes**.
- [ ] Frase suelta y huérfana: *"Signals. Toda la arquitectura se entrega contenedorizada…"*. Hay un punto perdido o falta un conector.

### 3.3 🟠 Apartado 6.5 ("conceptualmente se pueden identificar tres bloques")
- [ ] El texto reconoce que el backend **no se estructura formalmente en módulos**, pero el enunciado pide *"Descomposición modular del proyecto e interrelación entre módulos"*. Justificar la decisión está bien, pero **falta describir también el frontend como módulo** (capa de componentes, capa de servicios, capa de guardias e interceptores, Service Worker). Mencionas Angular pero no lo descompones.

### 3.4 🟠 Apartado 6.5.1 (Seguridad): orden de la lista
- [ ] En la lista de bullets aparece la frase introductoria *"Es el módulo transversal por excelencia: ningún otro funciona sin él, pero él mismo no contiene lógica de negocio del dominio"* **entre** los bullets. Hay que sacarla al principio.
- [ ] Mencionas la "Gestión de tokens de recuperación de contraseña" pero **no documentas el servicio `PasswordResetService`** ni la entidad `PasswordResetToken` que sí existen en el código. Hazlo explícito.

### 3.5 🟠 Apartado 6.6 (UI): la frase sobre WCAG es defensiva pero confusa
- [ ] *"No se ha realizado una auditoría WCAG formal -queda fuera del alcance del TFG-"*: el proyecto no es un TFG (es 2º DAW). Quita la palabra "TFG" del texto. Aparece otra vez en el apartado 7 (riesgos).

### 3.6 🟡 Apartado 6.6.5: el título "6.6.5. Responsividad y accesibilidad" aparece DOS VECES seguidas en el documento.
- [ ] Eliminar duplicado.

### 3.7 🟡 Marcadores "CAPTURAS\*\*\*\*\*"
- [ ] Aparecen al menos en 6.6 (UI), 6.8 (Manual usuario), 6.8.1 (Acceso), 6.8.2 (operaciones comunes), 6.8.4 (Editor), 6.8.5 (Admin), 7 (Planificación). **Hay que sustituirlos todos por capturas reales numeradas con pie de figura**.

---

## 4. SECCIONES A AÑADIR O REHACER POR COMPLETO (incumplimientos del enunciado)

### 4.1 🔴 6.2 — Diseño del proyecto: faltan los DIAGRAMAS exigidos por el enunciado
El enunciado dice literalmente: *"Modelo E/R, normalización, diagrama de clases, diagrama de casos de uso, etc."*. La doc actual sólo describe las 7 tablas en prosa.
- [ ] **Añadir diagrama E/R** (puede generarse desde MySQL Workbench / dbdiagram.io con las 7 tablas: `usuarios`, `videos`, `grupos`, `miembros_grupo`, `permisos_grupo`, `video_vistas`, `logs`, `password_reset_tokens`). **Falta `password_reset_tokens` en tu descripción**.
- [ ] **Diagrama de clases UML** (clases JPA: User, Video, Group, GroupMember, GroupPermission, VideoView, Log, PasswordResetToken — y sus IDs compuestos).
- [ ] **Diagrama de casos de uso** con los 4 actores (VISITANTE, MIEMBRO, EDITOR, ADMIN, SUPER_ADMIN) y los casos: Registro, Login, Subir vídeo, Ver vídeo, Gestionar miembros, Cambiar rol, Crear grupo, Ver analíticas, Recuperar contraseña, etc.
- [ ] **Comentar normalización**: el modelo está esencialmente en 3FN, y conviene argumentarlo (`miembros_grupo` y `permisos_grupo` con PK compuestas, sin redundancias).

### 4.2 🔴 6.3 — Esquema de funcionamiento: falta el diagrama
- [ ] Añadir **diagrama de secuencia** (login → API → JWT → reproductor → Service Worker → backend → 206) o un **diagrama de flujo**. La prosa que tienes está bien, pero el enunciado pide *"un diagrama de funcionamiento, o utilizar una herramienta gráfica para mostrarlo"*. No es opcional.

### 4.3 🔴 6.4 — Descomposición modular: falta el esquema
- [ ] **Añadir diagrama de componentes/módulos**: navegador (Angular + SW) ⟷ Nginx ⟷ Spring Boot ⟷ MySQL, con las flechas de comunicación y los volúmenes Docker. Otra vez: el enunciado pide *"Esquema de los distintos módulos que conforman el proyecto y la relación entre ellos"*.

### 4.4 🔴 6.5 — Módulos del frontend ausentes
- [ ] Faltan como módulos descritos:
  - Módulo de autenticación frontend (login, registro, forgot/reset).
  - Módulo de gestión de vídeos (subida, biblioteca, reproductor custom).
  - Módulo de analíticas frontend (dashboard global, por vídeo, por grupo).
  - Módulo de Service Worker.
  - Módulo de layouts (AppShell, PublicLayout, PrivateLayout).
  - Módulo de Settings/Profile.
- Hay que dedicar al menos una subsección por bloque, indicando sus carpetas (`features/auth`, `features/videos`, etc.), servicios principales (`AuthService`, `VideoService`, `VideoStreamService`, `AnalyticsService`) y guardias/interceptores (`authGuard`, `noAuthGuard`, `JwtInterceptor`, `ErrorInterceptor`, `pendingChangesGuard`).

### 4.5 🔴 6.6 — Interfaz de usuario: capturas reales
- [ ] Capturas mínimas necesarias (numeradas, con pie):
  1. Pantalla pública / home
  2. Login
  3. Registro
  4. Forgot password / Reset password
  5. Dashboard tras login
  6. Lista de "Mis vídeos"
  7. Detalle de grupo (catálogo)
  8. Reproductor con la barra de progreso
  9. Subida de vídeo con barra de progreso
  10. Lista de miembros + cambio de rol
  11. Permisos de un vídeo (grupos asignados)
  12. Analíticas globales
  13. Analíticas por vídeo (gráfica + logs)
  14. Analíticas por grupo
  15. Ajustes (avatar, password)
  16. Perfil
  17. Versión móvil de al menos 2 pantallas críticas
- Recomendación: usar siempre datos reales y consistentes (los mismos 2-3 vídeos en todas las capturas).

### 4.6 🔴 6.7 — Listados e informes: describir cada informe como informe
- [ ] La sección actual habla de implementación. El enunciado pide *"Descripción de listados e informes"*. Hay que listarlos como entregables al usuario:
  1. **Informe global por usuario**: nº vídeos totales, espacio ocupado, vídeos más vistos. (Endpoint `/api/analiticas/globales`).
  2. **Informe por vídeo**: nº reproducciones, espectadores únicos, segundos totales acumulados, sesiones recientes con fecha/IP. (Endpoint `/api/analiticas/videos/{idVideo}/logs`).
  3. **Informe por grupo**: actividad agregada por grupo. (Endpoint `/api/grupos/{id}/analiticas`).
  4. **Listado de vídeos del usuario** (`/api/videos/mios`).
  5. **Listado de miembros de un grupo**.
  6. **Listado de grupos creados / pertenecientes**.
  7. **Cuota de almacenamiento** (`/api/videos/espacio`).
- Para cada uno: descripción funcional, parámetros que admite (filtros temporales, `grupoId`, `desde`, `hasta`) y captura.

### 4.7 🔴 6.8 — Manual de usuario: capturas reales
Ya señalado, pero además:
- [ ] Manual de usuario debe describir también:
  - Pantalla **"Perfil"** (componente `ProfileComponent` existe en el código pero no se documenta).
  - Diferencia clara entre **"Mi Espacio"** (`/mi-espacio/...`) y la zona de grupos (las rutas reales están bajo `/mi-espacio/grupos`, no `/grupos`).
  - **Avatares y imágenes de grupo**: existen volúmenes para avatars y grupos en el compose; el doc menciona el avatar pero no el cambio de imagen del grupo.
  - **"Mis vídeos"** (`/mi-espacio/videos`) frente a "vídeos por grupo".

### 4.8 🔴 6.9 — Manual de despliegue: incompleto
Lo que falta:
- [ ] **Requisitos exactos**: Docker Engine ≥ X, Compose v2.
- [ ] **Listado completo de variables `.env`**: MYSQL_ROOT_PASSWORD, MYSQL_USER, MYSQL_PASSWORD, JWT_SECRET (cómo generarlo: `openssl rand -base64 32`), CORS_ORIGIN, API_URL, MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM, APP_URL, UPLOAD_DIR, THUMBNAILS_DIR, AVATARS_DIR, GRUPOS_IMG_DIR, RESET_TOKEN_EXPIRY_MINUTES.
- [ ] **Puertos**: 80 (frontend), 8080 (backend), 3307 (DB expuesto en host, no 3306 — está en docker-compose).
- [ ] **Cómo crear el primer usuario admin**: dices que "puede crearse mediante un seed SQL incluido en el repositorio o mediante una llamada controlada al endpoint de registro". **¿Existe ese seed SQL?** Si no, miente. Si sí, indicar la ruta y cómo se ejecuta.
- [ ] **Backups**: das una mención a `mysqldump`, pero falta el comando concreto (`docker exec lockstrm_db mysqldump …`) y la copia de `uploads/`.
- [ ] **Sin TLS por defecto**: aclarar que el `docker-compose` actual no termina TLS y que en producción hace falta poner un reverse proxy externo (Caddy/Traefik/Nginx host) delante del puerto 80.
- [ ] **GitHub Actions**: enumerar los secretos requeridos: `SSH_PRIVATE_KEY` (Base64), `SERVER_HOST`, `SERVER_USER`.

### 4.9 🔴 6.10 — Presentación de la aplicación: **NO EXISTE**
- [ ] Añadir apartado con un enlace al vídeo de demo (≤ 5 min). Es obligatorio según el enunciado.
- [ ] Estructura sugerida para el vídeo: 30 s contexto, 30 s registro/login, 1 min reproducción y seek, 1 min gestión de grupos y roles, 1 min analíticas, 30 s admin/super_admin.

### 4.10 🔴 7 — Planificación: faltan elementos exigidos
El enunciado pide: secuenciación de tareas, recursos, **logística necesaria**, **necesidades de permisos y autorizaciones**, identificación de riesgos y **prevención**, **valoración económica**.
- [ ] **Diagrama Gantt** (puede generarse de las fechas reales del repo).
- [ ] **Valoración económica**: aunque el proyecto no se cobre, hay que estimar:
  - Horas dedicadas (≈ 6 meses de trabajo, calcular horas/semana × precio/hora del perfil).
  - Coste hardware (portátil de desarrollo amortizado).
  - Coste infraestructura (servidor VPS + dominio + certificado TLS si aplica).
  - Coste licencias: 0 € (toda la stack es open source) — pero declárelo explícitamente.
  - Total estimado.
- [ ] **Permisos y autorizaciones**: aunque sea trivial, mencionar que el proyecto no requiere autorizaciones externas (RGPD se cumple por diseño), y que los contenidos de prueba se han generado/usado con consentimiento del grupo de magos. Cuando el sistema se despliegue en una organización real, hará falta cláusula RGPD y registro como responsable de tratamiento.
- [ ] **Logística**: equipo de desarrollo, repositorio público, servidor de producción, gestor de tareas (aunque sea informal).
- [ ] **Riesgos**: amplía la lista actual añadiendo: riesgo de fuga de contenido por uso indebido de cuentas; riesgo de saturación de almacenamiento; riesgo de pérdida de datos por fallo del volumen Docker (mitigación: backups); riesgo de incompatibilidad navegador / Service Worker; riesgo de evolución de dependencias críticas.

### 4.11 🔴 8 — Control de la ejecución: añadir indicadores y participación de usuarios
La sección está **bien escrita** pero el enunciado pide explícitamente:
- *"indicadores de calidad"* — añade unos: % de PRs revisados, nº de regresiones por release, tiempo medio entre fallo en producción y fix.
- *"registro y evaluación de incidencias y sus soluciones"* — listar al menos 5-10 incidencias reales (las que cuentas en el apartado 9) con su solución, en formato tabla (Fecha, Descripción, Impacto, Solución, Estado).
- *"procedimiento para la participación en la evaluación de los usuarios"* — formalizar lo que dices del "grupo de magos como beta testers": describir cómo recogiste su feedback, en qué iteraciones.
- *"sistema para garantizar el cumplimiento de las especificaciones"* — listar tus criterios de aceptación (los criterios cualitativos que mencionas) como Definition of Done formal.

### 4.12 🔴 10 — Propuestas de mejora: **NO EXISTE**
Apartado obligatorio. Propuestas razonables a partir de las propias dificultades del proyecto:
- [ ] Suite de tests automatizados (unitarios + integración con Testcontainers).
- [ ] Migrar el rate limit en memoria a Redis para soportar múltiples réplicas.
- [ ] Refresh tokens (acortar el TTL del JWT principal).
- [ ] Transcoding adaptativo (HLS/DASH) para múltiples calidades.
- [ ] CDN para servir vídeo en alta concurrencia.
- [ ] Drag & drop en el formulario de subida.
- [ ] Entorno de staging idéntico a producción.
- [ ] Auditoría WCAG y mejora de accesibilidad.
- [ ] Internacionalización (i18n) — actualmente todo en español.
- [ ] App móvil nativa o PWA con offline.
- [ ] SSO corporativo (SAML/OIDC).
- [ ] DRM real (Widevine) para contenidos críticos.
- [ ] Exportación de informes en CSV/PDF (si vas a quitarla del manual de usuario, mantenla aquí).
- [ ] Métricas avanzadas: completion rate, retention curves, mapas de calor.

### 4.13 🔴 11 — Conclusión final: **NO EXISTE**
- [ ] Cerrar con 1-2 páginas: qué objetivos se cumplieron, qué quedó fuera, qué se aprendió en lo técnico (Spring Security, range requests, Service Workers, Signals) y en lo no técnico (gestión del tiempo en un proyecto solo, deuda técnica consciente, valor del git como bitácora).

---

## 5. MEJORAS DE CALIDAD TÉCNICA DE LA DOCUMENTACIÓN

### 5.1 🟠 Diagramas — actualmente CERO diagramas
- [ ] Modelo E/R (6.2)
- [ ] Diagrama de clases UML (6.2)
- [ ] Casos de uso (6.2)
- [ ] Diagrama de secuencia login + streaming (6.3)
- [ ] Diagrama de componentes/módulos (6.4)
- [ ] Diagrama de despliegue Docker (6.9)
- [ ] Gantt de planificación (7)
- Sugerencia: Mermaid o draw.io, exportar a PNG/SVG y embeber.

### 5.2 🟠 Numeración de figuras y tablas
- [ ] Asignar "Figura 1.", "Figura 2.", "Tabla 1." con pie y referenciarlas desde el texto ("ver Figura 3").

### 5.3 🟠 Listas/Tablas para zonas hoy en prosa
- [ ] Tabla de endpoints REST por controlador.
- [ ] Tabla de entidades JPA ↔ tabla SQL ↔ columnas clave.
- [ ] Tabla de roles × permisos (matriz que es lo que pide el enunciado para "casos de uso por rol").
- [ ] Tabla de variables de entorno (.env).
- [ ] Tabla de incidencias (apartado 8).

### 5.4 🟠 Sintaxis y errores tipográficos
- [ ] *"el cliente *guarda* el JWT en memoria"* en 9 — correcto, pero contradice lo que dijiste antes ("se almacena en localStorage no, en memoria"). Uniformiza.
- [ ] *"un compañero, probando, renombró un PDF como .mp4 y lo subió"* — en un proyecto individual, decir "un compañero" suena raro. Reformular como "intenté yo a propósito una subida con un PDF renombrado".
- [ ] El apartado 9 abusa del paréntesis y de la primera persona narrativa. Para una memoria técnica, dejarlo en primera persona está bien, pero algunos párrafos se pasan a tono blog.
- [ ] *"se pueden identificar tres bloques funcionales claramente diferenciados"*: cláusula "claramente" innecesaria. Hay decenas de adverbios de relleno (*precisamente, exactamente, sencillamente*) — pásale una poda.
- [ ] *"el commit donde por fin dejé de contar tiempo en pestañas inactivas lo recuerdo con cariño"* — tono coloquial, decide si lo aceptas o lo neutralizas.
- [ ] Encabezado/footer: aparece *"2ºDAW 2025/26"* — comprueba que sea consistente con "2º DAW".

### 5.5 🟠 Coherencia portada / metadatos
- [ ] La portada actual sólo tiene "LOCKSTRM — Plataforma segura de distribución de contenido audiovisual corporativo basada en Spring Boot y Angular". Añadir:
  - Nombre del autor: Manuel Ángel Nieto Jiménez
  - Centro / ciclo: 2º DAW
  - Curso 2025/2026
  - Fecha
  - Tutor (si aplica)

### 5.6 🟡 README vs Documentación: contradicciones a unificar
- [ ] Roles: README dice `VIEWER → EDITOR → ADMIN → SUPER_ADMIN` (incorrecto), código y memoria dicen `MIEMBRO → EDITOR → ADMIN → SUPER_ADMIN`. **Corregir el README**.
- [ ] README dice `JPA/Hibernate (ddl-auto=update)`; el `application.properties` real usa `ddl-auto=${DDL_AUTO:validate}` y compose pasa `validate`. **Corregir el README**.
- [ ] El stack en el README omite Flyway y Spring Security; deberían aparecer.

### 5.7 🟡 Bibliografía / referencias
- [ ] Añadir un apartado breve de referencias usadas (Spring Boot docs, Angular docs, RFC 7233 Range Requests, especificación JWT RFC 7519, RGPD). Da seriedad académica.

### 5.8 🟡 Glosario
- [ ] Para un evaluador no técnico, definir términos: JWT, Service Worker, range request, UPSERT, JPA, Flyway, BCrypt, SPA, CORS, CSP.

### 5.9 🟡 Encabezado y pie de página
- [ ] Cada página lleva pie con autor y curso. Bien. Pero falta el número de página visible en todas las páginas (algunas sí, otras no). Revisar consistencia.
- [ ] Falta una sección formal de **índice de figuras / tablas** al inicio.

---

## 6. RESUMEN EJECUTIVO — PRIORIDADES

**Suspensos automáticos si no se corrigen:**
1. Añadir 6.10 (vídeo demo), 10 (mejoras), 11 (conclusión). El documento entregado está literalmente truncado.
2. Añadir los diagramas obligatorios: E/R, clases, casos de uso, funcionamiento, módulos, despliegue.
3. Sustituir todos los "CAPTURAS\*\*\*\*\*" por capturas reales.

**Correcciones técnicas críticas (incoherencia con el código):**
4. Reescribir cómo funciona el Service Worker (inyecta header `Authorization`, no query param; usa stream-tickets de 60 s, no el JWT principal).
5. Reescribir la arquitectura Docker (3 servicios: db, backend, frontend; NO hay Nginx ni Prometheus como contenedores separados).
6. Corregir endpoint heartbeat (`/api/videos/{id}/heartbeat`, no `/api/logs/heartbeat`).
7. Documentar 5 GB de cuota por usuario, 200 MB tamaño máximo de subida, intervalo de 5 s del heartbeat y el truco anti-fraude.
8. Quitar la mención a "exportar CSV" o implementarlo.

**Mejoras de calidad sustanciales:**
9. Apartado 7 (planificación) sin Gantt ni valoración económica → incumple.
10. Apartado 8 (control de ejecución) sin indicadores ni tabla de incidencias → incompleto.
11. Sección 6.5 sin frontend descompuesto → falta la mitad del sistema.
12. Reorganizar párrafos desordenados en 4 (problema/solución invertidos) y 5 (intro mal puesta).

**Pulido final:**
13. Eliminar duplicado de "6.6.5".
14. Corregir referencia a "TFG" (esto es 2º DAW).
15. Cuadrar índice con cuerpo.
16. Tabla de figuras, tabla de tablas, bibliografía, glosario.
17. Unificar README con la memoria (roles, ddl-auto).

---

## 7. Lo bueno que sí mantener

Para que no parezca todo malo — y porque conviene saber qué ya está sólido:
- 🟢 El **apartado 3 (Estudio del sector)** es de los mejores que he visto en este tipo de memoria: nace de una historia personal, sitúa el nicho con precisión (Vimeo Enterprise, Brightcove, Kaltura, Wistia) y conecta con regulación (RGPD, ENS). Mantenlo casi entero.
- 🟢 El **apartado 9 (Dificultades)** es honesto, técnico y demuestra que entiendes lo que has hecho. Los relatos del Service Worker, los enums sobre MySQL, las claves SSH en GitHub Actions y la analítica desdoblada son oro. **Atención**: tienes que asegurarte de que lo que cuentas como "dificultad superada" coincide con lo que describes en 6.5 — y ahora mismo no coincide en el caso del Service Worker.
- 🟢 El **apartado 8 (Control de la ejecución)** tiene el tono justo: reconoces la ausencia de tests automatizados sin maquillarlo y argumentas qué mecanismos sí han funcionado (git, PRs, dogfooding, Flyway). Pero falta cerrar con indicadores formales y tabla de incidencias para que cumpla el enunciado punto por punto.
- 🟢 La **decisión técnica de desdoblar la analítica** (video_vistas vs logs) y la **explicación de por qué `NULL UNIQUE` en MySQL no es duplicado** son sutilezas que no aparecen en muchos proyectos. Mantén ese nivel.
