require "test_helper"

class Photos::DownloadTest < ActiveSupport::TestCase
  include LocalHttpServer

  test "blocks private, loopback, link-local, and reserved addresses in both families" do
    %w[
      127.0.0.1 10.1.2.3 172.16.0.9 192.168.1.1 169.254.169.254 100.64.0.1 0.0.0.0 224.0.0.1
      ::1 :: fe80::1 fd00::1 ::ffff:127.0.0.1 ::ffff:10.0.0.1 64:ff9b::a00:1
    ].each { |address| assert Photos::Download.blocked?(IPAddr.new(address)), address }

    %w[93.184.216.34 8.8.8.8 2606:4700:10::ac42:93f3].each do |address|
      assert_not Photos::Download.blocked?(IPAddr.new(address)), address
    end
  end

  test "accepts only http and https links without credentials" do
    %w[ftp://example.com/a.png file:///etc/passwd javascript:alert(1) https://user:pass@example.com/a.png //example.com/a.png].each do |url|
      assert_includes fetch_error(url), "must be an http or https address", url
    end
    assert_includes fetch_error("https://exa mple.com/a.png"), "isn't a valid link"
  end

  test "refuses private addresses, whether written out or behind a host name" do
    %w[http://127.0.0.1/a.png http://169.254.169.254/latest/meta-data http://[::1]/a.png http://10.0.0.8/a.png].each do |url|
      assert_includes fetch_error(url), "private or local network address", url
    end

    mixed = [ Addrinfo.tcp("93.184.216.34", 80), Addrinfo.tcp("10.0.0.8", 80) ]
    Addrinfo.stub(:getaddrinfo, mixed) do
      assert_includes fetch_error("https://sneaky.example/a.png"), "private or local network address"
    end
  end

  test "explains a host name that doesn't resolve" do
    Addrinfo.stub(:getaddrinfo, ->(*) { raise Socket::ResolutionError, "getaddrinfo: Name or service not known" }) do
      assert_includes fetch_error("https://no-such-host.example/a.png"), "Couldn't find the website"
    end
  end

  test "returns the body, its type, and where redirects ended" do
    routes = { "/photo.png" => http_ok(PhotoBytes::PNG, "image/png; charset=binary"), "/moved" => http_redirect("/photo.png") }
    with_http_server(routes) do |base|
      response = fetch("#{base}/moved")
      assert_equal [ PhotoBytes::PNG, "image/png", "#{base}/photo.png" ], [ response.body, response.content_type, response.url ]
    end
  end

  test "checks every redirect hop against private addresses" do
    with_http_server("/hop" => http_redirect("http://169.254.169.254/latest/meta-data")) do |base|
      assert_includes fetch_error("#{base}/hop"), "private or local network address"
    end
  end

  test "stops after too many redirects" do
    with_http_server("/loop" => http_redirect("/loop")) do |base|
      assert_includes fetch_error("#{base}/loop"), "redirected more than 5 times"
    end
  end

  test "refuses bodies over max_bytes, with or without a declared length" do
    routes = {
      "/declared" => "HTTP/1.1 200 OK\r\nContent-Length: #{8 * 1024 * 1024}\r\nConnection: close\r\n\r\n",
      "/streamed" => "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n#{'x' * 2048}"
    }
    with_http_server(routes) do |base|
      assert_includes fetch_error("#{base}/declared", max_bytes: 1024), "(8 MB) is more than the 1 KB"
      assert_includes fetch_error("#{base}/streamed", max_bytes: 1024), "is more than the 1 KB"
    end
  end

  test "truncate keeps the start of a long page instead of failing" do
    page = "<html><head><meta property=\"og:image\" content=\"/a.jpg\"></head>#{'x' * 4096}</html>"
    with_http_server("/page" => http_ok(page, "text/html")) do |base|
      body = fetch("#{base}/page", max_bytes: 100, truncate: true).body
      assert_equal page.byteslice(0, 100), body
    end
  end

  test "reports an error status from the website" do
    with_http_server({}) do |base|
      assert_includes fetch_error("#{base}/missing.png"), "the website answered 404"
    end
  end

  private

  def fetch(url, max_bytes: 1024 * 1024, truncate: false)
    Photos::Download.call(url, accept: "image/*", max_bytes: max_bytes, truncate: truncate)
  end

  def fetch_error(url, **options)
    assert_raises(Photos::Invalid) { fetch(url, **options) }.message
  end
end
