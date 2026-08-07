class GiftSuggestion < ApplicationRecord
  belongs_to :person
  belongs_to :holiday, optional: true

  validates :name, presence: true, length: { maximum: 500 }
  validates :description, length: { maximum: 5_000 }, allow_blank: true
  validates :approximate_price, length: { maximum: 100 }, allow_blank: true
end
