# ── Stage 1: Build React Frontend ─────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/Frontend
COPY Frontend/package*.json ./
RUN npm install
COPY Frontend/ ./
ARG VITE_API_URL=/api
ARG VITE_GROQ_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GROQ_API_KEY=$VITE_GROQ_API_KEY
RUN npm run build

# ── Stage 2: Run Express Backend + Serve Frontend ─────────────
FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production
COPY backend/ ./

# Copy built React app from Stage 1 into correct path
# server.js looks for: ../../Frontend/dist (relative to backend/src/)
# which resolves to:   /app/Frontend/dist
COPY --from=frontend-build /app/Frontend/dist /app/Frontend/dist

EXPOSE 5000
CMD ["node", "src/server.js"]