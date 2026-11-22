module Photos
  # Checks a photo an assistant sent over MCP, as base64 data or a link, and
  # returns an Active Storage attachable. The bytes decide the type, never the
  # name or declared MIME type. HEIC is converted to JPEG so every browser can
  # show it.
  class Intake
    EXTENSIONS = { "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp", "image/gif" => "gif" }.freeze
    HEIC_TYPES = %w[image/heic image/heif].freeze
    HEIC_MAX_DIMENSION = 2048
    ACCEPTED = "JPEG, PNG, WebP, GIF, or HEIC".freeze
    DATA_URL = /\Adata:[^,]*;base64,/i

    def self.call(photo)
      new(photo).attachable
    end

    def initialize(photo)
      @photo = photo.to_h.stringify_keys
    end

    def attachable
      bytes = read
      type = Marcel::MimeType.for(StringIO.new(bytes))
      bytes, type = heic_to_jpeg(bytes), "image/jpeg" if HEIC_TYPES.include?(type)
      raise Invalid, unsupported_type_message(type) unless EXTENSIONS.key?(type)

      { io: StringIO.new(bytes), filename: "#{basename}.#{EXTENSIONS.fetch(type)}", content_type: type, identify: false }
    end

    private

    def read
      url = @photo["url"].presence
      data = @photo["data"].presence
      raise Invalid, "photo needs either a url or base64 data." unless url || data
      raise Invalid, "Send photo.url or photo.data, not both." if url && data

      data ||= url if url&.match?(DATA_URL)
      bytes = data ? decode(data) : RemoteImage.fetch(url)
      raise Invalid, "photo is empty." if bytes.empty?
      raise Invalid, too_large_message(bytes.bytesize) if bytes.bytesize > HasPhoto::MAX_PHOTO_BYTES

      bytes
    end

    # Accepts standard or URL-safe base64, with or without padding, line
    # breaks, or a data: URL prefix.
    def decode(data)
      data = data.sub(DATA_URL, "").delete(" \t\r\n").tr("-_", "+/")
      Base64.strict_decode64(data + "=" * (-data.length % 4))
    rescue ArgumentError
      raise Invalid, "photo.data isn't valid base64. Send the image bytes base64-encoded, or as a data: URL."
    end

    def heic_to_jpeg(bytes)
      require "vips"
      Vips::Image.thumbnail_buffer(bytes, HEIC_MAX_DIMENSION, height: HEIC_MAX_DIMENSION, size: :down)
        .jpegsave_buffer(Q: 85, strip: true)
    rescue LoadError
      raise Invalid, heic_unreadable_message
    rescue Vips::Error
      raise Invalid, heic_unreadable_message
    end

    def basename
      name = @photo["filename"].presence
      name ||= URI.parse(@photo["url"]).path if @photo["url"].present? && !@photo["url"].match?(DATA_URL)
      base = File.basename(name.to_s, ".*")
      ActiveStorage::Filename.new(base).sanitized.first(100).presence || "photo"
    rescue URI::Error
      "photo"
    end

    def unsupported_type_message(type)
      declared = @photo["mime_type"].presence
      claim = declared && declared != type ? ", not #{declared}" : ""
      "That file isn't a photo Listy Gifty can store: it looks like #{type}#{claim}. Send a #{ACCEPTED} image."
    end

    def too_large_message(bytes)
      "That photo is #{Photos.human_size(bytes)}, over the #{Photos.human_size(HasPhoto::MAX_PHOTO_BYTES)} limit. " \
        "Send a smaller or more compressed version."
    end

    def heic_unreadable_message
      "That HEIC photo couldn't be read. Send it as a JPEG or PNG instead."
    end
  end
end
