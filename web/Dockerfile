# Imagem Docker da versão web do Animalia Cash, em duas etapas:
#   1. "build": o Node instala as dependências, roda os testes e gera o site (pasta dist)
#   2. "final": um servidor Nginx leve entrega só os arquivos prontos (sem Node nem código-fonte)
#
# Construir:  docker build -t animaliacash-web ./web
# Rodar:      docker run -p 8080:80 animaliacash-web   →  http://localhost:8080

# ---------- Etapa 1: gerar o site ----------
FROM node:22-alpine AS build
WORKDIR /app

# Instala as dependências primeiro (camada reaproveitada enquanto o package-lock não mudar)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Se algum teste falhar, a imagem não é criada
RUN npm test && npm run build

# ---------- Etapa 2: servir o site ----------
FROM nginx:1.27-alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# O Docker confere sozinho se o site está respondendo
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
