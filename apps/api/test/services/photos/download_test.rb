require "test_helper"
require "minitest/mock"
require "socket"

class Photos::RemoteImageTest < ActiveSupport::TestCase
  test "blocks private, loopback, link-local, and reserved addresses in both families" do
    %w[
      127.0.0.1 10.1.2.3 172.16.0.9 192.168.1.1 169.254.169.254 100.64.0.1 0.0.0.0 224.0.0.1
      ::1 :: fe80::1 fd00::1 ::ffff:127.0.0.1 ::ffff:10.0.0.1 64:ff9b::a00:1
    ].each { |address| assert Photos::RemoteImage.blocked?(IPAddr.new(address)), address }

    %w[93.184.216.34 8.8.8.8 2606:4700:10::ac42:93f3].each do |address|
      assert_not Photos::RemoteImage.blocked?(IPAddr.new(address)), address
    end
  end

  test "accepts only http and https links without credentials" do
    %w[ftp://example.com/a.png file:///etc/passwd javascript:alert(1) https://user:pass@example.com/a.png //example.com/a.png].each do |url|
      assert_includes fetch_error(url), "must be an http or https link", url
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

  test "downloads an image and follows redirects to it" do
    routes = {
      "/photo.png" => ok(PhotoBytes::PNG),
      "/moved" => redirect("/photo.png")
    }
    with_server(routes) do |base|
      assert_equal PhotoBytes::PNG, Photos::RemoteImage.fetch("#{base}/photo.png")
      assert_equal PhotoBytes::PNG, Photos::RemoteImage.fetch("#{base}/moved")
    end
  end

  test "checks every redirect hop against private addresses" do
    with_server("/hop" => redirect("http://169.254.169.254/latest/meta-data")) do |base|
      assert_includes fetch_error("#{base}/hop"), "private or local network address"
    end
  end

  test "stops after too many redirects" do
    with_server("/loop" => redirect("/loop")) do |base|
      assert_includes fetch_error("#{base}/loop"), "redirected more than 3 times"
    end
  end

  test "stops reading at the size limit, with or without a declared length" do
    huge = "x" * (HasPhoto::MAX_PHOTO_BYTES + 1)
    routes = {
      "/declared" => "HTTP/1.1 200 OK\r\nContent-Length: #{8 * 1024 * 1024}\r\nConnection: close\r\n\r\n",
      "/streamed" => "HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n#{huge}"
    }
    with_server(routes) do |base|
      assert_includes fetch_error("#{base}/declared"), "is 8 MB, which is over the 5 MB limit"
      assert_includes fetch_error("#{base}/streamed"), "is over the 5 MB limit"
    end
  end

  test "reports an error status from the website" do
    with_server({}) do |base|
      assert_includes fetch_error("#{base}/missing.png"), "the website answered 404"
    end
  end

  private

  def fetch_error(url)
    assert_raises(Photos::Invalid) { Photos::RemoteImage.fetch(url) }.message
  end

  def ok(body)
    "HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: #{body.bytesize}\r\nConnection: close\r\n\r\n#{body}"
  end

  def redirect(location)
    "HTTP/1.1 302 Found\r\nLocation: #{location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
  end

  # Serves canned responses on loopback, which is otherwise blocked, so these
  # tests let 127.0.0.1 through and nothing else.
  def with_server(routes)
    server = TCPServer.new("127.0.0.1", 0)
    thread = Thread.new do
      loop do
        client = server.accept
        path = client.gets.to_s.split[1]
        while (line = client.gets) && line != "\r\n"; end
        client.write(routes.fetch(path) { "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n" })
      rescue IOError, SystemCallError
        nil
      ensure
        client&.close
      end
    end
    Photos::RemoteImage.stub(:blocked?, ->(address) { address.to_s != "127.0.0.1" }) do
      yield "http://127.0.0.1:#{server.addr[1]}"
    end
  ensure
    thread&.kill
    server&.close
  end
end
