class ProfileController < ApplicationController
  skip_before_action :authenticate!
  before_action :authenticate_clerk_session!

  # POST /profile/sync - Force sync user data from Clerk
  # Accepts optional profile params from frontend as fallback when Clerk API unavailable
  def sync
    clerk_user = fetch_clerk_user(current_user.clerk_user_id)

    updates = {}
    if clerk_user
      # Prefer data from Clerk API when available
      updates[:first_name] = clerk_user.first_name if clerk_user.first_name.present?
      updates[:last_name] = clerk_user.last_name if clerk_user.last_name.present?
      updates[:image_url] = clerk_user.image_url if clerk_user.image_url.present?
      updates[:phone] = clerk_user_phone(clerk_user) if clerk_user_phone(clerk_user).present?
      updates[:username] = clerk_user.username if clerk_user.username.present?
    else
      # Fall back to frontend-provided data (from authenticated Clerk session)
      updates[:first_name] = params[:first_name] if params[:first_name].present?
      updates[:last_name] = params[:last_name] if params[:last_name].present?
      updates[:image_url] = params[:image_url] if params[:image_url].present?
    end

    updates[:clerk_profile_synced_at] = Time.current
    current_user.update!(updates) if updates.any?
    render json: UserBlueprint.render_as_hash(current_user)
  end
end
