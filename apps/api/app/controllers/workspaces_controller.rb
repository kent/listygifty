# frozen_string_literal: true

class WorkspacesController < ApplicationController
  before_action :set_workspace, only: [ :show, :update, :destroy ]
  before_action :require_admin, only: [ :update ]
  before_action :require_owner, only: [ :destroy ]

  def index
    workspaces = current_user.workspaces.includes(:company_profile)
    render json: WorkspaceBlueprint.render(workspaces, current_user: current_user)
  end

  def show
    render json: WorkspaceBlueprint.render(@workspace, view: :with_members, current_user: current_user)
  end

  def create
    workspace = Workspace.new(workspace_params)
    workspace.created_by_user = current_user

    # Business workspaces default to showing addresses for gifts
    if workspace.business? && !params.dig(:workspace, :show_gift_addresses).present?
      workspace.show_gift_addresses = true
    end

    Workspace.transaction do
      workspace.save!
      workspace.workspace_memberships.create!(user: current_user, role: "owner")

      if workspace.business? && (params[:company_name].present? || params[:business_use_case].present?)
        workspace.create_company_profile!(
          name: params[:company_name].presence || workspace.name,
          tax_metadata: business_tax_metadata
        )
      end
    end

    render json: WorkspaceBlueprint.render(workspace, current_user: current_user), status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  def update
    if @workspace.update(workspace_params)
      render json: WorkspaceBlueprint.render(@workspace, current_user: current_user)
    else
      render json: { errors: @workspace.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    if @workspace.personal?
      return render json: { error: "Cannot delete personal workspace" }, status: :unprocessable_entity
    end

    @workspace.destroy!
    head :no_content
  end

  private

  def set_workspace
    @workspace = current_user.workspaces.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Workspace not found" }, status: :not_found
  end

  def require_admin
    render_forbidden unless @workspace.admin?(current_user)
  end

  def require_owner
    render_forbidden unless @workspace.owner?(current_user)
  end

  def render_forbidden
    render json: { error: "Access denied" }, status: :forbidden
  end

  def workspace_params
    params.require(:workspace).permit(:name, :workspace_type, :show_gift_addresses)
  end

  def business_tax_metadata
    use_case = params[:business_use_case].presence
    return {} unless use_case

    { initial_use_case: use_case }
  end
end
