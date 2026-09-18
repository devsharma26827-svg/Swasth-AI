# SwasthAI Deployment Guide

This document outlines deployment options and best practices for hosting SwasthAI on free and cloud hosting platforms.

---

## Architecture Summary for Deployment

SwasthAI is packaged as a unified Node.js single-binary web service:
- **Frontend**: Vite SPA built into static assets (`dist/public` / `dist/`).
- **Backend**: Express web server bundled via `esbuild` into `dist/server.cjs`.
- **Inference Engine**: In-process JavaScript DSP engine (Cooley-Tukey Radix-2 FFT + Mel Filterbank) + `HeartSoundCNN` decision surface.
- **Port Handling**: Configured dynamically via `process.env.PORT` (defaults to `3000`).
- **Host Binding**: Binds to `0.0.0.0` for container & cloud compatibility.

---

## Option 1: Render Deployment (Recommended)

Render provides free hosting for Node.js Web Services.

### Deployment Steps on Render

1. Push your repository to GitHub.
2. Log into [Render Dashboard](https://dashboard.render.com/) and click **New + > Web Service**.
3. Connect your GitHub repository.
4. Configure service settings:
   - **Name**: `swasthai-app`
   - **Environment**: `Node`
   - **Region**: Any
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Environment Variables:
   - `NODE_ENV`: `production`
   - `ML_MODE`: `real`
   - `JWT_SECRET`: Generate a secure random 64-character secret
   - `JWT_REFRESH_SECRET`: Generate a secure random 64-character secret
6. Click **Create Web Service**.

---

## Option 2: Railway Deployment

1. Create a project on [Railway.app](https://railway.app/).
2. Select **Deploy from GitHub repo**.
3. Railway automatically detects `package.json` and runs:
   - Build: `npm run build`
   - Start: `npm start`
4. In Environment Variables, set `NODE_ENV=production` and `PORT=${{PORT}}`.

---

## Option 3: Docker Deployment

You can build a lightweight Docker image using the following `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/heart_model ./heart_model

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
```

Build and run container:
```bash
docker build -t swasthai:latest .
docker run -p 3000:3000 -e NODE_ENV=production swasthai:latest
```

---

## Platform Limitations & Considerations

- **Cold Starts**: On free tiers (e.g., Render Free Tier), web services spin down after 15 minutes of inactivity. Cold start initialization takes ~10-15 seconds for Vite bundle serving and JIT warming.
- **In-Memory Storage**: By default, user accounts and measurements reside in the `mock_store` in-memory store. Container restarts will reset active sessions unless backed by a PostgreSQL database (`DATABASE_URL`).
- **HTTPS Requirement**: Camera and microphone APIs require an SSL certificate (`https://`). Platforms like Render and Railway automatically provide HTTPS URLs (`https://your-app.onrender.com`).
