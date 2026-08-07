require "test_helper"

class GiftStatusesApiTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @auth_headers = auth_headers_for(@user)
    @status = gift_statuses(:idea)
  end

  test "index returns gift statuses" do
    get gift_statuses_path, headers: @auth_headers, as: :json
    assert_response :success
    assert_kind_of Array, json_response
    assert json_response.any? { |s| s["id"] == @status.id }
  end

  test "index reflects status updates after the cached payload is populated" do
    get gift_statuses_path, headers: @auth_headers, as: :json
    assert_response :success

    updated_name = "Updated Idea #{SecureRandom.hex(4)}"
    @status.update!(name: updated_name)

    get gift_statuses_path, headers: @auth_headers, as: :json
    assert_response :success
    assert json_response.any? { |status| status["id"] == @status.id && status["name"] == updated_name }
  end

  test "show returns a gift status" do
    get gift_status_path(@status), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal @status.name, json_response["name"]
  end

  test "ordinary users cannot mutate global gift statuses" do
    assert_no_difference("GiftStatus.count") do
      post gift_statuses_path,
        headers: @auth_headers,
        params: { gift_status: { name: "Tenant status", position: 99 } },
        as: :json
    end
    assert_response :forbidden

    patch gift_status_path(@status),
      headers: @auth_headers,
      params: { gift_status: { name: "Tenant rename" } },
      as: :json
    assert_response :forbidden
    assert_not_equal "Tenant rename", @status.reload.name

    assert_no_difference("GiftStatus.count") do
      delete gift_status_path(@status), headers: @auth_headers, as: :json
    end
    assert_response :forbidden
  end

  test "allowlisted Clerk admins can mutate statuses but API keys cannot" do
    previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = @user.email

    assert_difference("GiftStatus.count", 1) do
      post gift_statuses_path,
        headers: @auth_headers,
        params: { gift_status: { name: "Admin status #{SecureRandom.hex(4)}", position: 99 } },
        as: :json
    end
    assert_response :created

    api_key = ApiKey.generate_for(@user, name: "Non-admin REST mutation", scopes: [ "write" ])
    assert_no_difference("GiftStatus.count") do
      post gift_statuses_path,
        headers: { "Authorization" => "Bearer #{api_key.raw_key}" },
        params: { gift_status: { name: "API-key status", position: 100 } },
        as: :json
    end
    assert_response :unauthorized
  ensure
    previous.nil? ? ENV.delete("ADMIN_EMAILS") : ENV["ADMIN_EMAILS"] = previous
  end

  test "requires authentication" do
    get gift_statuses_path, as: :json
    assert_response :unauthorized
  end
end
