# frozen_string_literal: true

class WorkspaceMembershipsController < ApplicationController
  before_action :set_workspace
  before_action :require_admin
  before_action :set_membership, only: [ :update, :destroy ]

  def index
    memberships = @workspace.workspace_memberships.includes(:user)
    render json: WorkspaceMembershipBlueprint.render(memberships)
  end

  def update
    with_authorized_membership do
      if @membership.update(membership_params)
        render json: WorkspaceMembershipBlueprint.render(@membership)
      else
        render json: { errors: @membership.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end

  def destroy
    with_authorized_membership do
      if @membership.destroy
        head :no_content
      else
        render json: { errors: @membership.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end

  private

  def with_authorized_membership
    @workspace.with_lock do
      @membership.reload
      WorkspaceMembership.uncached do
        require_admin
        require_owner_for_ownership_change unless performed?
        yield unless performed?
      end
    end
  end

  def set_workspace
    @workspace = current_user.workspaces.find(params[:workspace_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Workspace not found" }, status: :not_found
  end

  def require_admin
    return if @workspace.nil? # Already handled by set_workspace
    render json: { error: "Access denied" }, status: :forbidden unless @workspace.admin?(current_user)
  end

  def set_membership
    @membership = @workspace.workspace_memberships.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Membership not found" }, status: :not_found
  end

  def membership_params
    params.require(:workspace_membership).permit(:role)
  end

  def require_owner_for_ownership_change
    changing_ownership = @membership.owner? || (action_name == "update" && membership_params[:role] == "owner")
    return unless changing_ownership
    return if @workspace.owner?(current_user)

    render json: { error: "Only workspace owners can manage ownership" }, status: :forbidden
  end
end
