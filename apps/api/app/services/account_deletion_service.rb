# Deletes a person's account at their own request. Apple guideline 5.1.1(v)
# requires this inside the app.
#
# The dependent: options on User can't do this alone. Several can't run against
# the schema, and others would reach into things other people rely on. So what
# other people rely on is settled first, and what remains is theirs to destroy.
#
# It is one transaction with Clerk last, so a Clerk failure leaves a working
# account rather than half of one.
class AccountDeletionService
  class Refused < StandardError; end
  class ClerkFailed < StandardError; end

  # The SDK retries for up to an hour by default, and this transaction would
  # hold its row locks the whole time. A failure is safe for the person to retry.
  CLERK_RETRIES = Clerk::Utils::RetryConfig.new(strategy: "none")
  CLERK_TIMEOUT_MS = 10_000

  def self.delete!(user)
    new(user).delete!
  end

  def self.clerk_user_missing?(error)
    case error
    when Clerk::Models::Errors::ClerkErrors then error.raw_response&.status == 404
    when Clerk::Models::Errors::APIError then error.status_code == 404
    else false
    end
  end

  def initialize(user)
    @user = user
  end

  def delete!
    User.transaction do
      @user.lock!
      refuse_administrators!

      cancel_owned_exchanges
      leave_other_exchanges
      settle_workspaces
      settle_lists
      hand_over_contacts
      forget_claims
      forget_workspace_invites
      forget_activity

      @user.reload.destroy!
      delete_clerk_user
    end
  end

  private

  # Their audit trail has to outlive them, and the foreign keys insist on it.
  def refuse_administrators!
    return unless Admin::Authorization.allowed?(@user) ||
      @user.admin_audit_events.exists? ||
      @user.admin_action_confirmations.exists? ||
      @user.admin_email_drafts_created.exists?

    raise Refused, "Admin accounts can't be deleted in the app because their audit history has to be kept."
  end

  def cancel_owned_exchanges
    @user.owned_gift_exchanges.find_each { |exchange| ExchangeDeletionService.delete!(exchange) }
  end

  def leave_other_exchanges
    ExchangeParticipant.where(user_id: @user.id).find_each do |participant|
      participant.gift_exchange.with_lock do
        participant.reload
        participant.in_draw? ? participant.anonymize! : participant.destroy!
      end
    end
  end

  # Decided per workspace under its lock, so two members deleting their accounts
  # at once can't each hand it to the other.
  def settle_workspaces
    Workspace.where(created_by_user_id: @user.id)
             .or(Workspace.where(id: @user.workspace_memberships.select(:workspace_id)))
             .find_each do |workspace|
      workspace.with_lock do
        others = workspace.workspace_memberships.where.not(user_id: @user.id)
        others.exists? ? hand_over_workspace(workspace, others) : remove_workspace(workspace)
      end
    end
  end

  def hand_over_workspace(workspace, others)
    heir = others.in_order_of(:role, WorkspaceMembership::ROLES).order(:created_at, :id).first
    heir.update!(role: "owner")
    workspace.workspace_memberships.find_by(user_id: @user.id)&.destroy!
    return unless workspace.created_by_user_id == @user.id

    attributes = { created_by_user_id: heir.user_id }
    # A personal workspace is named after its creator, and people only get one.
    if workspace.personal?
      attributes[:name] = "#{heir.user.safe_name}'s Workspace".truncate(200)
      attributes[:workspace_type] = "business"
    end
    workspace.update!(attributes)
  end

  def remove_workspace(workspace)
    # The workspace cascade would delete these without telling anyone.
    workspace.gift_exchanges.find_each { |exchange| ExchangeDeletionService.delete!(exchange) }
    AnalyticsEvent.where(workspace_id: workspace.id).update_all(workspace_id: nil)
    workspace.destroy!
  end

  # Runs after settle_workspaces, so these are all in surviving workspaces. A
  # list nobody else can see goes. A shared one passes to a collaborator.
  def settle_lists
    @user.holiday_users.where(role: "owner").includes(:holiday).find_each do |ownership|
      heir = ownership.holiday.holiday_users.where.not(user_id: @user.id).order(:created_at, :id).first
      heir ? heir.update!(role: "owner") : ownership.holiday.destroy!
    end
  end

  # Contacts in a shared workspace belong to the workspace, and other members'
  # gifts point at them. The dependent: :destroy on User would wipe those gifts'
  # recipients, so these move to the workspace's owner first.
  def hand_over_contacts
    Workspace.where(id: Person.where(user_id: @user.id).select(:workspace_id)).find_each do |workspace|
      heir = workspace.owner || workspace.created_by_user
      workspace.people.where(user_id: @user.id).update_all(user_id: heir.id)
    end
  end

  # The claim stays so the item stays spoken for and nobody buys it twice, but it
  # must not identify them. Without a token, nobody can pick it up as a guest.
  def forget_claims
    WishlistItemClaim.where(user_id: @user.id)
                     .or(WishlistItemClaim.where(claimer_email: @user.email))
                     .update_all(user_id: nil, claimer_name: nil, claimer_email: nil, message: nil,
                       claim_token: nil, updated_at: Time.current)
  end

  def forget_workspace_invites
    WorkspaceInvite.where(invited_by_id: @user.id).destroy_all
    WorkspaceInvite.where(accepted_by_id: @user.id).update_all(accepted_by_id: nil, email: nil, updated_at: Time.current)
  end

  def forget_activity
    GiftChange.where(user_id: @user.id).delete_all
    Gift.where(created_by_user_id: @user.id).update_all(created_by_user_id: nil)

    visitors = AnalyticsVisitor.where(user_id: @user.id)
    AnalyticsEvent.where(user_id: @user.id).or(AnalyticsEvent.where(analytics_visitor_id: visitors.select(:id))).delete_all
    visitors.delete_all
  end

  def delete_clerk_user
    Clerk::SDK.new.users.delete(user_id: @user.clerk_user_id, retries: CLERK_RETRIES, timeout_ms: CLERK_TIMEOUT_MS)
  rescue StandardError => e
    return if self.class.clerk_user_missing?(e)

    Rails.logger.error "Clerk user deletion failed: #{e.class}"
    raise ClerkFailed, "Clerk did not delete the user"
  end
end
