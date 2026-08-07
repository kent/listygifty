class ActiveStorageAccessController < ActionController::API
  def not_found
    response.headers["Cache-Control"] = "no-store"
    render json: { error: "Not found" }, status: :not_found
  end
end
