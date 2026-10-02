FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["node", "src/index.mjs"]
