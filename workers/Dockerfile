FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY lib/ollama.ts lib/queue.ts lib/
COPY workers/question-generator.ts workers/
COPY tsconfig.json .
RUN npx tsc --outDir dist
CMD ["node", "dist/workers/question-generator.js"]
