FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY . .

RUN npm run prisma:generate

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
