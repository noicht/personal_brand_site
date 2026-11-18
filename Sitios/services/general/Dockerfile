FROM node:22-alpine
WORKDIR /app
COPY services/general/package.json ./
RUN npm install --omit=dev
COPY services/general/src ./src
ENV HOST=0.0.0.0
ENV PORT=3100
EXPOSE 3100
CMD ["node", "src/index.js"]
