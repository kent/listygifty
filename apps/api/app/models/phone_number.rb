# Phone numbers are stored in E.164 form (+12893797875), which is what Twilio
# expects. People type them every which way, so this tidies what they typed.
# A bare 10-digit number is North American, since that's where Listy Gifty
# texts today.
module PhoneNumber
  E164 = /\A\+[1-9]\d{7,14}\z/

  module_function

  # Returns the E.164 form, nil for a blank value, or the trimmed input when
  # it can't be read as a number, so validation can say so.
  def normalize(value)
    return nil if value.blank?

    raw = value.to_s.strip
    digits = raw.gsub(/\D/, "")
    return raw if digits.empty? || raw.match?(/[a-z]/i)

    if raw.start_with?("+")
      "+#{digits}"
    elsif digits.length == 10
      "+1#{digits}"
    elsif digits.length == 11 && digits.start_with?("1")
      "+#{digits}"
    else
      raw
    end
  end

  # (289) 379-7875 for North American numbers, the E.164 form otherwise.
  def display(value)
    return nil if value.blank?
    return value unless value.match?(/\A\+1\d{10}\z/)

    "(#{value[2, 3]}) #{value[5, 3]}-#{value[8, 4]}"
  end
end
