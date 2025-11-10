# Docker Build Optimization Guide

## Why Backend Builds Are Slow

The backend Docker build takes time due to several factors:

### 1. **Native Module Compilation** (Main Bottleneck)
- **bcrypt@^6.0.0**: Needs to compile C++ code during installation (~2-5 minutes)
- **sharp@^0.34.5**: Image processing library that compiles native bindings (~3-8 minutes)
- These modules must be compiled from source when pre-built binaries aren't available

### 2. **Build Dependencies Installation**
- Installing `python3`, `make`, `g++` takes ~1-2 minutes
- Required for compiling native modules

### 3. **npm Installation Process**
- Downloading all packages from npm registry
- Resolving dependencies
- Installing and compiling native modules

### 4. **No Build Cache** (First Build)
- First build has no cached layers, so everything runs from scratch
- Subsequent builds are faster if dependencies haven't changed

## Optimizations Applied

### ✅ Current Optimizations

1. **Layer Caching**: Package files copied first, so dependency installation is cached
2. **npm Configuration**: Reduced logging and disabled unnecessary checks
3. **--prefer-offline**: Uses cached packages when available
4. **--no-audit**: Skips security audit during build (faster)
5. **--no-install-recommends**: Reduces apt package size

### 🚀 Additional Optimizations (Recommended)

#### 1. Use Docker BuildKit (Faster Builds)

Enable BuildKit for better caching and parallel builds:

```bash
# Set environment variable
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Or use inline
DOCKER_BUILDKIT=1 docker compose build backend
```

#### 2. Use npm Cache Mount (BuildKit Feature)

Update Dockerfile to use cache mount:

```dockerfile
# Mount npm cache for faster installs
RUN --mount=type=cache,target=/root/.npm \
    if [ "$NODE_ENV" = "production" ]; then \
      npm ci --omit=dev --prefer-offline --no-audit; \
    else \
      npm ci --prefer-offline --no-audit; \
    fi
```

#### 3. Use Pre-built Binaries for Sharp

Sharp has pre-built binaries for most platforms. Ensure you're using the correct platform:

```bash
# Check your platform
docker buildx inspect

# Use platform-specific build
docker buildx build --platform linux/amd64 -t backend .
```

#### 4. Multi-stage Build (Production Only)

For production, use a multi-stage build to reduce final image size:

```dockerfile
# Build stage
FROM node:20-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Production stage
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["node", "src/index.js"]
```

## Build Time Estimates

- **First Build**: 5-15 minutes (compiling native modules)
- **Subsequent Builds** (dependencies unchanged): 30 seconds - 2 minutes
- **After Code Changes Only**: 10-30 seconds (cached dependencies)
- **After Dependency Changes**: 5-15 minutes (recompiling native modules)

## Tips for Faster Development

### 1. **Keep Dependencies Stable**
- Avoid frequent package.json changes during active development
- Update dependencies in batches

### 2. **Use Local Development**
- For faster iteration, run API locally without Docker:
  ```bash
  cd api
  npm install  # One-time setup
  npm run dev  # Fast startup
  ```

### 3. **Use Docker Build Cache**
- Don't use `--no-cache` unless necessary
- Let Docker cache layers between builds

### 4. **Parallel Builds**
- If building multiple services, BuildKit builds them in parallel

## Quick Commands

```bash
# Build with BuildKit (faster)
DOCKER_BUILDKIT=1 docker compose build backend

# Build without cache (clean build)
docker compose build --no-cache backend

# View build progress
docker compose build --progress=plain backend

# Check build time
time docker compose build backend
```

## Monitoring Build Performance

```bash
# Check which layers take longest
docker compose build backend 2>&1 | grep -E "Step|RUN|CACHED"

# Inspect image layers
docker history <image-name>

# Check image size
docker images | grep backend
```

## Alternative: Use Pre-built Base Image

For even faster builds, you could create a custom base image with dependencies pre-installed:

```dockerfile
# Base image with build tools (build once, reuse)
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ postgresql-client \
    && rm -rf /var/lib/apt/lists/*
```

Then use this base image for your app builds.

