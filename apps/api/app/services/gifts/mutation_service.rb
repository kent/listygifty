module Gifts
  class MutationService
    class LimitExceeded < StandardError; end

    SCALAR_ATTRIBUTES = %w[name description link cost position].freeze

    def initialize(user)
      @user = user
    end

    def create(attributes)
      attributes = normalize(attributes)
      @user.with_lock do
        raise LimitExceeded, limit_message unless @user.can_create_gift?

        holiday = find_holiday(attributes["holiday_id"])
        recipient_ids = person_ids(attributes, "recipient_ids")
        giver_ids = person_ids(attributes, "giver_ids")
        validate_people!(holiday, recipient_ids | giver_ids)

        gift = holiday.gifts.build(attributes.slice(*SCALAR_ATTRIBUTES))
        gift.gift_status = attributes["gift_status_id"].present? ?
          GiftStatus.find(attributes["gift_status_id"]) : GiftStatus.by_position.first!
        gift.created_by = @user
        gift.save!
        assign_people!(gift, recipient_ids, giver_ids)
        gift
      end
    end

    def update(gift, attributes)
      attributes = normalize(attributes)
      Gift.transaction do
        gift.lock!
        holiday_changed = attributes.key?("holiday_id")
        recipients_changed = attributes.key?("recipient_ids")
        givers_changed = attributes.key?("giver_ids")
        holiday = holiday_changed ? find_holiday(attributes["holiday_id"]) : gift.holiday
        recipient_ids = recipients_changed ? person_ids(attributes, "recipient_ids") : gift.recipient_ids
        giver_ids = givers_changed ? person_ids(attributes, "giver_ids") : gift.giver_ids
        ids_to_validate = if holiday_changed
          recipient_ids | giver_ids
        else
          (recipients_changed ? recipient_ids : []) | (givers_changed ? giver_ids : [])
        end
        validate_people!(holiday, ids_to_validate)

        gift.assign_attributes(attributes.slice(*SCALAR_ATTRIBUTES))
        gift.gift_status = GiftStatus.find(attributes["gift_status_id"]) if attributes.key?("gift_status_id")
        gift.holiday = holiday
        gift.save!
        gift.recipient_ids = recipient_ids if recipients_changed
        gift.giver_ids = giver_ids if givers_changed
        share_ids = holiday_changed ? (recipient_ids | giver_ids) : ids_to_validate
        share_people!(gift.holiday_id, share_ids)
        gift
      end
    end

    private

    def normalize(attributes)
      attributes.to_h.stringify_keys
    end

    def find_holiday(id)
      Holiday.where(id: @user.holiday_ids).find(id)
    end

    def person_ids(attributes, key)
      Array(attributes[key]).map { |id| Integer(id) }.uniq
    rescue ArgumentError, TypeError
      raise ActiveRecord::RecordNotFound
    end

    def validate_people!(holiday, ids)
      return if ids.empty?

      shared_people = Person.where(id: holiday.shared_people.select(:id))
      accessible_people = if holiday.workspace.member?(@user)
        shared_people.or(Person.where(id: holiday.workspace.people.select(:id)))
      else
        shared_people
      end
      accessible_count = accessible_people.where(id: ids).distinct.count
      raise ActiveRecord::RecordNotFound unless accessible_count == ids.length
    end

    def assign_people!(gift, recipient_ids, giver_ids)
      gift.recipient_ids = recipient_ids
      gift.giver_ids = giver_ids
      share_people!(gift.holiday_id, recipient_ids | giver_ids)
    end

    def share_people!(holiday_id, person_ids)
      return if person_ids.empty?

      now = Time.current
      HolidayPerson.insert_all(
        person_ids.map do |person_id|
          { holiday_id: holiday_id, person_id: person_id, created_at: now, updated_at: now }
        end,
        unique_by: "index_holiday_people_on_holiday_id_and_person_id"
      )
    end

    def limit_message
      "You've used all #{User::FREE_GIFT_LIMIT} free gifts. Upgrade to Premium for unlimited gift tracking."
    end
  end
end
