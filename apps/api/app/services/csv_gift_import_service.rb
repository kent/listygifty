# frozen_string_literal: true

require "csv"

class CsvGiftImportService
  VALID_HEADERS = %w[
    name
    description
    cost
    status
    link
    recipient_name
    recipient_email
    giver_name
    giver_email
  ].freeze
  REQUIRED_HEADERS = %w[name].freeze

  def self.import_gifts(file:, workspace:, holiday:, created_by:)
    new(file: file, workspace: workspace, holiday: holiday, created_by: created_by).import
  end

  def initialize(file:, workspace:, holiday:, created_by:)
    @file = file
    @workspace = workspace
    @holiday = holiday
    @created_by = created_by
    @created = []
    @people_created = 0
    @errors = []
  end

  def import
    csv_content = CsvImportLimits.read(@file)
    csv = CSV.parse(csv_content, headers: true, header_converters: ->(header) { normalize_header(header) })
    CsvImportLimits.validate_rows!(csv)

    validate_headers!(csv.headers)
    return error_result if @errors.any?

    csv.each_with_index do |row, index|
      process_row(row, index)
    end

    {
      created: @created.count,
      people_created: @people_created,
      errors: @errors,
      gifts: @created
    }
  rescue CSV::MalformedCSVError => e
    @errors << "Invalid CSV format: #{e.message}"
    error_result
  end

  private

  def normalize_header(header)
    header.to_s.strip.downcase.gsub(/\s+/, "_")
  end

  def validate_headers!(headers)
    headers = headers.compact.map(&:strip)

    missing = REQUIRED_HEADERS - headers
    @errors << "Missing required columns: #{missing.join(', ')}" if missing.any?

    unknown = headers - VALID_HEADERS
    @errors << "Unknown columns will be ignored: #{unknown.join(', ')}" if unknown.any?
  end

  def process_row(row, index)
    name = row["name"]&.strip
    if name.blank?
      @errors << "Row #{index + 2}: Name is required"
      return
    end

    gift = Gifts::MutationService.new(@created_by).create(
      holiday_id: @holiday.id,
      name: name,
      description: row["description"]&.strip.presence,
      cost: parse_cost(row["cost"], index),
      link: row["link"]&.strip.presence,
      gift_status_id: gift_status_for(row)&.id
    )
    recipient = person_for(row, index, :recipient)
    giver = person_for(row, index, :giver)
    Gifts::MutationService.new(@created_by).update(
      gift,
      recipient_ids: Array(recipient&.id),
      giver_ids: Array(giver&.id)
    )
    @created << gift
  rescue Gifts::MutationService::LimitExceeded => e
    @errors << "Row #{index + 2}: #{e.message}"
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Row #{index + 2}: #{e.record.errors.full_messages.join(', ')}"
  rescue ActiveRecord::RecordNotFound
    @errors << "Row #{index + 2}: Holiday, gift status, or person is not accessible"
  end

  def parse_cost(value, index)
    return nil if value.blank?

    BigDecimal(value.to_s.strip)
  rescue ArgumentError
    @errors << "Row #{index + 2}: Cost must be a number"
    nil
  end

  def gift_status_for(row)
    requested_status = row["status"]&.strip
    return default_status if requested_status.blank?

    GiftStatus.find_by("LOWER(name) = ?", requested_status.downcase) || default_status
  end

  def default_status
    @default_status ||= GiftStatus.order(:position, :id).first
  end

  def person_for(row, index, role)
    name = row["#{role}_name"]&.strip
    email = row["#{role}_email"]&.strip&.downcase
    return nil if name.blank? && email.blank?

    existing = find_person(name:, email:)
    return existing if existing

    create_person(name:, email:, index:, role:)
  end

  def find_person(name:, email:)
    if email.present?
      @workspace.people.find_by(email: email)
    elsif name.present?
      @workspace.people.find_by("LOWER(name) = ?", name.downcase)
    end
  end

  def create_person(name:, email:, index:, role:)
    person = @workspace.people.create!(
      name: name.presence || email,
      email: email.presence,
      user: @created_by
    )
    @people_created += 1
    person
  rescue ActiveRecord::RecordInvalid => e
    @errors << "Row #{index + 2}: #{role.to_s.humanize} #{e.record.errors.full_messages.join(', ')}"
    nil
  end

  def error_result
    {
      created: 0,
      people_created: 0,
      errors: @errors,
      gifts: []
    }
  end
end
