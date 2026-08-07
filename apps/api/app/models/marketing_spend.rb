class MarketingSpend < ApplicationRecord
  validates :spend_date, :channel, :source, :amount, :currency, presence: true
  validates :amount, numericality: { greater_than_or_equal_to: 0 }
  validates :impressions, :clicks, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :currency, format: { with: /\A[A-Z]{3}\z/ }
  validates :source, uniqueness: { scope: %i[spend_date medium campaign] }

  before_validation :normalize_values

  private

  def normalize_values
    self.channel = channel.to_s.strip.downcase
    self.source = source.to_s.strip.downcase
    self.medium = medium.to_s.strip.downcase
    self.campaign = campaign.to_s.strip
    self.currency = currency.to_s.strip.upcase.presence || "USD"
  end
end
