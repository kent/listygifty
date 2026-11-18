class ApplicationBlueprint < Blueprinter::Base
  identifier :id

  class << self
    # Blueprinter calls field blocks with `block.call(object, **options)`, so
    # every field of every object gets a fresh copy of the options hash and
    # anything a block memoizes into it is thrown away. A render-scoped cache
    # object survives those shallow copies, is shared with nested association
    # blueprints, and is gone when the render call returns, so it can't serve
    # stale data after a write later in the same request.
    %i[render render_as_hash render_as_json].each do |method_name|
      define_method(method_name) do |object, options = {}|
        options = options.merge(render_cache: {}) unless options.key?(:render_cache)
        super(object, options)
      end
    end

    # Memoize a value for the rest of the current render.
    def render_cached(options, key)
      cache = options[:render_cache]
      return yield unless cache

      cache.fetch(key) { cache[key] = yield }
    end
  end
end
