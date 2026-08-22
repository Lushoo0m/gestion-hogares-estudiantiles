# Imagen mínima: Node puro, sin build step (la app no tiene ninguno).
FROM node:20-alpine

WORKDIR /app
COPY . .

# Carpeta de datos por defecto dentro del contenedor. En Coolify, DATA_DIR
# se puede pisar con una variable de entorno apuntando a un volumen montado,
# para que el estado sobreviva a un redeploy de la imagen.
RUN mkdir -p /app/data
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
