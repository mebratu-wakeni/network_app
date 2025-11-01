FROM node:20-alpine

# Install bash + PostgreSQL client
RUN apk add --no-cache bash postgresql-client

WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY package*.json ./

RUN apk add --no-cache bash && \
  if [ "$NODE_ENV" = "production" ]; then \
  npm ci --omit=dev; \
  else \
  npm ci; \
  fi

COPY . .

EXPOSE 4000

CMD ["node", "src/index.js"]