module Photos
  # Turns any image Listy Gifty accepts into one every browser can show, with
  # no metadata. JPEG, PNG, WebP, and GIF keep their format, animations
  # included. Everything else becomes JPEG, or PNG when it has transparency.
  # SVG is always rasterized, since stored as is it could run script. Every
  # photo is decoded and re-encoded, upright by its EXIF orientation and in
  # sRGB, so EXIF, GPS, XMP, and colour profiles never reach storage.
  class Processor
    FORMATS = {
      "image/jpeg" => "JPEG", "image/png" => "PNG", "image/gif" => "GIF", "image/webp" => "WebP",
      "image/heic" => "HEIC", "image/heic-sequence" => "HEIC", "image/heif" => "HEIF", "image/heif-sequence" => "HEIF",
      "image/avif" => "AVIF", "image/tiff" => "TIFF", "image/bmp" => "BMP", "image/x-ms-bmp" => "BMP",
      "image/vnd.microsoft.icon" => "ICO", "image/x-icon" => "ICO", "image/svg+xml" => "SVG",
      "image/jxl" => "JPEG XL", "image/jp2" => "JPEG 2000"
    }.freeze
    ACCEPTED = FORMATS.values.uniq.then { |names| "#{names[0...-1].join(', ')}, or #{names.last}" }.freeze
    KEPT = { "image/jpeg" => :jpeg, "image/png" => :png, "image/webp" => :webp, "image/gif" => :gif }.freeze
    OUTPUTS = { jpeg: %w[image/jpeg jpg], png: %w[image/png png], webp: %w[image/webp webp], gif: %w[image/gif gif] }.freeze
    SVG = "image/svg+xml".freeze
    ICO = %w[image/vnd.microsoft.icon image/x-icon].freeze
    ANIMATED = %w[image/gif image/webp].freeze
    # What Marcel calls an SVG that opens with an XML declaration, a byte-order
    # mark, or whitespace.
    SVG_LOOKALIKES = %w[application/xml text/xml text/plain application/octet-stream].freeze
    MAX_DIMENSION = 4096
    SVG_DIMENSION = 1024
    QUALITY = 90
    # Rails blocks libvips's unfuzzed loaders. These decode SVG, BMP and ICO
    # (through ImageMagick), JPEG XL, and JPEG 2000. Only bytes identified as
    # one of those formats ever reach them, and no unfuzzed saver is enabled.
    UNFUZZED_LOADERS = %w[svgload_buffer magickload_buffer jxlload_buffer jp2kload_buffer].freeze

    def self.call(bytes, basename:, declared_type: nil)
      new(bytes, basename, declared_type).attachable
    end

    def self.load_vips!
      @load_vips ||= begin
        require "active_storage/vips"
        raise Invalid, "Photos can't be processed right now. Try again later." unless ActiveStorage::VIPS_AVAILABLE

        unblock(UNFUZZED_LOADERS)
        true
      end
    end

    # By nickname, since the class behind magickload differs between
    # ImageMagick 6 and 7 builds.
    def self.unblock(nicknames)
      nicknames.each do |nickname|
        type = Vips.type_find("VipsOperation", nickname)
        Vips.block(GObject.g_type_name(type), false) unless type.zero?
      end
    end

    def initialize(bytes, basename, declared_type)
      @bytes = bytes
      @basename = ActiveStorage::Filename.new(basename.to_s).sanitized.first(100).presence || "photo"
      @declared_type = declared_type
    end

    def attachable
      type = detect
      raise Invalid, unsupported_message(type) unless FORMATS.key?(type)

      self.class.load_vips!
      format, data = transcode(type)
      content_type, extension = OUTPUTS.fetch(format)
      { io: StringIO.new(data), filename: "#{@basename}.#{extension}", content_type: content_type, identify: false }
    end

    private

    def detect
      type = Marcel::MimeType.for(StringIO.new(@bytes))
      return SVG if SVG_LOOKALIKES.include?(type) && @bytes.byteslice(0, 4096).dup.force_encoding(Encoding::UTF_8).scrub.match?(/<svg[\s>]/)

      type
    end

    def transcode(type)
      image = decode(type)
      # Reading the alpha band and then saving takes two passes.
      image = image.copy_memory if image.has_alpha? && !KEPT.key?(type)
      format = KEPT.fetch(type) { type == SVG || transparent?(image) ? :png : :jpeg }
      [ format, encode(image, format) ]
    rescue Vips::Error
      raise Invalid, "That #{FORMATS.fetch(type)} file couldn't be read; it may be damaged. Send a #{ACCEPTED} image."
    end

    # Large photos shrink to MAX_DIMENSION on the long side, which also bounds
    # the memory a decompression bomb can claim. SVG renders to fit
    # SVG_DIMENSION, since a vector scales up for free.
    def decode(type)
      image = if type == SVG
        Vips::Image.thumbnail_buffer(@bytes, SVG_DIMENSION, height: SVG_DIMENSION, size: :both)
      else
        options = { height: MAX_DIMENSION, size: :down, export_profile: "srgb" }
        option_string = loader_options(type)
        options[:option_string] = option_string if option_string
        Vips::Image.thumbnail_buffer(@bytes, MAX_DIMENSION, **options)
      end
      image.interpretation == :srgb ? image : image.colourspace(:srgb)
    end

    def loader_options(type)
      pages = page_count
      return if pages < 2
      return "n=-1" if ANIMATED.include?(type)

      "page=#{largest_page(pages)}" if ICO.include?(type)
    end

    def page_count
      header = Vips::Image.new_from_buffer(@bytes, "")
      header.get_typeof("n-pages").zero? ? 1 : header.get("n-pages")
    end

    # An icon file holds several sizes, smallest first as often as not.
    def largest_page(pages)
      (0...[ pages, 64 ].min).max_by { |page| Vips::Image.new_from_buffer(@bytes, "", page: page).width }
    end

    def transparent?(image)
      image.has_alpha? && image.extract_band(image.bands - 1).min < 255
    end

    def encode(image, format)
      case format
      when :jpeg
        image = image.flatten(background: 255) if image.has_alpha?
        image.jpegsave_buffer(Q: QUALITY, optimize_coding: true, **no_metadata)
      when :png then image.pngsave_buffer(**no_metadata)
      when :webp then image.webpsave_buffer(Q: QUALITY, **no_metadata)
      when :gif then image.gifsave_buffer(**no_metadata)
      end
    end

    def no_metadata
      Vips.at_least_libvips?(8, 15) ? { keep: :none } : { strip: true }
    end

    def unsupported_message(type)
      claim = @declared_type && @declared_type != type ? ", not #{@declared_type}" : ""
      "That file isn't a photo Listy Gifty can read: it looks like #{type}#{claim}. Send a #{ACCEPTED} image."
    end
  end
end
