# =============================================
# STAGE 1: BUILD
# Compila la app Angular con Node
# =============================================
FROM node:20-alpine AS build

WORKDIR /app

# Copiamos manifiestos primero para cache de dependencias
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copiamos el resto del codigo y compilamos en modo produccion
COPY . .
RUN npm run build

# =============================================
# STAGE 2: RUN
# Servidor Nginx ligero solo con los estaticos
# La imagen de Node (~400MB) queda descartada
# =============================================
FROM nginx:alpine AS run

# Copiamos nuestra configuracion personalizada de Nginx (SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos los estaticos generados por Angular
# El builder @angular/build:application genera en dist/{nombre}/browser/
COPY --from=build /app/dist/lockstrm-front/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
