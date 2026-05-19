FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

# Install devDependencies too (prisma CLI). Coolify may pass NODE_ENV=production as a
# build-arg which would otherwise omit devDependencies and break the entrypoint.
RUN npm install --include=dev

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

COPY . .

RUN test -f prisma/schema.prisma || (echo "Missing prisma/schema.prisma in build context" && exit 1)

RUN npm run prisma:generate

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
