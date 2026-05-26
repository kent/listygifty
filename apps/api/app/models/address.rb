# frozen_string_literal: true

class Address < ApplicationRecord
  belongs_to :company_profile
  has_many :gift_recipients, foreign_key: :shipping_address_id, dependent: :nullify
  has_many :default_shipping_people,
    class_name: "Person",
    foreign_key: :default_shipping_address_id,
    dependent: :nullify,
    inverse_of: :default_shipping_address

  validates :label, presence: true, uniqueness: { scope: :company_profile_id, message: "already exists for this company" }
  validates :street_line_1, presence: true
  validates :city, presence: true
  validates :postal_code, presence: true
  validates :country, presence: true

  before_save :ensure_single_default

  scope :default_first, -> { order(is_default: :desc, label: :asc) }

  delegate :workspace, to: :company_profile

  def formatted_address
    lines = [
      street_line_1,
      street_line_2.presence,
      [ city, state ].compact.join(", "),
      postal_code,
      country
    ].compact.reject(&:blank?)
    lines.join("\n")
  end

  def formatted_address_single_line
    parts = [
      street_line_1,
      street_line_2.presence,
      city,
      state,
      postal_code,
      country
    ].compact.reject(&:blank?)
    parts.join(", ")
  end

  private

  def ensure_single_default
    return unless is_default? && is_default_changed?

    Address.where(company_profile_id: company_profile_id)
           .where.not(id: id)
           .update_all(is_default: false)
  end
end
