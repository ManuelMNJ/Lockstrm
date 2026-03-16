Lockstrm - Plataforma de Video (Entrega)
Aqui dejo la documentacion de mi proyecto para la entrega. Lo he dividido en dos partes principales: el backend hecho con Spring Boot (Java) y el frontend con Angular 17.

Abajo explico punto por punto como he ido cumpliendo los requisitos que pedias en los ejercicios:

1. Implementacion de una API Rest para almacenar la informacion
   Toda la parte del backend funciona como una API REST que he montado con Spring Boot. Las rutas y los endpoints estan en la carpeta controllers/.

Ahi tengo el AuthController.java (para gestionar el login y el registro).

El VideoController.java (para manejar la subida y el listado de los videos).

El UserController.java (para los usuarios).
Todo el intercambio de datos entre el frontend y el backend lo hago en formato JSON.

2. Consultas e insercion de informacion sobre la API Rest, utilizando un ORM
   Como base de datos estoy usando MySQL 8, y para la parte del ORM he tirado de Hibernate y Spring Data JPA.

Las entidades de la base de datos estan mapeadas en la carpeta entities/ usando las tipicas anotaciones de @Entity, @Id, etc.

Para no hacer consultas SQL a pelo, he usado repositorios en la carpeta repositories/ (como el VideoRepository.java) que extienden de JpaRepository. Ademas, para la parte de los grupos me toco implementar claves compuestas con @EmbeddedId en las tablas intermedias para que la base de datos quedara bien estructurada.

3. Encriptacion de claves de usuarios
   Obviamente las contraseñas no se guardan en texto plano. Para esto he usado BCrypt con Spring Security.

La configuracion la meti en un archivo llamado PasswordConfig.java.

De esta forma, cuando alguien se registra a traves del AuthController.java, su contraseña se encripta directamente antes de hacer el guardado en la bd.

Tambien he metido tokens JWT para manejar las sesiones de los usuarios de forma mas segura.

4. Uso de patrones de diseño
   He intentado aplicar varios patrones para organizar un poco el codigo y que no sea un caos:

Patron MVC: Esta bastante claro al separar los Modelos (las entidades de JPA), las Vistas (el proyecto de Angular) y los Controladores (los @RestController de Spring).

Patron DTO (Data Transfer Object): Me di cuenta de que devolver las entidades enteras al front era mala idea por temas de seguridad, asi que cree unas clases en la carpeta dto/ (como LoginRequest o AuthResponse) para pasar solo los datos estrictamente necesarios.

5. Planificacion del despliegue de la aplicacion
   Para el tema del despliegue me he montado todo con Docker para que sea facil de levantar en cualquier sitio sin problemas de dependencias.

En la raiz del proyecto deje un archivo docker-compose.yml que te levanta de golpe los tres contenedores que necesito: la base de datos de MySQL, el backend de Java y el frontend servido con Nginx.

Con hacer un docker compose up ya estaria todo corriendo.

6. Uso de Frameworks de Frontend para el acceso a la API
   Todo el frontend lo he hecho con Angular (usando la version 17).

El codigo lo puedes ver dentro de la carpeta lockstrm-front/.

He usado la sintaxis nueva de Standalone Components para no liarme tanto con los modulos.

Para conectarme con la API del backend uso HttpClient y me cree un interceptor (jwt.interceptor.ts) para que le meta el token de seguridad a las cabeceras de las peticiones automaticamente.

7. Uso de los contenidos vistos en el modulo de Diseño de Interfaces Web para el diseño
   Para el diseño no he querido usar plantillas prefabricadas tipo Bootstrap. Lo he maquetado desde cero basandome en lo que dimos en el modulo de interfaces:

Me monte un sistema propio con variables globales de CSS para hacer un 'Dark Mode' coherente en toda la app.

He intentado cuidar bastante la accesibilidad usando etiquetas semanticas y metiendo mensajes visuales de colores para cuando el usuario sube algun video (para que sepa si esta cargando, si ha subido bien o si ha dado error).