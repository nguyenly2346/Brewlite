FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npx nest build

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]