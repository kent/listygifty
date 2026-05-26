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
end
