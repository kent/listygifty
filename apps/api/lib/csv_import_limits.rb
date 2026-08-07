module CsvImportLimits
  MAX_FILE_BYTES = 1024 * 1024
  MAX_ROWS = 500

  class PayloadTooLarge < StandardError; end
  class TooManyRows < StandardError; end

  module_function

  def read(file)
    io = file.respond_to?(:read) ? file : file.tempfile
    content = io.read(MAX_FILE_BYTES + 1)
    raise PayloadTooLarge, "CSV import exceeds #{MAX_FILE_BYTES} bytes" if content.bytesize > MAX_FILE_BYTES

    content
  end

  def validate_rows!(csv)
    raise TooManyRows, "CSV import exceeds #{MAX_ROWS} data rows" if csv.length > MAX_ROWS

    csv
  end
end
