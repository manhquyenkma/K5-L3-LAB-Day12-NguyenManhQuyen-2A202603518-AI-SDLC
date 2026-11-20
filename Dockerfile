# Docker image nhẹ cho Đảo Đèn Lồng v1.0.0 (Contract v1.3)
# Xây dựng: docker build -t dao-den-long:1.0.0 .
# Chạy:     docker run --rm -p 8080:8080 dao-den-long:1.0.0
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js headless.js bench.js soak.js game.contract.json LICENSE CREDITS.md CHANGELOG.md ./
COPY src ./src
COPY lib ./lib
COPY public ./public

EXPOSE 8080
CMD ["node", "server.js"]
