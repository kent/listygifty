# syntax=docker/dockerfile:1.7

FROM ruby:3.4.8-slim AS builder

ENV BUNDLE_WITHOUT=development:test \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_PATH=/usr/local/bundle

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      build-essential \
      git \
      libpq-dev \
      libyaml-dev \
      libvips \
      pkg-config && \
    rm -rf /var/lib/apt/lists/*

COPY Gemfile Gemfile.lock ./
RUN bundle install && rm -rf /usr/local/bundle/cache/*.gem

COPY . .
RUN bundle exec bootsnap precompile --gemfile app/ config/

FROM ruby:3.4.8-slim

ENV RAILS_ENV=production \
    RACK_ENV=production \
    BUNDLE_WITHOUT=development:test \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_PATH=/usr/local/bundle \
    RAILS_LOG_TO_STDOUT=1 \
    RAILS_SERVE_STATIC_FILES=1 \
    RUBY_YJIT_ENABLE=1

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      libjemalloc2 \
      libpq5 \
      libyaml-0-2 \
      libvips \
      postgresql-client \
      tini && \
    rm -rf /var/lib/apt/lists/*

ENV LD_PRELOAD=libjemalloc.so.2

COPY --from=builder /usr/local/bundle /usr/local/bundle
COPY --from=builder /app /app

RUN useradd --create-home --uid 1001 rails && \
    chown -R rails:rails /app

USER rails

EXPOSE 8080

ENTRYPOINT ["tini", "--"]
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
