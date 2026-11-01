# frozen_string_literal: true

class CompanyProfilesController < ApplicationController
  before_action :set_workspace
  before_action :require_admin
  before_action :require_business_workspace

  def show
    profile = @workspace.company_profile || @workspace.build_company_profile
    render json: CompanyProfileBlueprint.render(profile)
  end

  def update
    profile = @workspace.company_profile || @workspace.build_company_profile

    if profile.update(company_profile_params)
      render json: CompanyProfileBlueprint.render(profile)
    else
      render json: { errors: profile.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def set_workspace
    @workspace = current_user.workspaces.find(params[:workspace_id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Group not found" }, status: :not_found
  end

  def require_admin
    return if @workspace.nil? # Already handled by set_workspace
    render json: { error: "Access denied" }, status: :forbidden unless @workspace.admin?(current_user)
  end

  def require_business_workspace
    return if @workspace.nil? # Already handled by set_workspace
    unless @workspace.business?
      render json: { error: "Only business groups have company profiles" }, status: :unprocessable_entity
    end
  end

  def company_profile_params
    params.require(:company_profile).permit(:name, :website, :address, tax_metadata: {})
  end
end
