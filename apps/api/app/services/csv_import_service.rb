# frozen_string_literal: true

require "csv"

class CsvImportService
  PEOPLE_HEADERS = %w[name email relationship age gender birthday notes].freeze
  ADDRESS_HEADERS = %w[address_label street_line_1 street_line_2 city state postal_code country is_default].freeze
  ADDRESS_REQUIRED_HEADERS = %w[street_line_1 city postal_code].freeze
  VALID_HEADERS = (PEOPLE_HEADERS + ADDRESS_HEADERS).freeze
  REQUIRED_HEADERS = %w[name].freeze

  def self.import_people(file:, workspace:, created_by:)
    new(file: file, workspace: workspace, created_by: created_by).import
  end

  def initialize(file:, workspace:, created_by:)
    @file = file
    @workspace = workspace
    @created_by = created_by
    @created = []
    @skipped = 0
    @addresses_created = 0
    @addresses_skipped = 0
    @errors = []
  end

  def import
    csv_content = @file.respond_to?(:read) ? @file.read : @file.tempfile.read
    csv = CSV.parse(csv_content, headers: true, header_converters: ->(header) { normalize_header(header) })

    validate_headers!(csv.headers)
    return error_result if @errors.any?

    csv.each_with_index do |row, index|
      process_row(row, index)
    end

    {
      created: @created.count,
      skipped: @skipped,
      addresses_created: @addresses_created,
      addresses_skipped: @addresses_skipped,
      errors: @errors,
      people: @created
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
    if missing.any?
      @errors << "Missing required columns: #{missing.join(', ')}"
    end

    unknown = headers - VALID_HEADERS
    if unknown.any?
      @errors << "Unknown columns will be ignored: #{unknown.join(', ')}"
    end
  end

  def process_row(row, index)
    name = row["name"]&.strip
    email = row["email"]&.strip&.downcase

    if name.blank?
      @errors << "Row #{index + 2}: Name is required"
      return
    end

    if email.present? && @workspace.people.exists?(email: email)
      @skipped += 1
      return
    end

    person = @workspace.people.build(
      name: name,
      email: email.presence,
      relationship: row["relationship"]&.strip.presence,
      age: parse_age(row["age"]),
      gender: row["gender"]&.strip.presence,
      birthday: parse_birthday(row["birthday"], index),
      notes: row["notes"]&.strip.presence,
      user: @created_by
    )

    if person.save
      @created << person
      import_address_for(person, row, index) if address_data_present?(row)
    else
      @errors << "Row #{index + 2}: #{person.errors.full_messages.join(', ')}"
    end
  end

  def address_data_present?(row)
    (ADDRESS_HEADERS - %w[is_default]).any? { |header| row[header].present? }
  end

  def import_address_for(person, row, index)
    unless @workspace.business?
      @errors << "Row #{index + 2}: Address columns are only imported for business workspaces"
      return
    end

    missing = ADDRESS_REQUIRED_HEADERS.select { |header| row[header].blank? }
    if missing.any?
      @errors << "Row #{index + 2}: Address requires #{missing.join(', ')}"
      return
    end

    label = row["address_label"]&.strip.presence || person.name
    if company_profile.addresses.exists?(label: label)
      @addresses_skipped += 1
      return
    end

    address = company_profile.addresses.build(
      label: label,
      street_line_1: row["street_line_1"]&.strip,
      street_line_2: row["street_line_2"]&.strip.presence,
      city: row["city"]&.strip,
      state: row["state"]&.strip.presence,
      postal_code: row["postal_code"]&.strip,
      country: row["country"]&.strip.presence || "CA",
      is_default: truthy?(row["is_default"])
    )

    if address.save
      person.update!(default_shipping_address: address)
      @addresses_created += 1
    else
      @errors << "Row #{index + 2}: Address #{address.errors.full_messages.join(', ')}"
    end
  end

  def company_profile
    @company_profile ||= @workspace.company_profile || @workspace.create_company_profile!(name: @workspace.name)
  end

  def truthy?(value)
    value.to_s.strip.downcase.in?(%w[true yes y 1])
  end

  def parse_age(value)
    return nil if value.blank?
    Integer(value.to_s.strip)
  rescue ArgumentError
    nil
  end

  def parse_birthday(value, index)
    return nil if value.blank?

    Date.iso8601(value.to_s.strip)
  rescue Date::Error
    @errors << "Row #{index + 2}: Birthday must use YYYY-MM-DD"
    nil
  end

  def error_result
    {
      created: 0,
      skipped: 0,
      addresses_created: 0,
      addresses_skipped: 0,
      errors: @errors,
      people: []
    }
  end
end
