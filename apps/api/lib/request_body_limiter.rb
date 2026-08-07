require "json"
require "stringio"

class RequestBodyLimiter
  ADMIN_PATH = %r{\A/admin/mcp(?:\.[^/]+)?/?\z}
  ANALYTICS_PATH = %r{\A/analytics/events(?:\.[^/]+)?/?\z}
  LIMITS = {
    ADMIN_PATH => 256 * 1024,
    ANALYTICS_PATH => 256 * 1024
  }.freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    path = env["PATH_INFO"].to_s
    limit = LIMITS.find { |pattern, _bytes| pattern.match?(path) }&.last
    return @app.call(env) unless limit && env["REQUEST_METHOD"] == "POST"

    declared_length = env["CONTENT_LENGTH"].to_i
    return too_large(env) if declared_length > limit

    body = env.fetch("rack.input").read(limit + 1)
    return too_large(env) if body.bytesize > limit

    env["rack.input"] = StringIO.new(body)
    env["CONTENT_LENGTH"] = body.bytesize.to_s
    @app.call(env)
  end

  private

  def too_large(env)
    admin = ADMIN_PATH.match?(env["PATH_INFO"].to_s)
    message = admin ? "Admin MCP request is too large" : "Analytics request is too large"
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
