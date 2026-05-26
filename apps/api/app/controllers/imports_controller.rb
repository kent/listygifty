# frozen_string_literal: true

class ImportsController < ApplicationController
  include WorkspaceScoped

  def people
    unless params[:file].present?
      return render json: { error: "No file provided" }, status: :bad_request
    end

    owner = nil
    if params[:owner_id].present?
      owner = current_workspace.users.find_by(id: params[:owner_id])
      return render json: { error: "Owner not found in workspace" }, status: :bad_request unless owner
    end

    result = CsvImportService.import_people(
      file: params[:file],
      workspace: current_workspace,
      created_by: owner || current_user
    )

    render json: {
      created: result[:created],
      skipped: result[:skipped],
      addresses_created: result[:addresses_created],
      addresses_skipped: result[:addresses_skipped],
      errors: result[:errors],
      people: PersonBlueprint.render_as_hash(result[:people], current_user: current_user, current_workspace: current_workspace)
    }
  end

  def gifts
    unless params[:file].present?
      return render json: { error: "No file provided" }, status: :bad_request
    end

    holiday = current_workspace.holidays.find_by(id: params[:holiday_id])
    return render json: { error: "Holiday not found" }, status: :not_found unless holiday

    result = CsvGiftImportService.import_gifts(
      file: params[:file],
      workspace: current_workspace,
      holiday: holiday,
      created_by: current_user
    )

    render json: {
      created: result[:created],
      people_created: result[:people_created],
      errors: result[:errors],
      gifts: GiftBlueprint.render_as_hash(result[:gifts], current_user: current_user)
    }
  end
end
