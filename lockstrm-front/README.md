# Lockstrm — Frontend

Aplicación Angular 21 que forma parte de la plataforma Lockstrm. Para levantar el proyecto completo (frontend + backend + base de datos) consulta el [`README.md`](../README.md) en la raíz del repositorio usando Docker Compose.

---

## Desarrollo local (sin Docker)

Requiere Node.js 20+ y el backend corriendo en `http://localhost:8080`.

```bash
npm install
ng serve
```

La aplicación queda disponible en `http://localhost:4200` con recarga automática al guardar cambios.

## Compilar para producción

```bash
ng build
```

Los artefactos se generan en `dist/`. En producción se sirven a través del contenedor Nginx definido en el `Dockerfile` de esta carpeta.
