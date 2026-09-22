module CsvImportLimits
  MAX_FILE_BYTES = 1024 * 1024
  MAX_ROWS = 500

  class InvalidFile < StandardError; end
  class PayloadTooLarge < StandardError; end
  class TooManyRows < StandardError; end

  module_function

  def read(file)
    io = file.respond_to?(:read) ? file : file.try(:tempfile)
    raise InvalidFile, "Provide an uploaded CSV file" unless io.respond_to?(:read)

    content = io.read(MAX_FILE_BYTES + 1).to_s
    raise PayloadTooLarge, "CSV import exceeds #{MAX_FILE_BYTES} bytes" if content.bytesize > MAX_FILE_BYTES

    content
  end

  def validate_rows!(csv)
    raise TooManyRows, "CSV import exceeds #{MAX_ROWS} data rows" if csv.length > MAX_ROWS

    csv
  end
end
