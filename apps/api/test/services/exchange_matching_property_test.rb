require "test_helper"

# Randomized check of the draw rules. A failure prints its seed, so a bad draw
# can be replayed with MATCHING_SEED=<seed>.
class ExchangeMatchingPropertyTest < ActiveSupport::TestCase
  RUNS = 1_000
  MAX_ACCEPTED = 8
  MAX_PENDING = 2

  setup do
    @seed = ENV.fetch("MATCHING_SEED", Random.new_seed % 1_000_000).to_i
    @random = Random.new(@seed)
    srand(@seed)
  end

  test "random draws honour every rule and only refuse truly impossible groups" do
    outcomes = Hash.new(0)

    RUNS.times do |run|
      exchange, accepted, pending, exclusions = build_exchange(run)
      failure_context = "seed=#{@seed} run=#{run} group=#{accepted.size} exclusions=#{exclusions.size}"

      begin
        matches = ExchangeMatchingService.new(exchange).perform!
      rescue ExchangeMatchingService::ImpossibleMatchError
        refute valid_draw_exists?(accepted, exclusions), "Refused a possible draw (#{failure_context})"
        outcomes[:refused] += 1
        next
      end

      assert_rules_hold(matches, accepted, exclusions, failure_context)
      assert_equal matches, exchange.exchange_participants.accepted.pluck(:id, :matched_participant_id).to_h,
                   "Saved matches differ from the draw (#{failure_context})"
      assert pending.all? { |participant| participant.reload.status == "declined" && participant.matched_participant_id.nil? },
             "A pending invitee was drawn (#{failure_context})"
      outcomes[:drawn] += 1
    end

    # Random exclusions leave about half the groups with no valid draw.
    assert_operator outcomes[:drawn], :>, RUNS / 4, "Too few draws to prove anything: #{outcomes} seed=#{@seed}"
    assert_operator outcomes[:refused], :>, 0, "No impossible group was generated: #{outcomes} seed=#{@seed}"
  end

  test "random redraws give everyone a new match and keep every rule" do
    redrawn = 0

    (RUNS / 10).times do |run|
      exchange, accepted, _pending, exclusions = build_exchange(run)
      service = ExchangeMatchingService.new(exchange)
      first_draw = begin
        service.perform!
      rescue ExchangeMatchingService::ImpossibleMatchError
        next
      end

      failure_context = "seed=#{@seed} run=#{run} group=#{accepted.size} exclusions=#{exclusions.size}"
      begin
        second_draw = service.perform!(redraw: true)
      rescue ExchangeMatchingService::ImpossibleMatchError
        refute valid_draw_exists?(accepted, exclusions, previous: first_draw), "Refused a possible redraw (#{failure_context})"
        next
      end

      assert_rules_hold(second_draw, accepted, exclusions, failure_context)
      first_draw.each do |giver_id, receiver_id|
        refute_equal receiver_id, second_draw.fetch(giver_id), "Redraw kept a match (#{failure_context})"
      end
      redrawn += 1
    end

    assert_operator redrawn, :>, 0, "No redraw was exercised, seed=#{@seed}"
  end

  private

  def build_exchange(run)
    exchange = GiftExchange.create!(
      workspace: workspaces(:one),
      user: users(:one),
      name: "Property Exchange #{run}",
      status: "inviting"
    )
    accepted = Array.new(@random.rand(2..MAX_ACCEPTED)) { |index| add_participant(exchange, "a#{index}", "accepted") }
    pending = Array.new(@random.rand(0..MAX_PENDING)) { |index| add_participant(exchange, "p#{index}", "invited") }

    pairs = accepted.combination(2).to_a
    exclusions = pairs.sample(@random.rand(0..pairs.size), random: @random).map do |first, second|
      exchange.exchange_exclusions.create!(participant_a: first, participant_b: second)
      [ first.id, second.id ].sort
    end

    [ exchange, accepted, pending, exclusions.to_set ]
  end

  def add_participant(exchange, label, status)
    exchange.exchange_participants.create!(
      name: label,
      email: "#{label}-#{exchange.id}@example.com",
      status: status
    )
  end

  def assert_rules_hold(matches, accepted, exclusions, failure_context)
    ids = accepted.map(&:id).sort
    assert_equal ids, matches.keys.sort, "Not everyone gives exactly once (#{failure_context})"
    assert_equal ids, matches.values.sort, "Not everyone receives exactly once (#{failure_context})"

    matches.each do |giver_id, receiver_id|
      refute_equal giver_id, receiver_id, "Someone drew themselves (#{failure_context})"
      refute_includes exclusions, [ giver_id, receiver_id ].sort, "An exclusion was broken (#{failure_context})"
    end
  end

  # Independent oracle: walks every assignment instead of reusing the service.
  def valid_draw_exists?(accepted, exclusions, previous: {})
    ids = accepted.map(&:id)
    ids.permutation.any? do |receivers|
      ids.zip(receivers).all? do |giver_id, receiver_id|
        giver_id != receiver_id &&
          previous[giver_id] != receiver_id &&
          !exclusions.include?([ giver_id, receiver_id ].sort)
      end
    end
  end
end
