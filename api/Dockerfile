FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Apply database migrations, then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
