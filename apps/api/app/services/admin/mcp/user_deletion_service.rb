module Admin
  module Mcp
    class UserDeletionService
      def initialize(actor:, api_key:, request_id: nil)
        @actor = actor
        @api_key = api_key
        @request_id = request_id
      end

      def preview(user_id:)
        target = User.find(user_id)
        protect!(target)
        impact = impact_for(target)
        confirmation = nil
        token = nil

        AdminActionConfirmation.transaction do
          confirmation, token = AdminActionConfirmation.create_with_token!(
            actor: @actor,
            api_key: @api_key,
            action: "delete_user",
            target: target,
            target_label: target.email,
            payload: { "impact" => impact }
          )
          AdminAuditEvent.record!(
            actor: @actor,
            action: "user_deletion.preview",
            resource: target,
            metadata: audit_metadata(target_email: target.email, impact: impact)
          )
        end

        {
          confirmation_id: confirmation.id,
          target: { id: target.id, email: target.email, name: target.safe_name },
          impact: impact,
          expires_at: confirmation.expires_at.iso8601,
          confirmation_token: token
        }
      end

      def confirm(token:)
        confirmation = AdminActionConfirmation.find_by_token(token)
        raise ArgumentError, "Invalid user deletion confirmation token" unless confirmation

        deleted = nil
        confirmation.with_lock do
          validate_confirmation!(confirmation)
          target = User.find(confirmation.target_id)
          protect!(target)
          if impact_for(target).deep_stringify_keys != confirmation.payload.fetch("impact")
            raise ArgumentError, "The user's data changed after preview; preview the deletion again"
          end
          deleted = { id: target.id, email: target.email }

          User.transaction do
            delete_user_dependencies!(target)
            target.destroy!
            confirmation.update!(consumed_at: Time.current)
            AdminAuditEvent.record!(
              actor: @actor,
              action: "user_deletion.confirm",
              resource_type: "User",
              resource_id: deleted[:id],
              metadata: audit_metadata(
                target_email: deleted[:email],
                impact: confirmation.payload["impact"]
              )
            )
          end
        end

        { deleted: true, user: deleted }
      end

      private

      def validate_confirmation!(confirmation)
        raise ArgumentError, "This user deletion confirmation belongs to another administrator" unless confirmation.actor_id == @actor.id
        raise ArgumentError, "This user deletion confirmation belongs to another API key" unless confirmation.api_key_id == @api_key.id
        raise ArgumentError, "Invalid user deletion action" unless confirmation.action == "delete_user" && confirmation.target_type == "User"
        raise ArgumentError, "This user deletion confirmation has expired" if confirmation.expired?
        raise ArgumentError, "This user deletion confirmation has already been used" if confirmation.consumed?
      end

      def protect!(target)
        if target == @actor || Admin::Authorization.allowed?(target)
          raise ArgumentError, "The active or allowlisted administrator cannot be deleted"
        end
      end

      def impact_for(target)
        created_workspace_ids = Workspace.where(created_by_user_id: target.id).pluck(:id)
        {
          workspaces_created: created_workspace_ids.length,
          workspace_memberships: WorkspaceMembership.where(user_id: target.id).count,
          holidays_in_created_workspaces: Holiday.where(workspace_id: created_workspace_ids).count,
          gifts_in_created_workspaces: Gift.joins(:holiday).where(holidays: { workspace_id: created_workspace_ids }).count,
          people_owned: Person.where(user_id: target.id).count,
          holiday_collaborations: HolidayUser.where(user_id: target.id).count,
          wishlists_owned: Wishlist.where(user_id: target.id).count,
          gift_exchanges_owned: GiftExchange.where(user_id: target.id).count,
          exchange_participations: ExchangeParticipant.where(user_id: target.id).count,
          wishlist_claims: WishlistItemClaim.where(user_id: target.id).count,
          gift_changes: GiftChange.where(user_id: target.id).count,
          email_deliveries: EmailDelivery.where(user_id: target.id).count,
          pending_admin_email_drafts: AdminEmailDraft.where(recipient_id: target.id, queued_at: nil).count,
          analytics_visitors: AnalyticsVisitor.where(user_id: target.id).count,
          analytics_events: analytics_events_for(target).count,
          api_keys: ApiKey.where(user_id: target.id).count,
          oauth_tokens: OauthAccessToken.where(user_id: target.id).count
        }
      end

      def delete_user_dependencies!(target)
        analytics_events_for(target).delete_all
        AnalyticsVisitor.where(user_id: target.id).delete_all
        Workspace.where(created_by_user_id: target.id).destroy_all
        WorkspaceInvite.where(invited_by_id: target.id).destroy_all
        WorkspaceInvite.where(accepted_by_id: target.id).update_all(accepted_by_id: nil, updated_at: Time.current)
        GiftChange.where(user_id: target.id).destroy_all
        Gift.where(created_by_user_id: target.id).update_all(created_by_user_id: nil, updated_at: Time.current)
        OauthAuthorizationCode.where(user_id: target.id).destroy_all
        OauthClient.where(user_id: target.id).update_all(user_id: nil, updated_at: Time.current)
      end

      def analytics_events_for(target)
        visitor_ids = AnalyticsVisitor.where(user_id: target.id).select(:id)
        AnalyticsEvent.where(user_id: target.id).or(AnalyticsEvent.where(analytics_visitor_id: visitor_ids))
      end

      def audit_metadata(metadata)
        metadata.merge(api_key_id: @api_key.id, request_id: @request_id).compact
      end
    end
  end
end
