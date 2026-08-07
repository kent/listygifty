class User < ApplicationRecord
  FREE_GIFT_LIMIT = 10
  SUBSCRIPTION_PLANS = %w[free premium].freeze

  has_secure_token :email_preferences_token

  has_many :people, dependent: :destroy
  has_many :holiday_users, dependent: :destroy
  has_many :holidays, through: :holiday_users
  has_many :gift_changes, dependent: :nullify
  has_one :notification_preference, dependent: :destroy
  has_many :email_deliveries, dependent: :destroy
  has_many :owned_gift_exchanges, class_name: "GiftExchange", dependent: :destroy
  has_many :exchange_participants, dependent: :destroy
  has_many :gift_exchanges, through: :exchange_participants
  has_many :wishlists, dependent: :destroy
  has_many :wishlist_item_claims, dependent: :nullify
  has_many :api_keys, dependent: :destroy
  has_many :oauth_access_tokens, dependent: :destroy
  has_many :oauth_refresh_grants, dependent: :destroy
  has_many :oauth_authorization_requests, dependent: :destroy
  has_many :oauth_authorization_codes, dependent: :destroy
  has_many :oauth_clients, dependent: :nullify
  has_many :admin_audit_events, foreign_key: :actor_id, dependent: :restrict_with_error
  has_many :admin_email_drafts_created, class_name: "AdminEmailDraft", foreign_key: :created_by_id, dependent: :restrict_with_error
  has_many :admin_email_drafts_received, class_name: "AdminEmailDraft", foreign_key: :recipient_id, dependent: :destroy
  has_many :admin_action_confirmations, foreign_key: :actor_id, dependent: :restrict_with_error
  has_many :analytics_visitors, dependent: :nullify
  has_many :analytics_events, dependent: :nullify
  has_many :analytics_metric_goals_created, class_name: "AnalyticsMetricGoal", foreign_key: :created_by_id, dependent: :nullify

  # Workspace associations
  has_many :workspace_memberships, dependent: :destroy
  has_many :workspaces, through: :workspace_memberships
  has_many :created_workspaces, class_name: "Workspace", foreign_key: :created_by_user_id, dependent: :nullify
  has_many :workspace_invites_sent, class_name: "WorkspaceInvite", foreign_key: :invited_by_id, dependent: :nullify

  validates :subscription_plan, inclusion: { in: SUBSCRIPTION_PLANS }
  validates :clerk_user_id, presence: true, uniqueness: true
  validates :email, presence: true, uniqueness: true

  before_save :normalize_email

  private

  def normalize_email
    self.email = email.strip.downcase if email.present?
  end

  public

  # Free-plan quota is charged to the creator, not every collaborator who can
  # see a shared holiday. Locking this user then serializes their own quota.
  def gift_count
    Gift.where(created_by_user_id: id).count
  end

  def gifts_remaining
    return nil if premium? # Unlimited
    [ FREE_GIFT_LIMIT - gift_count, 0 ].max
  end

  # Subscription status
  def premium?
    subscription_plan == "premium" && subscription_active?
  end

  def subscription_active?
    return true if subscription_plan == "free"
    subscription_expires_at.present? && subscription_expires_at > Time.current
  end

  def can_create_gift?
    premium? || gift_count < FREE_GIFT_LIMIT
  end

  # Subscription management
  def activate_premium!(expires_at:)
    update!(subscription_plan: "premium", subscription_expires_at: expires_at)
  end

  def reset_billing!
    update!(subscription_plan: "free", subscription_expires_at: nil, stripe_customer_id: nil)
  end

  def subscription_status
    if premium?
      :active
    elsif subscription_plan == "premium" && !subscription_active?
      :expired
    else
      :free
    end
  end

  # Display name: first_name if present, otherwise email
  def safe_name
    first_name.presence || email
  end

  # Workspace helpers
  def personal_workspace
    workspaces.personal.first
  end

  def business_workspaces
    workspaces.business
  end

  # Returns (and creates if missing) notification preferences
  def notification_prefs
    notification_preference || create_notification_preference!
  end
end
