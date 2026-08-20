# -------------------------------------------------------------------
# Stage 1: Build Environment (Full Node 20 with pre-installed Git & OpenSSL)
# -------------------------------------------------------------------
FROM node:20 AS builder

ARG REPO_URL=https://github.com/Peas4nt/CustomMCLaucher.git
ARG BRANCH=master

WORKDIR /workspace

# Clone ONLY the server/ directory using Git Sparse-Checkout
RUN git clone --depth 1 --filter=blob:none --sparse --branch ${BRANCH} ${REPO_URL} repo && \
    cd repo && \
    git sparse-checkout set server

WORKDIR /app

# Copy server files
RUN cp -a /workspace/repo/server/. /app/

# Install dependencies, generate Prisma client, and compile TypeScript
RUN npm install --prefer-offline --no-audit
RUN npx prisma generate
RUN npm run build

# Create directories for persistent volumes
RUN mkdir -p /app/uploads/news /app/storage /app/data

# -------------------------------------------------------------------
# Stage 2: Production Server Runner
# -------------------------------------------------------------------
FROM node:20 AS runner

WORKDIR /app

# Copy fully built app and node_modules from builder
COPY --from=builder /app /app

# Environment configuration
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/data/prod.db"
ENV CORS_ORIGIN="*"

EXPOSE 4000

# Initialize SQLite database schema on boot and start server
CMD ["sh", "-c", "npx prisma db push --schema=/app/prisma/schema.prisma --skip-generate && npm run start"]
