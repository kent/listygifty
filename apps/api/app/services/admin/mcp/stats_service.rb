module Admin
  module Mcp
    class StatsService
      TRACKED_SERIES = {
        users: User,
        holidays: Holiday,
        gifts: Gift,
        wishlists: Wishlist,
        gift_exchanges: GiftExchange
      }.freeze

      def call(period_days: 30)
        days = Integer(period_days || 30)
        raise ArgumentError, "period_days must be between 1 and 365" unless days.between?(1, 365)

        start_date = (days - 1).days.ago.to_date
        {
          generated_at: Time.current.iso8601,
          period: { days: days, start_date: start_date, end_date: Date.current },
          totals: totals,
          users: {
            new_in_period: User.where(created_at: start_date.beginning_of_day..).count,
            subscriptions: User.group(:subscription_plan).count
          },
          exchanges_by_status: GiftExchange.group(:status).count,
          participants_by_status: ExchangeParticipant.group(:status).count,
          wishlists_by_visibility: Wishlist.group(:visibility).count,
          email_deliveries_by_status: EmailDelivery.group(:status).count,
          daily_creations: TRACKED_SERIES.transform_values { |model| daily_counts(model, start_date, days) }
        }
      rescue ArgumentError, TypeError
        raise ArgumentError, "period_days must be between 1 and 365"
      end

      private

      def totals
        {
          users: User.count,
          workspaces: Workspace.count,
          holidays: Holiday.user_holidays.count,
          gifts: Gift.count,
          people: Person.count,
          wishlists: Wishlist.count,
          wishlist_items: WishlistItem.count,
          gift_exchanges: GiftExchange.count,
          exchange_participants: ExchangeParticipant.count
        }
      end

      def daily_counts(model, start_date, days)
        counts = model.where(created_at: start_date.beginning_of_day..)
          .group("DATE(created_at)")
          .count
          .transform_keys(&:to_s)

        Array.new(days) do |offset|
          date = start_date + offset.days
          { date: date.iso8601, count: counts.fetch(date.to_s, 0) }
        end
      end
    end
  end
end
