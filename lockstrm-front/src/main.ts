// Archivo: main.ts
// Este es el punto de entrada de la aplicacion Angular.
// Aqui se arranca el componente principal usando la configuracion de la app.
import { bootstrapApplication } from '@angular/platform-browser';
// Se importa la configuracion de la aplicacion (rutas, proveedores, etc.).
import { appConfig } from './app/app.config';
// Se importa el componente raiz de la aplicacion.
import { AppComponent } from './app/app.component';

// Se inicia la aplicacion con el componente principal y la configuracion.
// Si ocurre un error al arrancar, se imprime en la consola.
bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
