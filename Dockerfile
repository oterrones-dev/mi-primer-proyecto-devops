FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y lock para instalaciones más consistentes
COPY package*.json ./

# Instalar dependencias en modo producción
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Exponer puerto
EXPOSE 3000

# Variables recomendadas
ENV NODE_ENV=production

# Comando de arranque
CMD ["npm", "start"]
