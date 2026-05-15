# Frontend Dockerfile
FROM node:20 AS build
WORKDIR /app

# Build arguments for environment variables
ARG VITE_API_BASE_URL
ARG VITE_AZURE_REDIRECT_URI

# Set environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AZURE_REDIRECT_URI=$VITE_AZURE_REDIRECT_URI

COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
EXPOSE 4000
RUN rm -rf /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
