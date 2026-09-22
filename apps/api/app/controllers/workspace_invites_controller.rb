# frozen_string_literal: true

class WorkspaceInvitesController < ApplicationController
  skip_before_action :authenticate!
  before_action :authenticate!, only: [ :index, :create, :regenerate, :destroy, :accept ]
  before_action :set_workspace, only: [ :index, :create, :regenerate, :destroy ]
  before_action :require_admin, only: [ :index, :create, :regenerate, :destroy ]
  before_action :set_invite_by_token, only: [ :show, :accept ]
  before_action :set_invite_by_id, only: [ :destroy ]

  # GET /workspaces/:workspace_id/invites
  def index
    invites = @workspace.workspace_invites.valid
    render json: WorkspaceInviteBlueprint.render(invites)
  end

  # POST /workspaces/:workspace_id/invites
  def create
    invite = @workspace.workspace_invites.build(invite_params)
    invite.invited_by = current_user

    if invite.save
      render json: {
        invite_token: invite.token,
        invite_url: invite.invite_url,
        expires_at: invite.expires_at
      }, status: :created
    else
      render json: { errors: invite.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /workspaces/:workspace_id/invites/regenerate
  def regenerate
    invite = @workspace.with_lock do
      @workspace.workspace_invites.valid.update_all(expires_at: Time.current)
      @workspace.workspace_invites.create!(
        invited_by: current_user,
        role: params[:role] || "member"
      )
    end

    render json: {
      invite_token: invite.token,
      invite_url: invite.invite_url,
      expires_at: invite.expires_at
    }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  # GET /workspace_invite/:token (public - shows invite details)
  def show
    return render json: { error: "Invalid or expired invite" }, status: :not_found unless @invite&.valid_invite?

    render json: {
      workspace: {
        id: @invite.workspace.id,
        name: @invite.workspace.name,
        workspace_type: @invite.workspace.workspace_type
      },
      role: @invite.role,
      expires_at: @invite.expires_at
    }
  end

  # POST /workspace_invite/:token/accept
  def accept
    return render json: { error: "Invalid or expired invite" }, status: :not_found unless @invite&.valid_invite?

    if @invite.workspace.member?(current_user)
      return render json: { error: "You are already a member of this workspace" }, status: :unprocessable_entity
    end

    if @invite.accept!(current_user)
      render json: WorkspaceBlueprint.render(@invite.workspace, current_user: current_user), status: :created
    else
      render json: { error: "Failed to accept invite" }, status: :unprocessable_entity
    end
  end

  # DELETE /workspaces/:workspace_id/invites/:id
  def destroy
    @invite.destroy!
    head :no_content
  end

  private

  def set_workspace
    @workspace = current_user.workspaces.find(params[:workspace_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Workspace not found" }, status: :not_found
  end

  def require_admin
    render json: { error: "Access denied" }, status: :forbidden unless @workspace.admin?(current_user)
  end

  def set_invite_by_token
    @invite = WorkspaceInvite.includes(:workspace).find_by(token: params[:token])
  end

  def set_invite_by_id
    @invite = @workspace.workspace_invites.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Invite not found" }, status: :not_found
  end

  def invite_params
    params.fetch(:workspace_invite, {}).permit(:role, :email)
  end
end
