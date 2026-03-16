# =============================================
# STAGE 1: BUILD
# Compila el proyecto con Maven y Java 21
# =============================================
FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /app

# Copiamos el pom primero para aprovechar la cache de capas de Docker
# Si el pom no cambia, Docker reutiliza la capa de dependencias
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copiamos el codigo fuente y compilamos
COPY src ./src
RUN mvn clean package -DskipTests -B

# =============================================
# STAGE 2: RUN
# Imagen final ligera solo con el JRE
# La imagen de build (~700MB) queda descartada
# =============================================
FROM eclipse-temurin:21-jre-alpine AS run

WORKDIR /app

# Copiamos unicamente el .jar generado en la etapa anterior
COPY --from=build /app/target/lockstrm-plataforma-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
