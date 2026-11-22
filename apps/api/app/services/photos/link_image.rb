module Photos
  # The main picture on a product page, for gifts and wishlist items that
  # come with a link but no photo. Tries og:image, then twitter:image, then a
  # JSON-LD Product's image, then link rel=image_src and itemprop=image.
  module LinkImage
    PAGE_BYTES = 2 * 1024 * 1024
    PAGE_ACCEPT = "text/html,application/xhtml+xml;q=0.9,image/*;q=0.8,*/*;q=0.5".freeze
    MAX_ATTEMPTS = 3
    MAX_JSON_DEPTH = 8

    module_function

    # An attachable, or nil when the page has no picture that works. Raises
    # Invalid when the page itself can't be fetched.
    def call(link)
      page = Download.call(link, accept: PAGE_ACCEPT, max_bytes: PAGE_BYTES, truncate: true)
      return Intake.call("url" => page.url) if page.content_type.to_s.start_with?("image/")

      candidates(page.body, page.url).first(MAX_ATTEMPTS).each do |url|
        return Intake.call("url" => url)
      rescue Invalid
        next
      end
      nil
    end

    # Image links on the page, best first, as absolute http(s) URLs. The head
    # is all that matters, so a page cut off at PAGE_BYTES still works.
    def candidates(html, base)
      doc = Nokogiri::HTML(html)
      found = meta(doc, %w[og:image:secure_url og:image og:image:url]) +
        meta(doc, %w[twitter:image twitter:image:src]) +
        json_ld_images(doc) +
        doc.css('link[rel~="image_src"]').map { |node| node["href"] } +
        doc.css('[itemprop="image"]').map { |node| node["content"] || node["src"] || node["href"] }
      found.filter_map { |url| absolute(url, base) }.uniq
    end

    def meta(doc, names)
      names.flat_map do |name|
        doc.css(%(meta[property="#{name}"], meta[name="#{name}"])).map { |node| node["content"] }
      end
    end

    def json_ld_images(doc)
      doc.css('script[type="application/ld+json"]').flat_map do |script|
        product_images(JSON.parse(script.text, max_nesting: 32))
      rescue JSON::ParserError, JSON::NestingError
        []
      end
    end

    def product_images(node, depth = 0)
      return [] if depth > MAX_JSON_DEPTH

      case node
      when Array then node.flat_map { |child| product_images(child, depth + 1) }
      when Hash
        own = Array(node["@type"]).any? { |type| type.to_s.match?(/Product(Group)?\z/) } ? image_urls(node["image"]) : []
        own + node.except("image").values.flat_map { |child| product_images(child, depth + 1) }
      else []
      end
    end

    def image_urls(value)
      case value
      when String then [ value ]
      when Array then value.flat_map { |item| image_urls(item) }
      when Hash then [ value["url"] || value["contentUrl"] ].compact.grep(String)
      else []
      end
    end

    def absolute(url, base)
      return if url.blank?

      uri = URI.join(base, url.strip)
      uri.to_s if uri.is_a?(URI::HTTP)
    rescue URI::Error, ArgumentError
      nil
    end
  end
end
