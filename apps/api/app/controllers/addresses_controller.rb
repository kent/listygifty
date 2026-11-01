# frozen_string_literal: true

class AddressesController < ApplicationController
  before_action :set_workspace
  before_action :require_admin
  before_action :require_business_workspace
  before_action :set_address, only: %i[show update destroy set_default]

  def index
    addresses = company_profile.addresses.default_first
    render json: AddressBlueprint.render(addresses)
  end

  def show
    render json: AddressBlueprint.render(@address)
  end

  def create
    address = company_profile.addresses.build(address_params)

    if address.save
      render json: AddressBlueprint.render(address), status: :created
    else
      render json: { errors: address.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @address.update(address_params)
      render json: AddressBlueprint.render(@address)
    else
      render json: { errors: @address.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @address.destroy!
    head :no_content
  end

  def set_default
    @address.update!(is_default: true)
    render json: AddressBlueprint.render(@address)
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
      render json: { error: "Only business groups have addresses" }, status: :unprocessable_entity
    end
  end

  def company_profile
    @company_profile ||= @workspace.company_profile || @workspace.create_company_profile!(name: @workspace.name)
  end

  def set_address
    @address = company_profile.addresses.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Address not found" }, status: :not_found
  end

  def address_params
    params.require(:address).permit(:label, :street_line_1, :street_line_2, :city, :state, :postal_code, :country, :is_default)
  end
end
