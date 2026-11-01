# frozen_string_literal: true

module WorkspaceScoped
  extend ActiveSupport::Concern

  included do
    before_action :set_current_workspace
    before_action :require_workspace_member
  end

  private

  def set_current_workspace
    workspace_id = request.headers["X-Workspace-ID"] || params[:workspace_id]

    if workspace_id.present?
      @current_workspace = current_user.workspaces.find_by(id: workspace_id)
    else
      # Default to personal workspace
      @current_workspace = current_user.personal_workspace
    end

    Current.workspace = @current_workspace
  end

  def require_workspace_member
    return render_workspace_required unless @current_workspace
    render_forbidden unless @current_workspace.member?(current_user)
  end

  def require_workspace_admin
    render_forbidden unless @current_workspace&.admin?(current_user)
  end

  def require_workspace_owner
    render_forbidden unless @current_workspace&.owner?(current_user)
  end

  def current_workspace
    @current_workspace
  end

  def render_workspace_required
    render json: { error: "Group selection required" }, status: :bad_request
  end

  def render_forbidden
    render json: { error: "Access denied" }, status: :forbidden
  end
end
