// Archivo: app.config.ts
// Configuracion global de la aplicacion Angular.
// Aqui se definen los proveedores que necesita la app al arrancar.
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
// Proveedor para hacer peticiones HTTP desde la aplicacion.
import { provideHttpClient } from '@angular/common/http'; // <--- IMPORTANTE

export const appConfig: ApplicationConfig = {
  providers: [
    // Se añade el enrutador con las rutas definidas en app.routes.ts
    provideRouter(routes),
    // Se añade el cliente HTTP para comunicacion con el servidor
    provideHttpClient() // <--- ANADE ESTO (La llave de internet)
  ]
};
