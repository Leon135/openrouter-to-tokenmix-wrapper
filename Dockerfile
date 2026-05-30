FROM oven/bun:1-alpine
WORKDIR /app
COPY dist/ .
EXPOSE 8080
CMD ["bun", "index.js"]