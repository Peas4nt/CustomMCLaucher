# -------------------------------------------------------------------
# Stage 1: Git Sparse Checkout (Downloads ONLY the "server" directory)
# -------------------------------------------------------------------
FROM alpine/git:latest AS git-cloner

ARG REPO_URL=https://github.com/Peas4nt/CustomMCLaucher.git
ARG BRANCH=main

WORKDIR /workspace

# Perform sparse-checkout to download ONLY the server/ directory
RUN git clone --depth 1 --filter=blob:none --sparse --branch ${BRANCH} ${REPO_URL} repo && \
    cd repo && \
    git sparse-checkout set server

# -------------------------------------------------------------------
# Stage 2: Build & Production Server Environment
# -------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Install native tools and libraries required for Prisma & SQLite on Alpine
RUN apk add --no-cache openssl libc6-compat dumb-init

# Copy only the server files extracted from git
COPY --from=git-cloner /workspace/repo/server /app

# Install dependencies and build
RUN npm install --prefer-offline --no-audit
RUN npx prisma generate
RUN npm run build

# Create directories for persistent volumes
RUN mkdir -p /app/uploads/news /app/storage /app/prisma

# Default Environment Variables
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/prisma/prod.db"
ENV CORS_ORIGIN="*"

EXPOSE 4000

# Dumb-init handles PID 1 signal forwarding cleanly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Initialize SQLite database schema on boot and start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
