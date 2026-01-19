# .idx/dev.nix
{ pkgs, ... }: {
  # Usamos el canal estable de Nix (software probado)
  channel = "stable-23.11";

  # Lista de programas a instalar en tu entorno
  packages = [
    pkgs.jdk17 
    pkgs.maven
    pkgs.mysql80
    pkgs.jq
  ];

  # Variables de entorno del sistema
  env = {
    # Definimos dónde guardará MySQL los datos dentro de tu proyecto
    MYSQL_DATA_DIR = "$PWD/.data/mysql";
  };

  # Configuración de extensiones de VS Code y scripts de inicio
  idx = {
    extensions = [
      "vscjava.vscode-java-pack" # Pack esencial para Java
      "rangav.vscode-thunder-client" # Para probar peticiones HTTP
      "cweijan.vscode-mysql-client2" # Cliente visual para ver las tablas
    ];
  # Configuración de la vista previa
    previews = {
      enable = true;
      previews = {
        web = {
          # Comando para arrancar el servidor automáticamente
          command = ["mvn" "spring-boot:run" "-Dspring-boot.run.jvmArguments='-Dserver.port=$PORT'"];
          manager = "web";
        };
      };
    };
    workspace = {
      # Se ejecuta solo la primera vez que creas el workspace
      onCreate = {
        mvn-install = "mvn clean install -DskipTests";
      };

      # Se ejecuta CADA VEZ que inicias o reinicias el entorno
      onStart = {
        # Script inteligente para manejar la base de datos automáticamente
        init-mysql = ''
          # 1. Si no existe la carpeta de datos, inicializamos MySQL
          if [ ! -d "$MYSQL_DATA_DIR" ]; then
            echo ">>> Inicializando directorio de datos MySQL..."
            mysqld --initialize-insecure --datadir="$MYSQL_DATA_DIR"
          fi
          
          # 2. Si MySQL no está corriendo, lo arrancamos
          if ! pgrep mysqld > /dev/null; then
             echo ">>> Arrancando servidor MySQL..."
             mysqld --datadir="$MYSQL_DATA_DIR" --port=3306 --bind-address=0.0.0.0 &
             
             # Esperamos 10 segundos a que arranque para configurarlo
             sleep 10
             
             # 3. Creamos la Base de Datos y el Usuario
             echo ">>> Configurando usuario y base de datos..."
             mysql -u root -e "CREATE DATABASE IF NOT EXISTS lockstrm_db;"
             # Creamos usuario 'lockstrm_user' con contraseña 'lockstrm_pass'
             mysql -u root -e "CREATE USER IF NOT EXISTS 'lockstrm_user'@'%' IDENTIFIED BY 'lockstrm_pass';"
             # Le damos todos los permisos
             mysql -u root -e "GRANT ALL PRIVILEGES ON lockstrm_db.* TO 'lockstrm_user'@'%';"
             mysql -u root -e "FLUSH PRIVILEGES;"
             
             echo ">>> ¡TODO LISTO! Base de datos 'lockstrm_db' operativa."
          fi
        '';
      };
    };

  };
}
