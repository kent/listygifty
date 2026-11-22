module Photos
  # Reads a photo an assistant sent over MCP, as base64 data or a link, and
  # returns it as an Active Storage attachable ready to store.
  class Intake
    DATA_URL = /\Adata:[^,]*;base64,/i
    IMAGE_ACCEPT = "image/avif,image/webp,image/*;q=0.9,*/*;q=0.5".freeze

    def self.call(photo)
      new(photo).attachable
    end

    def initialize(photo)
      @photo = photo.to_h.stringify_keys
    end

    def attachable
      Processor.call(read, basename: basename, declared_type: @photo["mime_type"].presence)
    end

    private

    def read
      url = @photo["url"].presence
      data = @photo["data"].presence
      raise Invalid, "photo needs either a url or base64 data." unless url || data
      raise Invalid, "Send photo.url or photo.data, not both." if url && data

      data ||= url if url&.match?(DATA_URL)
      bytes = data ? decode(data) : Download.call(url, accept: IMAGE_ACCEPT, max_bytes: Download::MAX_IMAGE_BYTES).body
      raise Invalid, "photo is empty." if bytes.empty?

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

    def basename
      name = @photo["filename"].presence
      name ||= URI.parse(@photo["url"]).path if @photo["url"].present? && !@photo["url"].match?(DATA_URL)
      File.basename(name.to_s, ".*")
    rescue URI::Error
      nil
    end
  end
end
