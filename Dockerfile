# -------------------------------------------------------------------
# Stage 1: Build Environment (Debian Slim - zero Alpine / AppArmor conflicts)
# -------------------------------------------------------------------
FROM node:20-slim AS builder

ARG REPO_URL=https://github.com/Peas4nt/CustomMCLaucher.git
ARG BRANCH=master

WORKDIR /workspace

# Install git, certificates, and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    openssl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Clone ONLY the server/ directory using Git Sparse-Checkout
RUN git clone --depth 1 --filter=blob:none --sparse --branch ${BRANCH} ${REPO_URL} repo && \
    cd repo && \
    git sparse-checkout set server

WORKDIR /app

# Copy server files
RUN cp -r /workspace/repo/server/* /app/

# Install dependencies, generate Prisma client, and compile TypeScript
RUN npm install --prefer-offline --no-audit
RUN npx prisma generate
RUN npm run build

# Create directories for persistent volumes
RUN mkdir -p /app/uploads/news /app/storage /app/prisma

# -------------------------------------------------------------------
# Stage 2: Production Server Runner
# -------------------------------------------------------------------
FROM node:20-slim AS runner

WORKDIR /app

# Install runtime SSL & process supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy fully built app and node_modules from builder
COPY --from=builder /app /app

# Environment configuration
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/prisma/prod.db"
ENV CORS_ORIGIN="*"

EXPOSE 4000

# Dumb-init handles PID 1 signal forwarding cleanly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Initialize SQLite database schema on boot and start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
