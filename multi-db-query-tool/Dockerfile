FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
ENV BIND_HOST=0.0.0.0
EXPOSE 3000 5000
CMD ["npm", "start"]
