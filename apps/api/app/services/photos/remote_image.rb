require "net/http"

module Photos
  # Downloads a picture from a public web address. Each hop is resolved once
  # and connected to by that address, so neither DNS nor a redirect can point
  # the request at Listy Gifty's own network or the cloud metadata server.
  class RemoteImage
    MAX_REDIRECTS = 3
    TIMEOUT = 5
    DEADLINE = 20
    USER_AGENT = "ListyGifty/1.0 (+https://listygifty.com)".freeze
    BLOCKED_NETWORKS = %w[
      0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12
      192.0.0.0/24 192.0.2.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24
      203.0.113.0/24 224.0.0.0/4 240.0.0.0/4
      ::/128 ::1/128 64:ff9b::/96 100::/64 2001::/32 2001:db8::/32 2002::/16
      fc00::/7 fe80::/10 ff00::/8
    ].map { |network| IPAddr.new(network) }.freeze

    def self.fetch(url)
      new(url).fetch
    end

    def self.blocked?(address)
      ip = address.native
      BLOCKED_NETWORKS.any? { |network| network.include?(ip) }
    end

    def initialize(url)
      @url = url
      @deadline = now + DEADLINE
    end

    # The body as a binary String.
    def fetch
      uri = parse(@url)
      (MAX_REDIRECTS + 1).times do
        result = get(uri)
        return result if result.is_a?(String)

        uri = result
      end
      raise Invalid, "photo.url redirected more than #{MAX_REDIRECTS} times. Send the image's direct link."
    end

    private

    def get(uri)
      raise too_slow if now > @deadline

      http = Net::HTTP.new(uri.hostname, uri.port, nil)
      http.ipaddr = public_address(uri.hostname)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = http.read_timeout = http.write_timeout = http.ssl_timeout = TIMEOUT
      http.start do
        request = Net::HTTP::Get.new(uri, "Accept" => "image/*", "Accept-Encoding" => "identity", "User-Agent" => USER_AGENT)
        http.request(request) { |response| return handle(uri, response) }
      end
    rescue Net::OpenTimeout, Net::ReadTimeout, Net::WriteTimeout
      raise too_slow
    rescue SocketError, SystemCallError, IOError, OpenSSL::SSL::SSLError, Net::HTTPBadResponse, Net::ProtocolError
      raise Invalid, "Couldn't download photo.url: the connection to the website failed."
    end

    def handle(uri, response)
      case response
      when Net::HTTPSuccess
        read(response)
      when Net::HTTPRedirection
        location = response["location"].presence
        raise Invalid, "photo.url redirected without saying where to." unless location

        parse(location, base: uri)
      else
        raise Invalid, "Couldn't download photo.url: the website answered #{response.code}."
      end
    end

    def read(response)
      limit = HasPhoto::MAX_PHOTO_BYTES
      declared = response.content_length
      raise too_large(declared) if declared && declared > limit

      body = String.new(encoding: Encoding::BINARY)
      response.read_body do |chunk|
        body << chunk
        raise too_large if body.bytesize > limit
        raise too_slow if now > @deadline
      end
      body
    end

    def parse(url, base: nil)
      url = url.to_s.strip
      uri = base ? base.merge(url) : URI.parse(url)
      return uri if uri.is_a?(URI::HTTP) && uri.hostname.present? && uri.userinfo.nil?

      raise Invalid, "photo.url must be an http or https link to an image."
    rescue URI::Error
      raise Invalid, "photo.url isn't a valid link."
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
      raise Invalid, "Couldn't find the website in photo.url. Check the link."
    end

    def private_address
      Invalid.new("photo.url points to a private or local network address. Send a public link to the image.")
    end

    def too_large(bytes = nil)
      size = bytes ? " is #{Photos.human_size(bytes)}, which" : ""
      Invalid.new("The image at photo.url#{size} is over the #{Photos.human_size(HasPhoto::MAX_PHOTO_BYTES)} limit. " \
        "Send a smaller version.")
    end

    def too_slow
      Invalid.new("Couldn't download photo.url: the website took too long to send it.")
    end

    def now
      Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end
  end
end
