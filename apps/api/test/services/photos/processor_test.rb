require "test_helper"

class Photos::ProcessorTest < ActiveSupport::TestCase
  test "JPEG, PNG, WebP, and GIF keep their format" do
    {
      PhotoBytes.jpeg => %w[image/jpeg jpg],
      PhotoBytes.solid.pngsave_buffer => %w[image/png png],
      PhotoBytes.webp => %w[image/webp webp],
      PhotoBytes.gif => %w[image/gif gif]
    }.each do |bytes, (type, extension)|
      photo = process(bytes)
      assert_equal [ type, "photo.#{extension}" ], photo.values_at(:content_type, :filename)
      assert_equal type, sniff(photo)
      assert_equal [ 40, 20 ], dimensions(photo)
    end
  end

  test "formats browsers can't show become JPEG" do
    missing = []
    { heic: PhotoBytes.heic, heif: PhotoBytes.heif, avif: PhotoBytes.avif, tiff: PhotoBytes.tiff, bmp: PhotoBytes.bmp,
      jxl: PhotoBytes.jxl, jp2: PhotoBytes.jp2, opaque_alpha_tiff: PhotoBytes.opaque_alpha_tiff }.each do |format, bytes|
      next missing << format unless bytes

      photo = process(bytes)
      assert_equal "image/jpeg", photo[:content_type], format
      assert_equal "image/jpeg", sniff(photo), format
      red, green, blue = pixel(photo, 5, 5)
      assert_in_delta 200, red, 8, format
      assert_in_delta 80, green, 8, format
      assert_in_delta 40, blue, 8, format
    end
    skip "This machine can't encode #{missing.join(', ')}" if missing.any?
  end

  test "transparent images become PNG and stay transparent" do
    { tiff: PhotoBytes.transparent_tiff, ico: PhotoBytes.ico }.each do |format, bytes|
      photo = process(bytes)
      assert_equal "image/png", photo[:content_type], format
      image = decoded(photo)
      assert_equal 4, image.bands, format
      assert_equal 255, image.getpoint(1, 1).last, format
      assert_equal 0, image.getpoint(image.width - 2, 1).last, format
    end
  end

  test "icons use their largest size" do
    assert_equal [ 48, 48 ], dimensions(process(PhotoBytes.multi_size_ico))
  end

  test "SVG is rasterized to PNG, never stored as markup" do
    plain = %(<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="20" height="20" fill="red"/></svg>)
    svgs = [
      plain,
      "  \n#{plain}",
      "\xEF\xBB\xBF".b + plain.b,
      %(<?xml version="1.0" encoding="UTF-8"?>\n<!-- logo -->\n<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">) +
        %(<script>alert(document.cookie)</script><image href="file:///etc/passwd" width="10" height="10"/>) +
        %(<circle cx="5" cy="5" r="4" fill="blue"/></svg>)
    ]
    svgs.each do |svg|
      photo = process(svg, declared_type: "image/svg+xml")
      body = photo[:io].read
      assert_equal "image/png", photo[:content_type]
      assert_equal "image/png", Marcel::MimeType.for(StringIO.new(body))
      assert_not_includes body, "<svg"
      assert_not_includes body, "script"
      assert_equal 1024, dimensions(photo).max, "vectors render at a useful size"
    end
  end

  test "animated GIF and WebP keep every frame and its timing" do
    { gif: "image/gif", webp: "image/webp" }.each do |format, type|
      photo = process(PhotoBytes.animated(format))
      assert_equal type, photo[:content_type]
      image = PhotoBytes.vips::Image.new_from_buffer(photo[:io].read, "", n: -1)
      assert_equal 3, image.get("n-pages"), format
      assert_equal [ 100, 200, 300 ], image.get("delay"), format
    end
  end

  test "strips location and other metadata, after turning the photo upright" do
    %i[jpeg png webp].each do |format|
      source = PhotoBytes.with_location(format)
      source_fields = PhotoBytes.vips::Image.new_from_buffer(source, "").get_fields
      assert_includes source_fields, "xmp-data", "the #{format} fixture carries XMP"
      assert_includes source_fields, "exif-data", "the #{format} fixture carries EXIF"

      photo = process(source)
      body = photo[:io].read
      image = PhotoBytes.vips::Image.new_from_buffer(body, "")

      assert_not_includes body, PhotoBytes::LOCATION_MARKER, format
      assert_empty image.get_fields.grep(/exif|xmp|iptc|icc|orientation/), format
      assert_equal [ 40, 20 ], [ image.width, image.height ], "#{format} is rotated upright"
      assert_operator image.getpoint(image.width - 1, 0).first, :>, 200, "#{format}: the stripe moved to the right edge"
    end
  end

  test "converts colour to sRGB before dropping the profile" do
    cmyk = PhotoBytes.solid.colourspace(:cmyk).jpegsave_buffer
    p3 = PhotoBytes.solid.icc_transform("p3").jpegsave_buffer

    [ cmyk, p3 ].each do |bytes|
      red, green, blue = pixel(process(bytes), 5, 5)
      assert_in_delta 200, red, 8
      assert_in_delta 80, green, 8
      assert_in_delta 40, blue, 8
    end
  end

  test "large images shrink to fit 4096 pixels on the long side" do
    huge = PhotoBytes.solid(5000, 1000).pngsave_buffer

    assert_equal [ 4096, 819 ], dimensions(process(huge))
  end

  test "unsupported files name what they look like and list what works" do
    {
      "%PDF-1.7\n%stuff" => "application/pdf",
      "<!doctype html><html><body><svg></svg></body></html>" => "text/html",
      "just some words" => "application/octet-stream"
    }.each do |bytes, type|
      message = assert_raises(Photos::Invalid) { process(bytes) }.message
      assert_includes message, "it looks like #{type}"
      assert_includes message, Photos::Processor::ACCEPTED
    end
    assert_includes assert_raises(Photos::Invalid) { process("%PDF-1.7", declared_type: "image/png") }.message, "not image/png"
  end

  test "damaged files of a supported type say so" do
    truncated = PhotoBytes.jpeg.byteslice(0, 30)

    message = assert_raises(Photos::Invalid) { process(truncated) }.message

    assert_includes message, "That JPEG file couldn't be read; it may be damaged"
    assert_includes message, Photos::Processor::ACCEPTED
  end

  test "file names are sanitized and get the extension of what was stored" do
    assert_equal "..-..-etc-shot.jpg", process(PhotoBytes.tiff, basename: "../../etc/shot")[:filename]
    assert_equal "photo.jpg", process(PhotoBytes.tiff, basename: "")[:filename]
  end

  private

  def process(bytes, basename: "photo", declared_type: nil)
    Photos::Processor.call(bytes, basename: basename, declared_type: declared_type)
  end

  def decoded(photo)
    photo[:io].rewind
    PhotoBytes.vips::Image.new_from_buffer(photo[:io].read, "").tap { photo[:io].rewind }
  end

  def sniff(photo)
    Marcel::MimeType.for(StringIO.new(photo[:io].read)).tap { photo[:io].rewind }
  end

  def dimensions(photo)
    image = decoded(photo)
    [ image.width, image.height ]
  end

  def pixel(photo, x, y)
    decoded(photo).getpoint(x, y).first(3)
  end
end
