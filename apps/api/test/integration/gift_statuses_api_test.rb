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
    patch gift_status_path(@status),
      headers: @auth_headers,
      params: { gift_status: { name: updated_name } },
      as: :json
    assert_response :success

    get gift_statuses_path, headers: @auth_headers, as: :json
    assert_response :success
    assert json_response.any? { |status| status["id"] == @status.id && status["name"] == updated_name }
  end

  test "show returns a gift status" do
    get gift_status_path(@status), headers: @auth_headers, as: :json
    assert_response :success
    assert_equal @status.name, json_response["name"]
  end

  test "create creates a gift status" do
    assert_difference("GiftStatus.count") do
      post gift_statuses_path,
        headers: @auth_headers,
        params: { gift_status: { name: "Shipped #{SecureRandom.hex(4)}", position: 99 } },
        as: :json
    end
    assert_response :created
  end

  test "update modifies a gift status" do
    # Create a new status to update to avoid uniqueness conflicts
    new_status = GiftStatus.create!(name: "Test Status #{SecureRandom.hex(4)}", position: 98)

    patch gift_status_path(new_status),
      headers: @auth_headers,
      params: { gift_status: { name: "Updated Status #{SecureRandom.hex(4)}" } },
      as: :json
    assert_response :success
  end

  test "destroy removes a gift status" do
    # Create a new status to delete (not used by any gifts)
    new_status = GiftStatus.create!(name: "To Delete #{SecureRandom.hex(4)}", position: 97)

    assert_difference("GiftStatus.count", -1) do
      delete gift_status_path(new_status), headers: @auth_headers, as: :json
    end
    assert_response :success
  end

  test "requires authentication" do
    get gift_statuses_path, as: :json
    assert_response :unauthorized
  end
end
