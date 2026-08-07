class GiftStatusesController < ApplicationController
  before_action :authenticate_clerk_session!, only: %i[create update destroy]
  before_action :require_global_admin!, only: %i[create update destroy]
  before_action :set_gift_status, only: %i[show update destroy]

  def index
    render json: BootstrapPayloadService.cached_gift_statuses
  end

  def show
    render json: GiftStatusBlueprint.render(@gift_status)
  end

  def create
    gift_status = GiftStatus.new(gift_status_params)

    if gift_status.save
      render json: GiftStatusBlueprint.render(gift_status), status: :created
    else
      render json: { errors: gift_status.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    if @gift_status.update(gift_status_params)
      render json: GiftStatusBlueprint.render(@gift_status)
    else
      render json: { errors: @gift_status.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    @gift_status.destroy!
    head :no_content
  end

  private

  def require_global_admin!
    return if Admin::Authorization.allowed?(current_user)

    render json: { error: "Global gift statuses are administrator-managed" }, status: :forbidden
  end

  def set_gift_status
    @gift_status = GiftStatus.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Gift status not found" }, status: :not_found
  end

  def gift_status_params
    params.require(:gift_status).permit(:name, :position)
  end
end
