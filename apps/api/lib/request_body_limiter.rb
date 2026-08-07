require "json"
require "stringio"
require_relative "csv_import_limits"

class RequestBodyLimiter
  ADMIN_PATH = %r{\A/admin/mcp(?:\.[^/]+)?/?\z}
  MCP_PATH = %r{\A/mcp(?:\.[^/]+)?/?\z}
  ANALYTICS_PATH = %r{\A/analytics/events(?:\.[^/]+)?/?\z}
  IMPORT_PATH = %r{\A/imports/(?:people|gifts)(?:\.[^/]+)?/?\z}
  OAUTH_REGISTRATION_PATH = %r{\A/oauth/register(?:\.[^/]+)?/?\z}
  EXCHANGE_PHOTO_PATH = %r{\A/gift_exchanges/\d+/exchange_participants/\d+/exchange_wishlist_items/\d+(?:\.[^/]+)?/?\z}
  EXCHANGE_PHOTO_BODY_LIMIT = 5 * 1024 * 1024 + 256 * 1024
  OAUTH_PATH = %r{\A/oauth/(?:authorize(?:/consent)?|token|register|revoke)(?:\.[^/]+)?/?\z}
  DEFAULT_MUTATION_LIMIT = 256 * 1024
  MUTATION_METHODS = %w[POST PUT PATCH DELETE].freeze
  LIMITS = {
    ADMIN_PATH => 256 * 1024,
    MCP_PATH => 256 * 1024,
    ANALYTICS_PATH => 256 * 1024,
    OAUTH_PATH => 256 * 1024,
    IMPORT_PATH => CsvImportLimits::MAX_FILE_BYTES
  }.freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    path = env["PATH_INFO"].to_s
    limit = EXCHANGE_PHOTO_BODY_LIMIT if EXCHANGE_PHOTO_PATH.match?(path) && multipart_request?(env)
    limit ||= LIMITS.find { |pattern, _bytes| pattern.match?(path) }&.last
    mutation = MUTATION_METHODS.include?(env["REQUEST_METHOD"])
    limit ||= DEFAULT_MUTATION_LIMIT if mutation
    return @app.call(env) unless limit && mutation

    declared_length = env["CONTENT_LENGTH"].to_i
    return too_large(env) if declared_length > limit

    input = env.fetch("rack.input")
    body = input.read(limit + 1) || ""
    return too_large(env) if body.bytesize > limit

    input.rewind
    env["CONTENT_LENGTH"] = body.bytesize.to_s
    @app.call(env)
  end

  private

  def multipart_request?(env)
    env["CONTENT_TYPE"].to_s.downcase.start_with?("multipart/form-data;")
  end

  def too_large(env)
    admin = ADMIN_PATH.match?(env["PATH_INFO"].to_s)
    mcp = MCP_PATH.match?(env["PATH_INFO"].to_s)
    analytics = ANALYTICS_PATH.match?(env["PATH_INFO"].to_s)
    import = IMPORT_PATH.match?(env["PATH_INFO"].to_s)
    message = if admin
      "Admin MCP request is too large"
    elsif mcp
      "MCP request is too large"
    elsif analytics
      "Analytics request is too large"
    elsif import
      "CSV import is too large"
    elsif OAUTH_PATH.match?(env["PATH_INFO"].to_s)
      "OAuth request is too large"
    else
      "Request body is too large"
    end
    headers = {
      "Content-Type" => "application/json",
      "Cache-Control" => "no-store, private",
      "Pragma" => "no-cache",
      "X-Content-Type-Options" => "nosniff",
      "Referrer-Policy" => "no-referrer"
    }
    [ 413, headers, [ JSON.generate(error: message) ] ]
  end
end
