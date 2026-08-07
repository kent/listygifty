# frozen_string_literal: true

class ExportsController < ApplicationController
  include WorkspaceScoped

  def gifts
    holiday = current_workspace.holidays.where(id: current_user.holiday_ids).find(params[:holiday_id])

    filename = generate_gifts_filename(holiday)
    csv_data = ExportService.gifts_to_csv(holiday)

    send_data csv_data, filename: filename, type: "text/csv", disposition: "attachment"
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Holiday not found" }, status: :not_found
  end

  def people
    filename = generate_people_filename
    csv_data = ExportService.people_to_csv(current_workspace)

    send_data csv_data, filename: filename, type: "text/csv", disposition: "attachment"
  end

  private

  def generate_gifts_filename(holiday)
    company_name = sanitize_filename(current_workspace.company_profile&.name || current_workspace.name)
    holiday_name = sanitize_filename(holiday.name)
    date = Date.today.iso8601
    "#{company_name}_#{holiday_name}_gifts_#{date}.csv"
  end

  def generate_people_filename
    company_name = sanitize_filename(current_workspace.company_profile&.name || current_workspace.name)
    date = Date.today.iso8601
    "#{company_name}_people_#{date}.csv"
  end

  def sanitize_filename(name)
    name.to_s.gsub(/[^a-zA-Z0-9_-]/, "_").truncate(30, omission: "")
  end
end
