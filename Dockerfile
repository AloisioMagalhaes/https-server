FROM node:18-alpine

WORKDIR /usr/src/app

# Instale o TypeScript globalmente
RUN npm install -g typescript @types/node tslib typedoc

# Copie dependências e instale
COPY package.json tsconfig.json ./
RUN npm install ci

# Copie código-fonte e compile
COPY ./src ./src
RUN npm run build

EXPOSE 443
CMD ["node", "dist/server.js"]