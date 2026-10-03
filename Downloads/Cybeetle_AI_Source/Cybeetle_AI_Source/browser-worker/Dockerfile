FROM node:22-bookworm
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npx playwright install --with-deps chromium
COPY *.mjs ./
RUN mkdir -p /data && chown -R node:node /app /data
USER node
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
CMD ["node","server.mjs"]
