require "test_helper"

class ExchangeMatchingServiceTest < ActiveSupport::TestCase
  setup do
    @owner = users(:one)
    @workspace = workspaces(:one)
    @exchange = GiftExchange.create!(
      workspace: @workspace,
      user: @owner,
      name: "Match Test Exchange",
      status: "inviting"
    )
    @participants = 4.times.map do |i|
      @exchange.exchange_participants.create!(
        name: "Person #{i + 1}",
        email: "person#{i + 1}@example.com",
        status: "accepted"
      )
    end
  end

  test "produces a valid derangement (no one matched to self)" do
    service = ExchangeMatchingService.new(@exchange)
    matches = service.perform!

    matches.each do |giver_id, receiver_id|
      refute_equal giver_id, receiver_id, "Participant #{giver_id} was matched to self"
    end
  end

  test "every participant gives and receives exactly once" do
    service = ExchangeMatchingService.new(@exchange)
    matches = service.perform!

    givers = matches.keys
    receivers = matches.values

    assert_equal @participants.size, givers.size
    assert_equal @participants.size, receivers.size
    assert_equal givers.sort, receivers.sort, "Givers and receivers must be the same set"
    assert_equal receivers.uniq.size, receivers.size, "Each receiver must be unique"
  end

  test "respects exclusion rules" do
    excluded_pair = @participants.first(2)
    @exchange.exchange_exclusions.create!(
      participant_a: excluded_pair[0],
      participant_b: excluded_pair[1]
    )

    service = ExchangeMatchingService.new(@exchange)
    matches = service.perform!

    refute_equal excluded_pair[1].id, matches[excluded_pair[0].id]
    refute_equal excluded_pair[0].id, matches[excluded_pair[1].id]
  end

  test "moves exchange to active and persists matched_participant_id" do
    service = ExchangeMatchingService.new(@exchange)
    service.perform!

    @exchange.reload
    assert_equal "active", @exchange.status
    @participants.each do |p|
      p.reload
      assert_not_nil p.matched_participant_id
    end
  end

  test "redraw gives every participant a different recipient" do
    service = ExchangeMatchingService.new(@exchange)
    first_draw = service.perform!
    second_draw = service.perform!(redraw: true)

    first_draw.each do |giver_id, receiver_id|
      refute_equal receiver_id, second_draw.fetch(giver_id)
    end
    assert_equal "active", @exchange.reload.status
  end

  test "failed redraw preserves the existing assignments" do
    service = ExchangeMatchingService.new(@exchange)
    first_draw = service.perform!
    first_participant = @participants.first
    old_recipient_id = first_draw.fetch(first_participant.id)

    (@participants.map(&:id) - [ first_participant.id, old_recipient_id ]).each do |participant_id|
      @exchange.exchange_exclusions.create!(
        participant_a_id: first_participant.id,
        participant_b_id: participant_id
      )
    end

    assert_raises(ExchangeMatchingService::ImpossibleMatchError) do
      service.perform!(redraw: true)
    end
    assert_equal first_draw, @exchange.exchange_participants.pluck(:id, :matched_participant_id).to_h
  end

  test "raises when exchange is not in inviting status" do
    @exchange.update!(status: "draft")
    service = ExchangeMatchingService.new(@exchange)

    err = assert_raises(ExchangeMatchingService::MatchingError) { service.perform! }
    assert_includes err.message, "inviting"
  end

  test "raises when fewer than 3 accepted participants" do
    @participants[2..].each(&:destroy!)
    service = ExchangeMatchingService.new(@exchange)

    err = assert_raises(ExchangeMatchingService::MatchingError) { service.perform! }
    assert_includes err.message, "3"
  end

  test "raises when exclusions make matching impossible" do
    # Exclude all pairs that include @participants[0] -> impossible
    @participants[1..].each do |p|
      @exchange.exchange_exclusions.create!(participant_a: @participants[0], participant_b: p)
    end

    service = ExchangeMatchingService.new(@exchange)
    assert_raises(ExchangeMatchingService::ImpossibleMatchError) { service.perform! }
  end
end
