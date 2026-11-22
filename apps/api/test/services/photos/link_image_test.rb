require "test_helper"

class Photos::LinkImageTest < ActiveSupport::TestCase
  include LocalHttpServer

  BASE = "https://shop.example/products/boots"

  test "prefers og:image, then twitter:image, then JSON-LD, then image_src and itemprop" do
    html = <<~HTML
      <html><head>
        <link rel="image_src" href="/src.jpg">
        <meta name="twitter:image" content="https://cdn.example/twitter.jpg">
        <script type="application/ld+json">{"@type": "Product", "image": "https://cdn.example/ld.jpg"}</script>
        <meta property="og:image" content="//cdn.example/og.jpg">
      </head><body><img itemprop="image" src="item.jpg"></body></html>
    HTML

    assert_equal %w[
      https://cdn.example/og.jpg https://cdn.example/twitter.jpg https://cdn.example/ld.jpg
      https://shop.example/src.jpg https://shop.example/products/item.jpg
    ], Photos::LinkImage.candidates(html, BASE)
  end

  test "finds Product images anywhere in JSON-LD, in every shape schema.org allows" do
    html = <<~HTML
      <script type="application/ld+json">{"@type": "Organization", "logo": "https://cdn.example/logo.png", "image": "https://cdn.example/org.jpg"}</script>
      <script type="application/ld+json">not json</script>
      <script type="application/ld+json">
        {"@graph": [{"@type": ["Thing", "Product"], "image": [{"@type": "ImageObject", "url": "/a.jpg"}, "/b.jpg"]},
                    {"@type": "ProductGroup", "image": {"contentUrl": "/c.jpg"}}]}
      </script>
    HTML

    assert_equal %w[https://shop.example/a.jpg https://shop.example/b.jpg https://shop.example/c.jpg],
      Photos::LinkImage.candidates(html, BASE)
  end

  test "ignores links that aren't http or https" do
    html = %(<meta property="og:image" content="javascript:alert(1)"><meta property="og:image" content="data:image/png;base64,AAAA">)

    assert_empty Photos::LinkImage.candidates(html, BASE)
  end

  test "downloads the page's picture through the photo pipeline" do
    routes = {
      "/boots" => ->(base) { http_ok(%(<head><meta property="og:image" content="#{base}/boots.tiff"></head>), "text/html; charset=utf-8") },
      "/boots.tiff" => http_ok(PhotoBytes.tiff, "image/tiff")
    }
    with_http_server(routes) do |base|
      photo = Photos::LinkImage.call("#{base}/boots")
      assert_equal [ "image/jpeg", "boots.jpg" ], photo.values_at(:content_type, :filename)
    end
  end

  test "moves on when a candidate fails, including one on a private address" do
    page = %(<meta property="og:image" content="http://169.254.169.254/latest/meta-data">) +
      %(<meta name="twitter:image" content="/missing.jpg"><link rel="image_src" href="/real.png">)
    routes = { "/item" => http_ok(page, "text/html"), "/real.png" => http_ok(PhotoBytes::PNG, "image/png") }
    with_http_server(routes) do |base|
      assert_equal "real.png", Photos::LinkImage.call("#{base}/item")[:filename]
    end
  end

  test "a link straight to an image is used as the photo" do
    with_http_server("/shoe.webp" => http_ok(PhotoBytes.webp, "image/webp")) do |base|
      assert_equal "image/webp", Photos::LinkImage.call("#{base}/shoe.webp")[:content_type]
    end
  end

  test "returns nil when the page has no picture" do
    with_http_server("/plain" => http_ok("<html><head><title>Boots</title></head></html>", "text/html")) do |base|
      assert_nil Photos::LinkImage.call("#{base}/plain")
    end
  end
end
