require "net/http"

module Photos
  # Fetches a public web address for photos: the image itself, or a product
  # page to find one on. Each hop is resolved once and connected to by that
  # address, so neither DNS nor a redirect can point the request at Listy
  # Gifty's own network or the cloud metadata server.
  class Download
    Response = Data.define(:body, :content_type, :url)

    # Bodies are held in memory, and an API instance has 2 GiB for every
    # request it serves, so this guards the instance rather than limiting photos.
    MAX_IMAGE_BYTES = 100 * 1024 * 1024
    MAX_REDIRECTS = 5
    TIMEOUT = 5
    DEADLINE = 20
    USER_AGENT = "Mozilla/5.0 (compatible; ListyGiftyBot/1.0; +https://listygifty.com)".freeze
    BLOCKED_NETWORKS = %w[
      0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12
      192.0.0.0/24 192.0.2.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24
      203.0.113.0/24 224.0.0.0/4 240.0.0.0/4
      ::/128 ::1/128 64:ff9b::/96 100::/64 2001::/32 2001:db8::/32 2002::/16
      fc00::/7 fe80::/10 ff00::/8
    ].map { |network| IPAddr.new(network) }.freeze

    # truncate: stop at max_bytes and keep what arrived, instead of failing.
    def self.call(url, accept:, max_bytes:, truncate: false)
      new(url, accept, max_bytes, truncate).call
    end

    def self.blocked?(address)
      ip = address.native
      BLOCKED_NETWORKS.any? { |network| network.include?(ip) }
    end

    def initialize(url, accept, max_bytes, truncate)
      @url = url
      @accept = accept
      @max_bytes = max_bytes
      @truncate = truncate
      @deadline = now + DEADLINE
    end

    def call
      uri = parse(@url)
      (MAX_REDIRECTS + 1).times do
        result = get(uri)
        return result if result.is_a?(Response)

        uri = result
      end
      raise Invalid, "The link redirected more than #{MAX_REDIRECTS} times. Send the direct link."
    end

    private

    def get(uri)
      raise too_slow if now > @deadline

      http = Net::HTTP.new(uri.hostname, uri.port, nil)
      http.ipaddr = public_address(uri.hostname)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = http.read_timeout = http.write_timeout = http.ssl_timeout = TIMEOUT
      http.start do
        request = Net::HTTP::Get.new(uri, "Accept" => @accept, "Accept-Encoding" => "identity", "User-Agent" => USER_AGENT)
        http.request(request) { |response| return handle(uri, response) }
      end
    rescue Net::OpenTimeout, Net::ReadTimeout, Net::WriteTimeout
      raise too_slow
    rescue SocketError, SystemCallError, IOError, OpenSSL::SSL::SSLError, Net::HTTPBadResponse, Net::ProtocolError
      raise Invalid, "Couldn't download the link: the connection to the website failed."
    end

    def handle(uri, response)
      case response
      when Net::HTTPSuccess
        content_type = response["content-type"].to_s.split(";").first.to_s.strip.downcase.presence
        Response.new(body: read(response), content_type: content_type, url: uri.to_s)
      when Net::HTTPRedirection
        location = response["location"].presence
        raise Invalid, "The link redirected without saying where to." unless location

        parse(location, base: uri)
      else
        raise Invalid, "Couldn't download the link: the website answered #{response.code}."
      end
    end

    def read(response)
      declared = response.content_length
      raise too_large(declared) if !@truncate && declared && declared > @max_bytes

      body = String.new(encoding: Encoding::BINARY)
      catch(:full) do
        response.read_body do |chunk|
          body << chunk
          raise too_slow if now > @deadline
          next if body.bytesize <= @max_bytes
          raise too_large unless @truncate

          throw :full
        end
      end
      @truncate ? body.byteslice(0, @max_bytes) : body
    end

    def parse(url, base: nil)
      url = url.to_s.strip
      uri = base ? base.merge(url) : URI.parse(url)
      return uri if uri.is_a?(URI::HTTP) && uri.hostname.present? && uri.userinfo.nil?

      raise Invalid, "The link must be an http or https address."
    rescue URI::Error
      raise Invalid, "That isn't a valid link."
    end

    # Every address the name resolves to must be public, so a mixed answer
    # can't slip a private one in.
    def public_address(host)
      addresses = Addrinfo.getaddrinfo(host, nil, nil, :STREAM, timeout: TIMEOUT).map { |info| IPAddr.new(info.ip_address) }
      raise private_address if addresses.empty? || addresses.any? { |address| self.class.blocked?(address) }

      addresses.min_by { |address| address.ipv4? ? 0 : 1 }.to_s
    rescue IPAddr::InvalidAddressError
      raise private_address
    rescue SocketError, IO::TimeoutError
      raise Invalid, "Couldn't find the website in the link. Check the address."
    end

    def private_address
      Invalid.new("The link points to a private or local network address. Send a public link.")
    end

    def too_large(bytes = nil)
      size = bytes ? " (#{Photos.human_size(bytes)})" : ""
      Invalid.new("The file at the link#{size} is more than the #{Photos.human_size(@max_bytes)} Listy Gifty can download at once.")
    end

    def too_slow
      Invalid.new("Couldn't download the link: the website took too long to send it.")
    end

    def now
      Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end
  end
end
