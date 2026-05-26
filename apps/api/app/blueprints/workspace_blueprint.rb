class WorkspaceBlueprint < ApplicationBlueprint
  fields :name, :workspace_type, :show_gift_addresses, :created_at, :updated_at

  field :is_owner do |workspace, options|
    current_user = options[:current_user]
    current_user ? workspace.owner?(current_user) : false
  end

  field :is_admin do |workspace, options|
    current_user = options[:current_user]
    current_user ? workspace.admin?(current_user) : false
  end

  field :role do |workspace, options|
    current_user = options[:current_user]
    workspace.role_for(current_user) if current_user
  end

  field :member_count do |workspace|
    workspace.workspace_memberships.count
  end

  field :has_company_profile do |workspace|
    workspace.business? && workspace.company_profile.present?
  end

  field :business_initial_use_case do |workspace|
    next unless workspace.business?

    workspace.company_profile&.tax_metadata&.dig("initial_use_case")
  end

  view :with_members do
    association :workspace_memberships, blueprint: WorkspaceMembershipBlueprint, name: :members
  end

  view :with_company do
    association :company_profile, blueprint: CompanyProfileBlueprint
  end
end
