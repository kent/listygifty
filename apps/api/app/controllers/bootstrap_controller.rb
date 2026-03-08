class BootstrapController < ApplicationController
  def show
    payload = BootstrapPayloadService.new(
      user: current_user,
      workspace_id: params[:workspace_id]
    ).call

    apply_server_timing!(payload.delete(:server_timings))

    render json: payload
  end

  private

  def apply_server_timing!(timings)
    return if timings.empty?

    response.set_header(
      "Server-Timing",
      timings.map { |key, duration| "#{key};dur=#{duration}" }.join(", ")
    )
  end
end
