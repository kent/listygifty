class GiftSuggestionService
  SUGGESTION_COUNT = 7
  MAX_REFINEMENT_SUGGESTIONS = SUGGESTION_COUNT
  MAX_NAME_BYTES = 500
  MAX_DESCRIPTION_BYTES = 5_000
  MAX_PRICE_BYTES = 100

  def initialize(person, user)
    @person = person
    @user = user
  end

  # Generate general suggestions (no holiday context)
  def generate
    previous_gifts = @person.gifts_received
      .where(holiday_id: @user.holiday_ids)
      .includes(:holiday)
      .limit(20)
    prompt = build_prompt(nil, previous_gifts)
    suggestions_data = validate_suggestions_data!(
      call_openai(prompt), expected_count: SUGGESTION_COUNT
    )

    suggestions_data.map do |data|
      @person.gift_suggestions.create!(
        name: data["name"],
        description: data["description"],
        approximate_price: data["approximate_price"],
        holiday: nil
      )
    end
  end

  # Refine existing suggestions for a specific holiday
  def refine_for_holiday(suggestion_ids, holiday)
    raw_ids = Array(suggestion_ids)
    unless raw_ids.length.between?(1, MAX_REFINEMENT_SUGGESTIONS)
      raise ArgumentError, "Select between 1 and #{MAX_REFINEMENT_SUGGESTIONS} suggestions"
    end
    requested_ids = raw_ids.map { |id| Integer(id) }.uniq
    suggestions = visible_suggestions.where(id: requested_ids)
    raise ActiveRecord::RecordNotFound unless suggestions.count == requested_ids.length

    prompt = build_refine_prompt(suggestions, holiday)
    refined_data = validate_suggestions_data!(
      call_openai(prompt), expected_count: suggestions.count
    )

    # Create new refined suggestions tied to holiday, delete originals
    GiftSuggestion.transaction do
      new_suggestions = refined_data.map do |data|
        @person.gift_suggestions.create!(
          name: data["name"],
          description: data["description"],
          approximate_price: data["approximate_price"],
          holiday: holiday
        )
      end
      suggestions.destroy_all
      new_suggestions
    end
  end

  private

  def validate_suggestions_data!(data, expected_count:)
    valid = data.is_a?(Array) && data.length == expected_count && data.all? do |suggestion|
      suggestion.is_a?(Hash) &&
        suggestion["name"].is_a?(String) && suggestion["name"].present? &&
        suggestion["name"].bytesize <= MAX_NAME_BYTES &&
        suggestion["description"].is_a?(String) &&
        suggestion["description"].bytesize <= MAX_DESCRIPTION_BYTES &&
        suggestion["approximate_price"].is_a?(String) &&
        suggestion["approximate_price"].bytesize <= MAX_PRICE_BYTES
    end
    raise ArgumentError, "Gift suggestion response was invalid" unless valid

    data
  end

  def visible_suggestions
    suggestions = @person.gift_suggestions
    holiday_ids = if @person.workspace.member?(@user)
      @user.holiday_ids
    else
      @person.shared_holidays.where(id: @user.holiday_ids).ids
    end
    visible = suggestions.where(holiday_id: holiday_ids)
    @person.workspace.member?(@user) ? visible.or(suggestions.where(holiday_id: nil)) : visible
  end

  def build_prompt(holiday, previous_gifts)
    age_info = @person.age ? "#{@person.age} years old" : "unknown age"
    relationship_info = @person.relationship || "unspecified relationship"
    occasion_info = holiday ? "for #{holiday.name}" : "for any occasion (general gift ideas)"

    previous_gifts_text = if previous_gifts.any?
      gifts_list = previous_gifts.map { |g| "- #{g.name}" }.join("\n")
      "They have previously received:\n#{gifts_list}"
    else
      "No previous gift history."
    end

    <<~PROMPT
      Generate #{SUGGESTION_COUNT} thoughtful gift suggestions for someone with the following profile:
      - Age: #{age_info}
      - Relationship: #{relationship_info}
      - Occasion: #{occasion_info}

      #{previous_gifts_text}

      Requirements:
      - Suggest unique gifts not in their previous gift history
      - Include a mix of price ranges
      - Be specific (e.g., "Ember Temperature Control Smart Mug" not just "mug")
      - Consider the relationship appropriateness

      Return a JSON array with exactly #{SUGGESTION_COUNT} objects, each with:
      - "name": specific gift name (string)
      - "description": brief description of why this is a good gift (string, 1-2 sentences)
      - "approximate_price": price estimate like "$25" or "$50-75" (string)

      Return only the JSON array, no other text.
    PROMPT
  end

  def build_refine_prompt(suggestions, holiday)
    age_info = @person.age ? "#{@person.age} years old" : "unknown age"
    relationship_info = @person.relationship || "unspecified relationship"

    suggestions_list = suggestions.map do |s|
      "- #{s.name} (#{s.approximate_price}): #{s.description}"
    end.join("\n")

    <<~PROMPT
      I have these gift suggestions for a #{relationship_info} who is #{age_info}:

      #{suggestions_list}

      Refine these suggestions specifically for #{holiday.name}. For each suggestion:
      - Keep it if it's appropriate for #{holiday.name}
      - Modify it to be more #{holiday.name}-themed if possible
      - Replace it with a better #{holiday.name}-appropriate alternative if needed

      Return a JSON array with #{suggestions.count} objects (same count as input), each with:
      - "name": specific gift name (string)
      - "description": brief description mentioning why it's good for #{holiday.name} (string, 1-2 sentences)
      - "approximate_price": price estimate like "$25" or "$50-75" (string)

      Return only the JSON array, no other text.
    PROMPT
  end

  def call_openai(prompt)
    client = OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY"))

    response = client.chat(
      parameters: {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful gift recommendation assistant. Always respond with valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
        max_completion_tokens: 1500
      }
    )

    content = response.dig("choices", 0, "message", "content")
    JSON.parse(content)
  rescue JSON::ParserError => e
    Rails.logger.error("Failed to parse OpenAI response: #{e.message}")
    raise "Failed to generate suggestions. Please try again."
  rescue Faraday::Error => e
    Rails.logger.error("OpenAI API error: #{e.message}")
    Rails.logger.error("Response body: #{e.response_body}") if e.respond_to?(:response_body)
    raise "Failed to connect to AI service. Please try again."
  end
end
