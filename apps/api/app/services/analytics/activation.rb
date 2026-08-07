module Analytics
  class Activation
    def self.user_ids(user_ids)
      ids = Array(user_ids).map(&:to_i).uniq
      return [] if ids.empty?

      household_ids = WorkspaceMembership
        .where(user_id: ids)
        .joins(workspace: [ :people, { holidays: :gifts } ])
        .where(holidays: { is_template: false })
        .group(:user_id)
        .having("COUNT(DISTINCT holidays.id) >= 1")
        .having("COUNT(DISTINCT people.id) >= 3")
        .having("COUNT(DISTINCT gifts.id) >= 5")
        .pluck(:user_id)

      exchange_ids = GiftExchange.where(user_id: ids, status: %w[active completed]).distinct.pluck(:user_id)
      (household_ids + exchange_ids).uniq
    end

    def self.count(user_ids)
      self.user_ids(user_ids).length
    end
  end
end
