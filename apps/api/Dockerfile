# syntax=docker/dockerfile:1
# ListyGifty API - Rails 8.1 Application
# Multi-stage build for production deployment on GCP Cloud Run

# Stage 1: Build stage
FROM ruby:3.4-slim AS builder

# Install build dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libyaml-dev \
    libvips \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Ruby dependencies
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install

# Copy application code and precompile bootsnap in builder stage
COPY . .
ENV RAILS_ENV=production
RUN bundle exec bootsnap precompile --gemfile app/ lib/

# Stage 2: Runtime stage
FROM ruby:3.4-slim AS runtime

# Install runtime dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    libyaml-0-2 \
    libvips \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -s /bin/bash rails

WORKDIR /app

# Copy bundled gems from builder
COPY --from=builder /usr/local/bundle /usr/local/bundle

# Copy application code with bootsnap cache from builder
COPY --from=builder --chown=rails:rails /app .

# Set environment variables
ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=true \
    RAILS_SERVE_STATIC_FILES=true \
    BUNDLE_DEPLOYMENT=true \
    BUNDLE_WITHOUT="development:test"

# Switch to non-root user
USER rails

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/up || exit 1

# Expose port (Cloud Run will set PORT env var)
EXPOSE 3000

# Start the server
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
