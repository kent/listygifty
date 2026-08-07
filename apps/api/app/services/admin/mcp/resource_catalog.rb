module Admin
  module Mcp
    class ResourceCatalog
      Entry = Data.define(:name, :model)

      RESOURCE_MODELS = {
        "users" => User,
        "workspaces" => Workspace,
        "workspace_memberships" => WorkspaceMembership,
        "company_profiles" => CompanyProfile,
        "addresses" => Address,
        "workspace_invites" => WorkspaceInvite,
        "holidays" => Holiday,
        "holiday_users" => HolidayUser,
        "holiday_people" => HolidayPerson,
        "people" => Person,
        "gift_suggestions" => GiftSuggestion,
        "gift_statuses" => GiftStatus,
        "gifts" => Gift,
        "gift_changes" => GiftChange,
        "gift_recipients" => GiftRecipient,
        "gift_givers" => GiftGiver,
        "wishlists" => Wishlist,
        "wishlist_items" => WishlistItem,
        "wishlist_item_claims" => WishlistItemClaim,
        "gift_exchanges" => GiftExchange,
        "exchange_participants" => ExchangeParticipant,
        "exchange_exclusions" => ExchangeExclusion,
        "exchange_wishlist_items" => ExchangeWishlistItem,
        "exchange_notifications" => ExchangeNotification,
        "match_arrangements" => MatchArrangement,
        "match_slots" => MatchSlot,
        "notification_preferences" => NotificationPreference,
        "email_deliveries" => EmailDelivery
      }.freeze

      IMMUTABLE_ATTRIBUTES = %w[id created_at updated_at].freeze
      MAX_LIST_RESPONSE_BYTES = 256 * 1024
      MAX_BULK_RECORD_BYTES = 64 * 1024
      MAX_BULK_STRING_BYTES = 4_000
      SECRET_ATTRIBUTE_PATTERN = /(token|secret|password|key_hash|digest|jti)/i
      SENSITIVE_ATTRIBUTES = {
        "exchange_participants" => %w[matched_participant_id],
        "wishlist_item_claims" => %w[user_id claimer_email claimer_name message]
      }.freeze

      def resource_types
        RESOURCE_MODELS.map do |name, model|
          {
            name: name,
            model: model.name,
            mutable_attributes: mutable_attributes(name),
            filter_attributes: filter_attributes(name),
            sensitive_fields_redacted: sensitive_attributes(name)
          }
        end
      end

      def list(name, filters: {}, limit: 50, after_id: nil)
        entry = fetch(name)
        filters = normalize_filters(entry, filters)
        limit = normalize_limit(limit)
        relation = entry.model.where(filters).order(id: :asc)
        relation = relation.where("id > ?", normalize_cursor(after_id)) if after_id.present?
        candidates = relation.limit(limit + 1).to_a
        has_more = candidates.length > limit
        candidates = candidates.first(limit)
        serialized_records = []
        response_bytes = 0
        last_id = nil

        candidates.each do |record|
          serialized = bounded_bulk_record(entry.name, record)
          record_bytes = JSON.generate(serialized).bytesize
          if serialized_records.any? && response_bytes + record_bytes > MAX_LIST_RESPONSE_BYTES
            has_more = true
            break
          end

          serialized_records << serialized
          response_bytes += record_bytes
          last_id = record.id
        end

        {
          resource: entry.name,
          records: serialized_records,
          count: serialized_records.length,
          next_after_id: has_more ? last_id : nil
        }
      end

      def find(name, id)
        entry = fetch(name)
        record = entry.model.find(id)
        [ record, serialize(entry.name, record) ]
      end

      def create(name, attributes)
        entry = fetch(name)
        safe_attributes = permitted_attributes(entry, attributes)

        if entry.name == "users"
          create_user!(safe_attributes)
        else
          entry.model.create!(safe_attributes)
        end
      end

      def update(name, id, attributes, actor:)
        entry = fetch(name)
        record = entry.model.find(id)
        safe_attributes = permitted_attributes(entry, attributes)
        protect_admin_identity!(entry, record, safe_attributes, actor)
        record.update!(safe_attributes)
        record
      end

      def destroy(name, id)
        entry = fetch(name)
        raise ArgumentError, "Users require admin_preview_user_deletion and admin_confirm_user_deletion" if entry.name == "users"

        record = entry.model.find(id)
        record.destroy!
        record
      end

      def serialize(name, record, bulk: false)
        attributes = record.attributes.deep_dup
        redacted = []

        attributes.keys.each do |attribute|
          if secret_attribute?(attribute) || sensitive_attributes(name).include?(attribute) || (bulk && email_attribute?(attribute))
            attributes.delete(attribute)
            redacted << attribute
          end
        end

        attributes["_redacted_fields"] = redacted.sort if redacted.any?
        attributes
      end

      def mutable_attributes(name)
        entry = fetch(name)
        entry.model.column_names.reject do |attribute|
          IMMUTABLE_ATTRIBUTES.include?(attribute) || secret_attribute?(attribute)
        end.sort
      end

      def filter_attributes(name)
        entry = fetch(name)
        entry.model.column_names.reject do |attribute|
          secret_attribute?(attribute) || sensitive_attributes(name).include?(attribute)
        end.sort
      end

      def sensitive_attributes(name)
        SENSITIVE_ATTRIBUTES.fetch(name.to_s, [])
      end

      private

      def bounded_bulk_record(name, record)
        serialized = deep_truncate_bulk(serialize(name, record, bulk: true))
        return serialized if JSON.generate(serialized).bytesize <= MAX_BULK_RECORD_BYTES

        {
          "id" => record.id,
          "_truncated" => true,
          "_truncated_fields" => serialized.keys.reject { |key| key == "id" }.sort
        }
      end

      def deep_truncate_bulk(value, depth = 0)
        return "[truncated]" if depth > 8

        case value
        when String
          value.bytesize > MAX_BULK_STRING_BYTES ? value.byteslice(0, MAX_BULK_STRING_BYTES).scrub + "…" : value
        when Hash
          value.first(100).to_h.transform_values { |child| deep_truncate_bulk(child, depth + 1) }
        when Array
          value.first(100).map { |child| deep_truncate_bulk(child, depth + 1) }
        else
          value
        end
      end

      def fetch(name)
        normalized = name.to_s
        model = RESOURCE_MODELS[normalized]
        raise ArgumentError, "Unsupported resource: #{normalized}" unless model

        Entry.new(name: normalized, model: model)
      end

      def normalize_filters(entry, filters)
        raise ArgumentError, "filters must be an object" unless filters.is_a?(Hash)

        filters.stringify_keys.tap do |normalized|
          unknown = normalized.keys - filter_attributes(entry.name)
          raise ArgumentError, "Unsupported filters: #{unknown.join(', ')}" if unknown.any?
        end
      end

      def normalize_limit(limit)
        value = begin
          Integer(limit || 50)
        rescue ArgumentError, TypeError
          raise ArgumentError, "limit must be an integer"
        end
        raise ArgumentError, "limit must be positive" if value < 1

        [ value, 100 ].min
      end

      def normalize_cursor(after_id)
        Integer(after_id)
      rescue ArgumentError, TypeError
        raise ArgumentError, "after_id must be an integer"
      end

      def permitted_attributes(entry, attributes)
        raise ArgumentError, "attributes must be an object" unless attributes.is_a?(Hash)

        normalized = attributes.stringify_keys
        unknown = normalized.keys - mutable_attributes(entry.name)
        raise ArgumentError, "Unsupported attributes: #{unknown.join(', ')}" if unknown.any?
        raise ArgumentError, "At least one attribute is required" if normalized.empty?

        normalized
      end

      def create_user!(attributes)
        User.transaction do
          user = User.create!(attributes)
          workspace = Workspace.create!(
            name: "#{user.safe_name}'s Workspace",
            workspace_type: "personal",
            created_by_user: user
          )
          workspace.workspace_memberships.create!(user: user, role: "owner")
          user
        end
      end

      def protect_admin_identity!(entry, record, attributes, actor)
        return unless entry.name == "users" && record == actor
        return unless attributes.key?("email") || attributes.key?("clerk_user_id")

        raise ArgumentError, "The active administrator cannot change their email or Clerk identity through MCP"
      end

      def secret_attribute?(attribute)
        attribute.match?(SECRET_ATTRIBUTE_PATTERN)
      end

      def email_attribute?(attribute)
        attribute == "email" || attribute.end_with?("_email")
      end
    end
  end
end
