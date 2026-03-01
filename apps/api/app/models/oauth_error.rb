# Custom OAuth error class for consistent error handling
class OauthError < StandardError
  attr_reader :error_code, :error_description

  def initialize(error_code, error_description = nil)
    @error_code = error_code
    @error_description = error_description
    super(error_description || error_code)
  end

  def to_h
    { error: error_code, error_description: error_description }.compact
  end
end
