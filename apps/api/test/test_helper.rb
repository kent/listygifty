ENV["RAILS_ENV"] ||= "test"
# Skip Clerk middleware in tests - we mock token verification
ENV["CLERK_SKIP_RAILTIE"] ||= "1"
# Set dummy Clerk secret key for tests to avoid ConfigurationError
ENV["CLERK_SECRET_KEY"] ||= "sk_test_dummy_key_for_testing"
# Photo tests feed libvips damaged files on purpose; keep its warnings out of the output.
ENV["VIPS_WARNING"] ||= "0"

require_relative "../config/environment"
require "rails/test_help"
require "minitest/mock"
require "socket"

module ActiveSupport
  class TestCase
    # All workers share one PostgreSQL test database and fixture IDs. Process
    # parallelism races fixture reloads with explicit User row-lock concurrency
    # regressions, producing nondeterministic deadlocks and FK failures. Keep the
    # documented default deterministic; individual tests still exercise threads.
    parallelize(workers: ENV.fetch("PARALLEL_WORKERS", "1").to_i)
    fixtures :all
  end
end

# Images for photo tests, made with libvips. Formats whose encoder this
# machine lacks come back nil, so their tests skip; CI installs them all.
module PhotoBytes
  PNG = Base64.decode64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
  HEIC_HEADER = "\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic".b
  LOCATION_MARKER = "SECRET-LOCATION-XMP".freeze

  module_function

  def vips
    Photos::Processor.load_vips!
    # Rails blocks these savers; only the tests need them, to make fixtures.
    %w[VipsForeignSaveMagick VipsForeignSaveJxl].each { |name| Vips.block(name, false) }
    Vips
  end

  def jpeg = cached(:jpeg) { solid.jpegsave_buffer }
  def webp = cached(:webp) { solid.webpsave_buffer }
  def gif = cached(:gif) { solid.gifsave_buffer }
  def tiff = cached(:tiff) { solid.tiffsave_buffer }
  def transparent_tiff = cached(:transparent_tiff) { half_transparent.tiffsave_buffer }
  def opaque_alpha_tiff = cached(:opaque_alpha_tiff) { solid.bandjoin(255).tiffsave_buffer }
  def bmp = cached(:bmp) { solid.magicksave_buffer(format: "bmp") }
  def ico = cached(:ico) { half_transparent(32, 32).magicksave_buffer(format: "ico") }
  def jxl = cached(:jxl) { solid.jxlsave_buffer }
  def jp2 = cached(:jp2) { solid.jp2ksave_buffer }
  def heic = cached(:heic) { solid.heifsave_buffer(compression: :hevc) }
  def avif = cached(:avif) { solid.heifsave_buffer(compression: :av1) }

  # HEIC whose main brand says plain HEIF, as some cameras write it.
  def heif
    heic&.dup&.tap { |bytes| bytes[8, 4] = "mif1" }
  end

  def animated(format)
    cached(:"animated_#{format}") do
      frames = [ [ 255, 0, 0 ], [ 0, 255, 0 ], [ 0, 0, 255 ] ].map { |colour| (vips::Image.black(20, 20, bands: 3) + colour).cast(:uchar) }
      strip = vips::Image.arrayjoin(frames, across: 1).copy
      strip.set_type(GObject::GINT_TYPE, "page-height", 20)
      strip.set_type(Vips::ARRAY_INT_TYPE, "delay", [ 100, 200, 300 ])
      strip.set_type(GObject::GINT_TYPE, "loop", 0)
      format == :gif ? strip.gifsave_buffer : strip.webpsave_buffer
    end
  end

  # A photo taken sideways (EXIF orientation 6) with a GPS tag and an XMP
  # packet. The red stripe marks its top edge as stored.
  def with_location(format)
    cached(:"with_location_#{format}") do
      image = (vips::Image.black(20, 40, bands: 3) + [ 10, 200, 10 ]).cast(:uchar).draw_rect([ 255, 0, 0 ], 0, 0, 20, 5, fill: true).copy
      image.set_type(GObject::GINT_TYPE, "orientation", 6)
      image.set_type(GObject::GSTR_TYPE, "exif-ifd3-GPSLatitudeRef", "N")
      image.set_type(GObject::GSTR_TYPE, "exif-ifd3-GPSLatitude", "43/1 39/1 0/1")
      image.set_type(Vips::BLOB_TYPE, "xmp-data", %(<x:xmpmeta xmlns:x="adobe:ns:meta/">#{LOCATION_MARKER}</x:xmpmeta>))
      image.public_send(:"#{format}save_buffer")
    end
  end

  # Two sizes in one icon, the small one first.
  def multi_size_ico
    pngs = [ 16, 48 ].map { |size| half_transparent(size, size).pngsave_buffer }
    offset = 6 + 16 * pngs.size
    entries = pngs.zip([ 16, 48 ]).map do |png, size|
      entry = [ size, size, 0, 0, 1, 32, png.bytesize, offset ].pack("CCCCvvVV")
      offset += png.bytesize
      entry
    end
    [ 0, 1, pngs.size ].pack("v3") + entries.join + pngs.join
  end

  def solid(width = 40, height = 20)
    (vips::Image.black(width, height, bands: 3) + [ 200, 80, 40 ]).cast(:uchar)
  end

  # Opaque on the left half, clear on the right.
  def half_transparent(width = 40, height = 20)
    alpha = vips::Image.black(width, height).cast(:uchar).draw_rect(255, 0, 0, width / 2, height, fill: true)
    solid(width, height).bandjoin(alpha)
  end

  def cached(key)
    @cache ||= {}
    return @cache[key] if @cache.key?(key)

    @cache[key] = begin
      yield
    rescue Vips::Error
      nil
    end
  end
end

# Serves canned HTTP responses on loopback for code that fetches links. The
# block runs with loopback allowed, which Photos::Download otherwise refuses.
module LocalHttpServer
  def with_http_server(routes)
    server = TCPServer.new("127.0.0.1", 0)
    base = "http://127.0.0.1:#{server.addr[1]}"
    thread = Thread.new do
      loop do
        client = server.accept
        path = client.gets.to_s.split[1]
        while (line = client.gets) && line != "\r\n"; end
        response = routes.fetch(path) { "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n" }
        client.write(response.respond_to?(:call) ? response.call(base) : response)
      rescue IOError, SystemCallError
        nil
      ensure
        client&.close
      end
    end
    Photos::Download.stub(:blocked?, ->(address) { address.to_s != "127.0.0.1" }) { yield base }
  ensure
    thread&.kill
    server&.close
  end

  def http_ok(body, content_type)
    "HTTP/1.1 200 OK\r\nContent-Type: #{content_type}\r\nContent-Length: #{body.bytesize}\r\nConnection: close\r\n\r\n#{body}"
  end

  def http_redirect(location)
    "HTTP/1.1 302 Found\r\nLocation: #{location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
  end
end

module ActionDispatch
  class IntegrationTest
    def json_response
      JSON.parse(response.body)
    end

    def auth_headers_for(user, workspace: nil)
      # Store the expected payload for this user
      token = "valid_token_#{user.id}"
      mock_clerk_token(token, { "sub" => user.clerk_user_id, "email" => user.email })
      headers = { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" }
      # Include workspace header if provided or if user has a personal workspace
      ws = workspace || user.personal_workspace
      headers["X-Workspace-ID"] = ws.id.to_s if ws
      headers
    end

    def mock_clerk_token(token, payload)
      # Mock Clerk::SDK instance verify_token method
      Clerk::SDK.class_eval do
        @@test_tokens ||= {}
        @@test_tokens[token] = payload

        define_method(:verify_token) do |t|
          if @@test_tokens[t]
            @@test_tokens[t]
          else
            raise Clerk::AuthenticationError, "Invalid token"
          end
        end
      end
    end

    def mock_clerk_user_fetch(clerk_id, email)
      # Mock Clerk::SDK to return a user with the specified email
      # Store test users in a class variable
      Clerk::SDK.class_variable_set(:@@test_users, {}) unless Clerk::SDK.class_variable_defined?(:@@test_users)
      Clerk::SDK.class_variable_get(:@@test_users)[clerk_id] = email

      # Override the users method on the Clerk::SDK class itself
      # This will apply to all instances
      unless Clerk::SDK.instance_methods(false).include?(:original_users_for_test)
        Clerk::SDK.class_eval do
          alias_method :original_users_for_test, :users

          def users
            test_users = self.class.class_variable_get(:@@test_users) rescue {}
            # Return a mock users object matching the current Clerk SDK contract.
            users_obj = Object.new
            users_obj.define_singleton_method(:get) do |user_id:|
              if test_users[user_id.to_s]
                user_email = test_users[user_id.to_s]
                # Create a mock user object
                user_obj = Object.new
                user_obj.define_singleton_method(:email_addresses) do
                  [ { "id" => "email_1", "email_address" => user_email } ]
                end
                user_obj.define_singleton_method(:primary_email_address_id) { "email_1" }
                user_obj.define_singleton_method(:first_name) { nil }
                user_obj.define_singleton_method(:last_name) { nil }
                user_obj.define_singleton_method(:image_url) { nil }
                user_obj.define_singleton_method(:username) { nil }
                user_obj.define_singleton_method(:phone_numbers) { [] }
                response = Object.new
                response.define_singleton_method(:user) { user_obj }
                response
              else
                # Fall back to original if not in test users
                original_users_for_test.get(user_id: user_id)
              end
            end
            users_obj
          end
        end
      end
    end

    def create_test_user(email: "test@example.com", clerk_id: "user_test_123")
      user = User.create!(
        email: email,
        clerk_user_id: clerk_id,
        subscription_plan: "free"
      )
      # Create personal workspace for test user
      workspace = Workspace.create!(
        name: "#{user.email}'s Gifts",
        workspace_type: "personal",
        created_by_user: user
      )
      workspace.workspace_memberships.create!(user: user, role: "owner")
      user
    end
  end
end
