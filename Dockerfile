# Usa la imagen base de Node.js
FROM node:22

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de package.json y package-lock.json
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto de los archivos de la aplicación
COPY . .

# Exponer el puerto en el que tu aplicación correrá
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["node", "server.js"]
