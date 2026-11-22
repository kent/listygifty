require "test_helper"
require "minitest/mock"

class Photos::IntakeTest < ActiveSupport::TestCase
  test "base64 data becomes an attachable typed by its bytes" do
    photo = intake("data" => Base64.strict_encode64(PhotoBytes::PNG), "mime_type" => "image/png", "filename" => "boots.png")

    assert_equal "image/png", photo[:content_type]
    assert_equal "boots.png", photo[:filename]
    assert_equal PhotoBytes::PNG, photo[:io].read
    assert_equal false, photo[:identify]
  end

  test "accepts data URLs, URL-safe or unpadded base64, and line breaks" do
    encoded = Base64.strict_encode64(PhotoBytes::PNG)
    [
      "data:image/png;base64,#{encoded}",
      encoded.tr("+/", "-_").delete("="),
      encoded.scan(/.{1,20}/).join("\n")
    ].each do |data|
      assert_equal PhotoBytes::PNG, intake("data" => data)[:io].read
    end
    assert_equal PhotoBytes::PNG, intake("url" => "data:image/png;base64,#{encoded}")[:io].read
  end

  test "trusts the bytes over the declared type and names the file to match" do
    {
      PhotoBytes::JPEG => [ "image/jpeg", "jpg" ],
      PhotoBytes::GIF => [ "image/gif", "gif" ],
      PhotoBytes::WEBP => [ "image/webp", "webp" ]
    }.each do |bytes, (type, extension)|
      photo = intake("data" => Base64.strict_encode64(bytes), "mime_type" => "image/png", "filename" => "../../etc/shot.png")

      assert_equal type, photo[:content_type]
      assert_equal "shot.#{extension}", photo[:filename]
    end
  end

  test "rejects files that are not a supported image, saying what they look like" do
    pdf = intake_error("data" => Base64.strict_encode64("%PDF-1.7\n%stuff"), "mime_type" => "image/png")
    assert_includes pdf, "application/pdf, not image/png"
    assert_includes pdf, "JPEG, PNG, WebP, GIF, or HEIC"

    svg = intake_error("data" => Base64.strict_encode64(%(<svg xmlns="http://www.w3.org/2000/svg"></svg>)))
    assert_includes svg, "image/svg+xml"
  end

  test "rejects photos over the size limit" do
    too_big = PhotoBytes::PNG + ("\x00".b * HasPhoto::MAX_PHOTO_BYTES)

    message = intake_error("data" => Base64.strict_encode64(too_big))

    assert_includes message, "over the 5 MB limit"
  end

  test "explains malformed or missing input" do
    assert_includes intake_error("data" => "not base64!!"), "isn't valid base64"
    assert_includes intake_error({}), "needs either a url or base64 data"
    assert_includes intake_error("url" => "https://example.com/a.png", "data" => "aGk="), "not both"
    assert_includes intake_error("data" => "===="), "isn't valid base64"
  end

  test "downloads links and names the file after the link" do
    fetched = nil
    fetch = ->(url) { fetched = url; PhotoBytes::JPEG }

    photo = Photos::RemoteImage.stub(:fetch, fetch) { intake("url" => "https://shop.example/images/red-sneakers.jpeg?w=800") }

    assert_equal "https://shop.example/images/red-sneakers.jpeg?w=800", fetched
    assert_equal [ "image/jpeg", "red-sneakers.jpg" ], photo.values_at(:content_type, :filename)
  end

  test "converts HEIC to JPEG" do
    heic = PhotoBytes.heic
    skip "libvips can't encode HEIC on this machine" unless heic

    photo = intake("data" => Base64.strict_encode64(heic), "filename" => "IMG_0001.HEIC")

    assert_equal [ "image/jpeg", "IMG_0001.jpg" ], photo.values_at(:content_type, :filename)
    assert_equal "image/jpeg", Marcel::MimeType.for(photo[:io])
  end

  test "an unreadable HEIC asks for a JPEG or PNG" do
    message = intake_error("data" => Base64.strict_encode64(PhotoBytes::HEIC_HEADER + "garbage".b))

    assert_includes message, "couldn't be read. Send it as a JPEG or PNG"
  end

  private

  def intake(photo)
    Photos::Intake.call(photo)
  end

  def intake_error(photo)
    assert_raises(Photos::Invalid) { intake(photo) }.message
  end
end
