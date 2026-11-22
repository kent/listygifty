require "test_helper"

class Photos::IntakeTest < ActiveSupport::TestCase
  test "base64 data is processed and named after the file it came from" do
    photo = intake("data" => Base64.strict_encode64(PhotoBytes.jpeg), "mime_type" => "image/jpeg", "filename" => "boots.jpeg")

    assert_equal [ "image/jpeg", "boots.jpg" ], photo.values_at(:content_type, :filename)
    assert_equal "image/jpeg", Marcel::MimeType.for(photo[:io])
  end

  test "accepts data URLs, URL-safe or unpadded base64, and line breaks" do
    encoded = Base64.strict_encode64(PhotoBytes::PNG)
    [
      "data:image/png;base64,#{encoded}",
      encoded.tr("+/", "-_").delete("="),
      encoded.scan(/.{1,20}/).join("\n")
    ].each do |data|
      assert_equal "image/png", intake("data" => data)[:content_type]
    end
    assert_equal "image/png", intake("url" => "data:image/png;base64,#{encoded}")[:content_type]
  end

  test "the bytes decide the type, whatever mime_type says" do
    photo = intake("data" => Base64.strict_encode64(PhotoBytes.tiff), "mime_type" => "image/png", "filename" => "scan.png")

    assert_equal [ "image/jpeg", "scan.jpg" ], photo.values_at(:content_type, :filename)
    assert_includes intake_error("data" => Base64.strict_encode64("%PDF-1.7"), "mime_type" => "image/png"), "application/pdf, not image/png"
  end

  test "has no size cap of its own" do
    big = PhotoBytes.vips::Image.gaussnoise(1800, 1800, sigma: 80).cast(:uchar).bandjoin([ 128, 128 ]).jpegsave_buffer(Q: 100)
    assert_operator big.bytesize, :>, 5 * 1024 * 1024, "bigger than the old 5 MB cap"

    assert_equal "image/jpeg", intake("data" => Base64.strict_encode64(big))[:content_type]
  end

  test "explains malformed or missing input" do
    assert_includes intake_error("data" => "not base64!!"), "isn't valid base64"
    assert_includes intake_error({}), "needs either a url or base64 data"
    assert_includes intake_error("url" => "https://example.com/a.png", "data" => "aGk="), "not both"
    assert_includes intake_error("data" => "===="), "isn't valid base64"
  end

  test "downloads links and names the file after the link" do
    requested = nil
    download = lambda do |url, **options|
      requested = [ url, options[:max_bytes] ]
      Photos::Download::Response.new(body: PhotoBytes.webp, content_type: "image/webp", url: url)
    end

    photo = Photos::Download.stub(:call, download) { intake("url" => "https://shop.example/images/red-sneakers.webp?w=800") }

    assert_equal [ "https://shop.example/images/red-sneakers.webp?w=800", Photos::Download::MAX_IMAGE_BYTES ], requested
    assert_equal [ "image/webp", "red-sneakers.webp" ], photo.values_at(:content_type, :filename)
  end

  test "an unreadable HEIC asks for another file and lists what works" do
    message = intake_error("data" => Base64.strict_encode64(PhotoBytes::HEIC_HEADER + "garbage".b))

    assert_includes message, "That HEIC file couldn't be read"
    assert_includes message, Photos::Processor::ACCEPTED
  end

  private

  def intake(photo)
    Photos::Intake.call(photo)
  end

  def intake_error(photo)
    assert_raises(Photos::Invalid) { intake(photo) }.message
  end
end
