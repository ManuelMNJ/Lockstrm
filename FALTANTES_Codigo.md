# Faltantes de código — Lockstrm

Inventario de **funcionalidades, endpoints, configuración y elementos de UI que la documentación promete y que el repositorio NO cumple (o cumple solo a medias)**. La fuente es: enunciado UT5, memoria técnica entregada y `README.md`. La verificación se ha hecho leyendo el código real del repo.

Para cada punto:
- 📁 **Archivo/módulo** donde habría que tocar.
- 🧾 **Promesa documental** que lo obliga.
- 🎯 **Decisión**: *implementar* (que el código se ajuste a la doc) o *retirar de la doc* (que la doc se ajuste al código).

Marcado: `[ ]` para ir tachando.

---

## 🔴 PRIORIDAD ALTA — Discrepancias que el evaluador verá si abre la app o el código

### A1. Campo `descripcion` del vídeo no existe en el dominio
- 📁 `src/main/java/com/lockstrm/platform/entities/Video.java`, `dto/EditVideoRequest.java`, `dto/VideoDto.java`, nueva migración `V10__add_video_description.sql`, `services/VideoService.java#subirVideo` + `#editarVideo`, `lockstrm-front/src/app/features/videos/videos.component.html` (formulario de subida y de edición).
- 🧾 Memoria 6.8.4 ("Subir un vídeo"): *"Completar los metadatos: Título (obligatorio). Descripción (opcional, soporta texto plano con saltos de línea)."* y *"Editar […] Permite modificar título, descripción y miniatura."*. **No existe ningún campo `descripcion` en `Video.java` ni en `EditVideoRequest`.**
- 🎯 Implementar: añadir columna en migración nueva, propiedad LOB/TEXT en la entidad, DTOs, validación (máx. 2000 caracteres p.ej.), formularios y vista de detalle.
- [ ] Migración V10
- [ ] Entidad + DTOs (`VideoDto`, `EditVideoRequest`, payload de subida)
- [ ] Servicio + controlador (subir/editar lo guardan)
- [ ] UI subida + edición + visualización en detalle del vídeo

### A2. JWT está en `localStorage`, no en memoria
- 📁 `lockstrm-front/src/app/core/services/auth.service.ts` (líneas 45, 52, 65, 73, 106, 111, 117), opcional un `TokenInMemoryStore`.
- 🧾 Memoria 6.3: *"el cliente, que lo almacena en memoria —no en `localStorage` para reducir la superficie de ataque XSS—"*. **La realidad es que `auth.service.ts` hace `localStorage.setItem(STORAGE_KEY, JSON.stringify(res))`.**
- 🎯 Decisión técnica: o bien (a) mover el token a un signal en memoria + refresh tokens con cookie HttpOnly para la persistencia; o (b) **retirar la afirmación de la memoria** y reconocer que el token vive en `localStorage`. Para un proyecto académico, (b) es asumible si se justifica; (a) sería mucho más trabajo (refresh tokens nuevos, endpoint de refresh, cookies, etc.).
- [ ] Decidir (a) o (b) y aplicar.

### A3. Exportación CSV de analíticas
- 📁 Nuevo: `controllers/AnalyticsController.java#exportarCSV`, `services/AnalyticsService.java#exportarCSV`, opcional `dto/AnalyticsCsvWriter.java`. Frontend: `features/analytics/analytics.component.html` + `services/analytics.service.ts`.
- 🧾 Memoria 6.8.5: *"Los datos pueden exportarse en formato CSV para análisis posterior en hoja de cálculo."*. **No hay ni endpoint ni botón** (`grep -rn "csv\|CSV" src/main/java/` = 0).
- 🎯 Implementar (es relativamente barato) o retirar de la doc.
- [ ] Endpoint `GET /api/analiticas/exportar?...` con `Content-Type: text/csv`.
- [ ] Botón en frontend.

### A4. Cesión de rol SUPER_ADMIN con doble confirmación
- 📁 `services/GroupService.java#cambiarRolMiembro` (líneas 263-273), `dto/CambiarRolRequest.java`.
- 🧾 Memoria 6.5.2: *"un SUPER_ADMIN es el único que puede transferir su rol, y la operación requiere doble confirmación porque deja al usuario que la inicia sin esa capacidad"* y 6.8.5 *"Solo un SUPER_ADMIN puede ceder ese rol, y la operación pide doble confirmación"*.
- ❌ Realidad del código: `"El rol SUPER_ADMIN (creador del grupo) es inmutable"` y `"No se puede asignar el rol SUPER_ADMIN: hay uno único por grupo (el creador)"`. **La transferencia está prohibida.**
- 🎯 Decidir: (a) implementar transferencia con confirmación + endpoint `POST /api/grupos/{id}/transferir-super-admin`, o (b) retirar de la doc y aclarar que el SUPER_ADMIN es inmutable y se asocia al creador.
- [ ] Decidir y aplicar.

### A5. Diálogo de confirmación reutilizable
- 📁 Nuevo: `lockstrm-front/src/app/shared/components/confirm-dialog/`. Refactor de modales actuales en `features/videos/videos.component.html` (líneas ~644 "EDIT MODAL"), `features/groups/...` (eliminar grupo, expulsar miembro), perfil (eliminar cuenta).
- 🧾 Memoria 6.6.1: *"Diálogos de confirmación reutilizables. Cualquier operación irreversible (eliminar un vídeo, expulsar a un miembro, borrar un grupo) pasa por un mismo componente de confirmación."*. **No existe** un componente `confirm-dialog` en `shared/components/` (sólo `custom-select`). Los modales actuales están inlined en cada pantalla.
- 🎯 Implementar componente compartido + signals para abrir/cerrar + Promise<boolean> de resultado.
- [ ] Crear `ConfirmDialogComponent` y un servicio o helper.
- [ ] Migrar los modales destructivos existentes.

### A6. Atajos de teclado en el reproductor
- 📁 `lockstrm-front/src/app/features/videos/video-player/video-player.component.ts`.
- 🧾 Memoria 9: *"los atajos de teclado (espacio para pausar, flechas para adelantar, M para mutear)…"*. El reproductor **no tiene ningún `@HostListener('document:keydown', ...)`** que escuche Space / ArrowLeft / ArrowRight / KeyM.
- 🎯 Implementar `@HostListener` con: Space ↔ play/pause, ←/→ ±5 s, ↑/↓ volumen, M mute, F fullscreen.
- [ ] Añadir listener, asegurarse de no capturar teclas cuando hay un input enfocado.

### A7. Control de velocidad de reproducción visible en el reproductor
- 📁 `features/videos/video-player/video-player.component.html` (sólo hay botón fullscreen, no hay menú de velocidad), `.ts` ya tiene `STORAGE_KEYS.speed` pero no UI.
- 🧾 Memoria 6.8.2: *"El reproductor incluye los controles habituales: play/pause, control de volumen, pantalla completa, velocidad de reproducción y barra de progreso con soporte de búsqueda (seek)"*. La velocidad **se carga de `localStorage` pero no hay control en el HTML**.
- 🎯 Implementar dropdown o popover con 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x. Persistir en `localStorage` (ya está medio hecho).
- [ ] Botón "Velocidad" con menú.

### A8. Filtro por fecha de subida en el catálogo de vídeos
- 📁 `lockstrm-front/src/app/features/videos/videos.component.ts` (hoy solo tiene `criterioOrden` por fecha asc/desc).
- 🧾 Memoria 6.8.2: *"El catálogo permite buscar por título y filtrar por fecha de subida."*. La búsqueda por título existe ✅, **pero "filtrar por fecha" no: sólo se ordena.**
- 🎯 Implementar dos date pickers o presets (hoy, última semana, último mes, todo).
- [ ] Añadir control y `get filteredVideos` que aplique el rango.

### A9. Logging de auditoría de acciones administrativas
- 📁 Nueva entidad `entities/AuditLog.java`, nueva tabla `audit_log`, migración `V11__audit_log.sql`, aspect o servicio `services/AuditService.java`, hooks en `GroupService` (alta/baja miembro, cambio rol, crear/borrar grupo), `VideoService` (subida/borrado), `AuthController` (login/logout opcional).
- 🧾 Memoria 9 ("Logs, permisos y la sensación de que nunca terminas de blindarlo"): *"Un sistema con roles necesita rastro: quién entra, quién cambia un rol, quién promueve a un usuario, quién elimina un vídeo. Llegué tarde a incorporarlo […] y cuando lo añadí tuve que retroactivar varias acciones"*. **No existe ninguna entidad ni tabla de auditoría.** Sólo `logs` (heartbeats de vídeo). La memoria afirma como hecho algo que no está hecho.
- 🎯 Implementar la entidad y registrar al menos: login OK/KO, cambio de rol, alta/baja miembro, crear/borrar grupo, subida/borrado de vídeo, reset password.
- [ ] Migración + entidad + repositorio.
- [ ] Servicio + integración en los servicios afectados.
- [ ] Endpoint admin de consulta (`GET /api/admin/audit?...`).

### A10. % de finalización y tramos más rebobinados (analíticas)
- 📁 `services/AnalyticsService.java` (nuevos métodos), `repositories/LogRepository.java` (nuevas queries JPQL), `dto/VideoCompletionDto.java`, frontend.
- 🧾 Memoria 6.8.5: *"Detalle por vídeo: total de reproducciones, espectadores únicos, **porcentaje medio de finalización, tramos más rebobinados (cuando estén disponibles)**"*. ❌ Solo está implementado total y únicos. % de finalización requiere `MAX(segundos_vistos) / duracion` por sesión. "Tramos más rebobinados" no tiene fuente de datos: el heartbeat sólo manda intervalo fijo de 5 s.
- 🎯 Decidir: (a) implementar % de finalización (fácil) y *retirar* lo de "tramos rebobinados" (no es trivial: hace falta capturar eventos de `seek` en el cliente y persistirlos); o (b) implementar ambos.
- [ ] % de finalización: query `(MAX(segundos_vistos) / videos.duracion)` agregada por usuario.
- [ ] (Opcional) registrar `seek_back` events en cliente y persistir en una tabla `playback_events`.

### A11. Ranking de usuarios por consumo
- 📁 `services/AnalyticsService.java`, `repositories/LogRepository.java`, endpoint nuevo `GET /api/grupos/{id}/analiticas/usuarios`, frontend en `features/groups/.../group-analytics`.
- 🧾 Memoria 6.8.5: *"Ranking de usuarios: quiénes consumen más contenido dentro del grupo, útil en contextos de formación interna o cumplimiento."*. ❌ No existe ningún endpoint que devuelva top usuarios.
- 🎯 Implementar con `SELECT id_usuario, SUM(segundos_vistos) ... GROUP BY id_usuario ORDER BY suma DESC` filtrado por grupo.
- [ ] Endpoint + tabla en panel de analíticas del grupo.

### A12. Filtros temporales con presets (últimos 7/30/90 días o rango)
- 📁 `features/analytics/analytics.component.ts/html` y `features/groups/.../group-analytics`.
- 🧾 Memoria 6.8.5: *"Filtro temporal: restringir cualquier informe a un intervalo concreto (últimos 7, 30, 90 días o rango personalizado)."*. El backend acepta `desde`/`hasta` (ya está). **No hay UI con presets ni date picker** en los componentes de analíticas.
- 🎯 Implementar pestañas/botones de presets + date picker para "personalizado".
- [ ] Componente de filtro temporal compartido.

### A13. Terminación TLS y redirección HTTP→HTTPS
- 📁 `docker-compose.yml`, opcional `nginx-host/` con Caddy o Traefik, o nuevo `nginx-proxy/Dockerfile`. También `application.properties` para `server.use-forward-headers=true` si aplica.
- 🧾 Memoria 6.1: *"Nginx aporta terminación de TLS, redirección HTTP -> HTTPS, compresión, buffering de respuestas…"*. ❌ El `docker-compose.yml` solo expone puerto 80 sin TLS. No hay redirección HTTP→HTTPS. No hay certificados.
- 🎯 Decidir: (a) añadir Caddy/Traefik como reverse proxy con ACME automático y certificados Let's Encrypt; o (b) retirar TLS de la doc y aclarar que el TLS lo debe poner el operador en el host. Para defensa, (a) impresiona más.
- [ ] Añadir servicio `caddy` o `traefik` al compose, o documentar la opción (b).

### A14. Prometheus como contenedor
- 📁 `docker-compose.yml` (nuevo servicio `prometheus`), nuevo `prometheus/prometheus.yml`.
- 🧾 Memoria 6.1 y 6.4: *"el contenedor `prometheus` (opcional en desarrollo) consume las métricas"*. ❌ No hay contenedor Prometheus. Sí está expuesto el endpoint `/actuator/prometheus` ✅, pero nadie lo consume.
- 🎯 Añadir servicio `prometheus` con su YAML de scraping, y opcionalmente Grafana con un dashboard preconfigurado. O retirar de la doc.
- [ ] Servicio + config + dashboard.

### A15. Nginx como servicio separado, punto de entrada único
- 📁 `docker-compose.yml`.
- 🧾 Memoria 6.4: *"el contenedor `nginx` publica los puertos 80/443 y enruta el tráfico"*. ❌ El Nginx vive **dentro del contenedor `frontend`**. No hay servicio Nginx independiente. El backend está expuesto directamente al host por el puerto 8080.
- 🎯 Decidir: (a) extraer Nginx a su propio servicio y dejar el backend solo accesible por red interna (más correcto), o (b) cambiar la documentación.
- [ ] Reestructurar compose (recomendado por seguridad: ocultar el puerto 8080).

### A16. Seed SQL para el primer administrador
- 📁 Nuevo `src/main/resources/db/migration/V11__seed_admin_optional.sql` (con flag de Flyway) o `src/main/resources/data.sql`, o script `scripts/seed-admin.sh`.
- 🧾 Memoria 6.9: *"El primer usuario administrador puede crearse mediante un seed SQL incluido en el repositorio o mediante una llamada controlada al endpoint de registro."*. ❌ No hay seed.
- 🎯 Crear un script idempotente que cree un usuario `admin@lockstrm.local` con hash BCrypt parametrizable (o leerlo del `.env`).
- [ ] Decidir mecanismo y publicarlo.

---

## 🟠 PRIORIDAD MEDIA — Funcionalidad parcial o detalles que el manual deja entrever

### M1. Protección "no expulsarse a uno mismo sin ceder antes"
- 📁 `services/GroupService.java#expulsarMiembro` y `#cambiarRolMiembro`.
- 🧾 Memoria 6.5.2: *"impiden, por ejemplo, eliminar al último SUPER_ADMIN o expulsarse a uno mismo sin ceder antes el rol"*. El código sí protege al SUPER_ADMIN como inmutable, pero **no existe explícitamente** la regla "un ADMIN no puede expulsarse a sí mismo". Hay que añadir guarda o verificarla manualmente.
- 🎯 Añadir validación `if (objetivo.equals(solicitante)) throw new …`.
- [ ] Comprobación + test manual.

### M2. Formatos de vídeo aceptados (coherencia)
- 📁 `services/VideoMimeValidator.java` y manual 6.8.4.
- 🧾 Memoria: *"Formatos admitidos: MP4 (recomendado), WebM y MOV"*. Código acepta también `MKV`, `AVI`, `M4V`.
- 🎯 Decidir: ampliar la doc (más permisivo) o restringir el validador a los 3 anunciados. Inclínome por ampliar la doc — es gratis.
- [ ] Actualizar uno u otro.

### M3. Cuota de 5 GB por usuario — visibilidad en UI
- 📁 `features/profile/` o `features/settings/`, ya hay endpoint `GET /api/videos/espacio` ✅, pero no se documenta ni se ve en la interfaz como progreso.
- 🧾 README sí lo describe; la memoria **no**. Si la memoria va a presentarlo como feature, debe haber un widget visible (barra de progreso de espacio usado).
- 🎯 Mostrar en perfil o en el header un indicador "X.X GB / 5 GB" + bloqueo de subida con mensaje claro cuando se supera.
- [ ] Widget en UI + manejo de error 413.

### M4. Mensaje genérico en forgot-password (no revelar si el correo existe)
- 📁 `controllers/AuthController.java#forgot-password`, `services/PasswordResetService.java`.
- 🧾 Memoria 6.8.1: *"por seguridad, no se indica si el correo existe o no en el sistema"*. Verificar que la respuesta es siempre `200 OK` con el mismo mensaje, exista o no el correo. Si no es así, ajustar.
- [ ] Auditar respuesta del endpoint.

### M5. Persistencia del volumen del reproductor
- 📁 `features/videos/video-player/video-player.component.ts` (ya guarda `speed` en `localStorage`).
- 🧾 Memoria 9: implícito en "el control de volumen con persistencia entre sesiones". Verificar que se guarde también `volume` con la misma estrategia.
- [ ] Comprobar y, si falta, persistir.

### M6. "Estados vacíos contextualmente orientados a la acción"
- 📁 Todas las vistas de listado (`features/groups/groups.component.html`, `features/videos/videos.component.html`, `features/analytics`).
- 🧾 Memoria 6.6.1: *'cuando no hay datos que mostrar (un grupo sin vídeos, un usuario sin grupos), aparece un mensaje contextual orientado a la acción ("Aún no tienes grupos. Pide a un administrador que te invite o crea uno si tienes permisos")'*. Hay que **auditar** cada pantalla y asegurar que existe ese mensaje.
- [ ] Pasada por todas las pantallas de listado.

### M7. Indicador "primera reproducción puede tardar por SW"
- 📁 `features/videos/video-player/video-player.component.ts` (o un toast desde `VideoStreamService`).
- 🧾 Memoria 6.8.2: *"Nota técnica visible al usuario: la primera vez que se reproduce un vídeo desde un navegador, este puede tardar uno o dos segundos en activar el componente que protege la entrega (Service Worker)"*. La nota está en el manual pero **no hay nada en la UI** que la transmita. Si la memoria lo describe como UX, debería existir un loader/toast.
- 🎯 Mostrar un mensaje "Preparando reproductor seguro…" en la primera carga.
- [ ] Tooltip o pantalla de carga específica.

### M8. Vista de "Permisos del vídeo" granular
- 📁 Frontend `features/videos/` o `features/groups/group-detail/group-videos/`. Backend ya tiene endpoints de edición de grupos del vídeo ✅.
- 🧾 Memoria 6.8.5: *"Si la organización necesita un control más fino —por ejemplo, restringir un vídeo concreto a un subconjunto de miembros— se puede definir un permiso explícito desde 'Permisos del vídeo'"*.
- ❌ Importante: el modelo actual solo permite asignar grupos a un vídeo (`PermisosGrupo`), no usuarios individuales. La frase de la memoria sugiere granularidad usuario-a-usuario *dentro de un grupo*, que no existe en el modelo. Decidir:
- 🎯 (a) Implementar permiso explícito por usuario (`entities/VideoUserPermission.java`, migración, lógica de combinación con permisos de grupo), o (b) **retirar de la memoria** y limitar el discurso a "permisos por grupo" (más honesto con el modelo actual).
- [ ] Decidir; (b) es lo razonable.

### M9. Avatares: documentar límites
- 📁 `services/UserService.java` (`MAX_AVATAR_SIZE = 5 MB`), manual 6.8.2.
- 🧾 Memoria 6.8.2: *"tamaño máximo razonable para evitar imágenes pesadas"*. Documentar el límite real (5 MB). Coherente, pero el manual debería citarlo en concreto.
- [ ] Aclarar en doc o tooltip.

### M10. Cambiar correo (`PUT /api/usuarios/email`) — confirmación
- 📁 `controllers/UserController.java`, manual 6.8.2.
- 🧾 Memoria: *"Modificar su correo electrónico (puede requerir confirmación, según configuración)"*. Verificar si hay flujo de confirmación por correo. Si no lo hay, retirar "según configuración" y describir el cambio como inmediato.
- [ ] Verificar comportamiento real y alinear.

### M11. Mensaje uniforme 401/403 sin revelar nada
- 📁 `exceptions/GlobalExceptionHandler.java`.
- 🧾 Memoria 6.5.1 y 9: *"los 403 no distinguen entre 'no tienes rol suficiente' y 'no perteneces al recurso'"*. Verificar que todos los `AccessDeniedException` lanzados (varios en `GroupService`: *"El rol SUPER_ADMIN…"*, *"El SUPER_ADMIN (creador del grupo) no puede ser expulsado"*) **devuelven mensaje genérico** al cliente, no la cadena exacta del throw.
- [ ] Revisar handler y asegurar que el body de respuesta sea genérico ("No tienes permisos suficientes"), aunque el log interno guarde el detalle.

### M12. Volúmenes Docker para uploads en producción
- 📁 `docker-compose.yml` actual: usa **bind mounts** (`./uploads/videos:/var/lockstrm/videos`), no volúmenes Docker.
- 🧾 Memoria 6.9: *"los datos de la base de datos persisten en un volumen Docker dedicado, de modo que el contenido sobrevive a los reinicios"*. La BD sí usa volumen Docker (`mysql_data`). Los vídeos usan bind mount al directorio del repo, que no es lo más ortodoxo en producción. Si se documenta como "volumen dedicado", quizá convenga migrarlos a volúmenes con nombre.
- 🎯 Cambiar a `lockstrm_videos`, `lockstrm_thumbnails`, etc. con nombre, y conservar los bind mounts solo para desarrollo (vía `docker-compose.override.yml`).
- [ ] Reorganizar volúmenes.

### M13. Forgot password — caducidad del token configurable
- 📁 `application.properties` define `lockstrm.reset-token.expiry-minutes` (30 por defecto) ✅. Manual lo cita pero sin valor. Solo afecta a la memoria, no al código.
- 🎯 Documentar el valor por defecto.
- [ ] Doc.

---

## 🟡 PRIORIDAD BAJA — Pulido y coherencia documental

### B1. Inconsistencia README ↔ código
- 📁 `README.md`.
- ❌ Roles: README dice `VIEWER → EDITOR → ADMIN → SUPER_ADMIN`. Código y memoria: `MIEMBRO → EDITOR → ADMIN → SUPER_ADMIN`.
- ❌ `ddl-auto=update` en README; código real: `validate` por defecto en compose.
- ❌ Falta Flyway y Spring Security en la tabla de Stack del README.
- 🎯 Corregir el README.
- [ ] Actualizar README.

### B2. Health check de mail desactivado pero el manual menciona correo
- 📁 `application.properties`: `management.health.mail.enabled=false`.
- 🧾 No es contradicción crítica, pero conviene comentar por qué (no hay SMTP por defecto, se activa al configurar). Documentar en `MANUAL_DE_DESPLIEGUE.md` (o sección 6.9 de la memoria).
- [ ] Doc.

### B3. Cache de Nginx para streaming de vídeo
- 📁 `lockstrm-front/nginx.conf` y `services/VideoController.java` cabeceras de respuesta.
- 🧾 Memoria 6.1: *"Nginx […] buffering de respuestas"*. El streaming **no debería bufferearse en Nginx** (rompe el seek) y la propia memoria 6.5.3 lo dice: *"Nginx está configurado de manera que no haga buffering en la ruta de streaming"*. Pero el `nginx.conf` actual **no tiene ningún `proxy_buffering off;` para `/api/videos/stream/`**. En la práctica Nginx con un response 206 hace bypass, pero declararlo explícitamente es mejor higiene.
- 🎯 Añadir bloque `location ^~ /api/videos/stream/ { proxy_buffering off; proxy_request_buffering off; … }`.
- [ ] Pequeño cambio en nginx.conf.

### B4. Banner / aviso de cookies / RGPD
- 📁 Frontend.
- 🧾 La memoria invoca RGPD y "ENS" como motor del producto pero **la app no incluye un aviso legal ni política de privacidad**. Si se va a alegar RGPD, lo mínimo es un enlace en el footer y una política en `/legal`.
- 🎯 Añadir página estática `/legal/privacidad` con texto plantilla.
- [ ] Página simple.

### B5. Lista de incidencias (apartado 8) en código y en doc
- 📁 No es de código directamente, pero los issues/PRs citados (#11, #14, #15, #17, #18, #25, #26 hasta #26 en el log de git) viven en GitHub. Conviene **exportarlos a una tabla** que el evaluador pueda consultar sin abrir GitHub.
- 🎯 Generar `INCIDENCIAS.md` o tabla al final de la memoria, con fecha, PR, descripción, fix y commit.
- [ ] Generación del documento.

### B6. Página/sección "Acerca de" o "Estado del sistema"
- 📁 Frontend.
- 🧾 La memoria habla mucho de observabilidad, Actuator y Prometheus. Sería convincente añadir una pantalla `/admin/estado` que muestre `/actuator/health` (a ADMIN/SUPER_ADMIN) — coste muy bajo, impacto alto en demo.
- [ ] Vista simple.

### B7. Internacionalización (i18n)
- 📁 Frontend, `angular.json`.
- 🧾 La memoria no la promete; los apartados de "Propuestas de mejora" (faltan, ya señalado en la revisión anterior) deberían anotarla.
- [ ] No-op, sólo apuntar en mejoras.

---

## 📌 Resumen — Lo que toca implementar vs lo que toca retirar de la doc

| ID | Tema | Recomendación |
|---|---|---|
| A1 | Campo `descripcion` del vídeo | **Implementar**. Es trivial y la memoria lo afirma. |
| A2 | JWT en memoria | **Retirar de la doc** (o convertirlo en "propuesta de mejora"). |
| A3 | Exportación CSV | **Implementar** (un endpoint y un botón; barato). |
| A4 | Cesión de SUPER_ADMIN | **Retirar de la doc** y documentar que el SUPER_ADMIN es inmutable, salvo borrado del grupo. Implementarlo es muy invasivo. |
| A5 | ConfirmDialog reutilizable | **Implementar**. Eleva calidad de UI y la doc lo afirma. |
| A6 | Atajos de teclado | **Implementar**. Una tarde de trabajo y la memoria lo afirma. |
| A7 | Control de velocidad UI | **Implementar**. La mitad está hecha. |
| A8 | Filtro por fecha en catálogo | **Implementar** o aclarar que es "ordenar por fecha". |
| A9 | Auditoría de acciones | **Implementar** o suavizar la afirmación de la memoria. Implementación recomendada con tabla `audit_log` por su valor real. |
| A10 | % finalización / rebobinados | **Implementar % de finalización** (fácil) y **retirar rebobinados** (caro). |
| A11 | Ranking de usuarios | **Implementar**. Una query JPQL y una tabla en UI. |
| A12 | Filtros temporales con presets | **Implementar** en UI; el backend ya está. |
| A13 | TLS / HTTPS | **Retirar del compose** o añadir Caddy/Traefik. Para producción, lo segundo. |
| A14 | Contenedor Prometheus | **Retirar de la doc** o añadirlo (con Grafana). Para defensa, añadirlo impresiona. |
| A15 | Nginx como servicio separado | **Reestructurar compose** o reescribir el apartado 6.4. |
| A16 | Seed SQL del primer admin | **Implementar**. Es un fichero SQL. |
| M1 | Auto-expulsión | **Implementar**. |
| M2 | Formatos MKV/AVI | **Aclarar** en la doc. |
| M3 | Cuota 5 GB visible | **Implementar widget**. |
| M4 | Forgot pwd genérico | **Auditar**. |
| M5 | Persistir volumen | **Verificar**. |
| M6 | Estados vacíos contextual | **Auditar**. |
| M7 | Aviso SW primera carga | **Implementar toast**. |
| M8 | Permisos granulares por usuario | **Retirar de la doc**. |
| M9 | Límite avatar | **Documentar 5 MB**. |
| M10 | Confirmación cambio correo | **Verificar y alinear**. |
| M11 | 401/403 genéricos | **Verificar handler**. |
| M12 | Volúmenes Docker con nombre | **Reorganizar compose**. |
| M13 | Caducidad token reset | **Doc**. |
| B1 | README desactualizado | **Corregir README**. |
| B2 | Health mail | **Doc**. |
| B3 | `proxy_buffering off` para streaming | **Pequeño cambio nginx**. |
| B4 | Aviso RGPD / política privacidad | **Página plantilla**. |
| B5 | Tabla de incidencias | **Generar doc**. |
| B6 | Pantalla de estado/Actuator | **Pequeña vista admin**. |
| B7 | i18n | **Sólo en propuestas**. |

---

## Plan de ataque sugerido (ordenado por ROI)

1. **Tarde 1 (alta visibilidad, bajo coste):** A1 (`descripcion` vídeo), A6 (atajos teclado), A7 (velocidad), A8 (filtro fecha), A5 (ConfirmDialog), M1 (auto-expulsión). → la app responde a todo lo que el manual promete que un usuario hace.
2. **Tarde 2 (analíticas):** A11 (ranking), A12 (presets temporales), A10 parcial (% finalización). → el panel de analíticas cumple la memoria.
3. **Tarde 3 (despliegue):** A13 (Caddy con TLS), A14 (Prometheus + Grafana), A15 (Nginx separado), M12 (volúmenes con nombre). → arquitectura coherente con 6.4.
4. **Tarde 4 (limpieza + auditoría):** A9 (auditoría), A16 (seed), A3 (CSV). → completa los puntos honestamente pendientes.
5. **Pulido**: cualquier B-x + corregir README + alinear las afirmaciones que no se vayan a implementar.

Si el tiempo aprieta, lo que **no** se implemente debe **retirarse de la memoria** antes de la entrega: dejar afirmaciones falsas en un documento técnico es peor que reconocer un alcance recortado.
