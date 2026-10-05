FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# No VITE_API_URL here on purpose: leaving it unset makes the app call the
# relative path /api (see src/api/axios.js), which nginx below proxies to
# the backend. That way the built bundle works from any device/host that
# loads the page — desktop, or a phone on the same network — instead of
# a fixed "localhost" address baked in at build time.
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]
