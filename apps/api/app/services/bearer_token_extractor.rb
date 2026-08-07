class BearerTokenExtractor
  MAX_HEADER_BYTES = 512
  TOKEN_PATTERN = /\ABearer[ \t]+([A-Za-z0-9._~-]{20,256})\z/i

  def self.extract(header)
    return nil unless header.is_a?(String) && header.bytesize <= MAX_HEADER_BYTES

    TOKEN_PATTERN.match(header)&.[](1)
  end
end
