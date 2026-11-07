# Phone numbers are stored in E.164 form (+12893797875), which is what Twilio
# expects. People type them every which way, so this tidies what they typed.
# A bare 10-digit number is North American, since that's where Listy Gifty
# texts today.
module PhoneNumber
  E164 = /\A\+[1-9]\d{7,14}\z/

  # Canada's area codes, including the non-geographic ones. US carriers only
  # take texts from registered numbers, so Listy Gifty texts Canadian and US
  # numbers from different senders. See TextMessenger.sender_for.
  CANADIAN_AREA_CODES = %w[
    204 226 236 249 250 257 263 289 306 343 354 365 367 368 382 387 403 416
    418 428 431 437 438 450 460 468 474 506 514 519 548 579 581 584 587 600
    604 613 622 633 639 644 647 655 672 677 683 688 705 709 742 753 778 780
    782 807 819 825 867 873 879 902 905 942
  ].to_set.freeze

  module_function

  # A North American number outside Canada. That's nearly always the US, and
  # the few Caribbean numbers that share +1 follow the same carrier rules.
  def us?(value)
    value.to_s.match?(/\A\+1\d{10}\z/) && !CANADIAN_AREA_CODES.include?(value[2, 3])
  end

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
