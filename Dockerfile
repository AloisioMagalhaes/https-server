FROM node:22-alpine

# Define o diretório de trabalho
WORKDIR /usr/src/app

# Copia package.json e instala dependências
COPY package*.json ./
RUN npm install

# Copia o código-fonte e compila (se necessário)
COPY . .
RUN npm run build  # Ajuste conforme o script de build do projeto

# Executa o servidor
EXPOSE 443
CMD ["node", "dist/server.js"]  # Garanta que o caminho esteja correto