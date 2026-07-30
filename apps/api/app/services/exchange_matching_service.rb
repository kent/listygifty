class ExchangeMatchingService
  class MatchingError < StandardError; end
  class ImpossibleMatchError < MatchingError; end

  def initialize(gift_exchange)
    @exchange = gift_exchange
  end

  def perform!(redraw: false)
    @exchange.with_lock do
      @redraw = redraw
      @participants = @exchange.exchange_participants.accepted.to_a
      @exclusions = build_exclusion_set
      validate_can_match!
      matches = find_valid_matching
      apply_matches!(matches)
      matches
    end
  end

  def validate_can_match!
    valid_status = @redraw ? %w[active completed].include?(@exchange.status) : @exchange.status == "inviting"
    raise MatchingError, invalid_status_message unless valid_status
    raise MatchingError, "Need at least 3 participants" if @participants.size < 3
    return if matching_possible?

    message = @redraw ?
      "A completely new draw is not possible with the current exclusion rules" :
      "No valid matching exists"
    raise ImpossibleMatchError, message
  end

  private

  def build_exclusion_set
    exclusions = Set.new
    @exchange.exchange_exclusions.each do |e|
      exclusions.add([ e.participant_a_id, e.participant_b_id ].sort)
    end
    exclusions
  end

  def excluded?(giver, receiver)
    return true if giver.id == receiver.id # Can't give to yourself
    return true if @redraw && giver.matched_participant_id == receiver.id

    @exclusions.include?([ giver.id, receiver.id ].sort)
  end

  def can_give_to?(giver, receiver)
    !excluded?(giver, receiver)
  end

  # Build adjacency list of valid giver -> receivers
  def build_graph
    graph = {}
    @participants.each do |giver|
      graph[giver.id] = @participants.select { |receiver| can_give_to?(giver, receiver) }.map(&:id)
    end
    graph
  end

  # Check if a valid matching is possible using Hall's theorem approximation
  def matching_possible?
    graph = build_graph
    # Each participant must have at least one valid receiver
    return false if graph.values.any?(&:empty?)
    # Try to find a matching
    !find_matching_recursive(graph, {}, @participants.map(&:id)).nil?
  end

  def find_valid_matching
    graph = build_graph
    participant_ids = @participants.map(&:id).shuffle # Randomize for variety

    # Try multiple times with different orderings
    10.times do
      result = find_matching_recursive(graph, {}, participant_ids.shuffle)
      return result if result
    end

    raise ImpossibleMatchError, "Could not find a valid matching after multiple attempts"
  end

  # Recursive backtracking to find a valid matching
  # Returns a hash of { giver_id => receiver_id } or nil if impossible
  def find_matching_recursive(graph, current_matching, remaining_givers)
    return current_matching if remaining_givers.empty?

    giver_id = remaining_givers.first
    remaining = remaining_givers[1..]

    # Get possible receivers not already assigned
    assigned_receivers = current_matching.values.to_set
    possible_receivers = graph[giver_id].reject { |r| assigned_receivers.include?(r) }

    # Try each possible receiver
    possible_receivers.shuffle.each do |receiver_id|
      new_matching = current_matching.merge(giver_id => receiver_id)
      result = find_matching_recursive(graph, new_matching, remaining)
      return result if result
    end

    nil # No valid matching found
  end

  def apply_matches!(matches)
    @exchange.exchange_participants.invited.update_all(status: "declined", updated_at: Time.current)
    @participants.each do |participant|
      matched_id = matches[participant.id]
      participant.update!(matched_participant_id: matched_id)
    end
    @exchange.update!(status: "active", published_at: Time.current)
  end

  def invalid_status_message
    @redraw ? "Only a published exchange can be redrawn" : "Exchange is not in inviting status"
  end
end
