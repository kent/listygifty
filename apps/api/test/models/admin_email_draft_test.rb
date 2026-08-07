require "test_helper"

class AdminEmailDraftTest < ActiveSupport::TestCase
  test "stores only a digest of the one-time confirmation token" do
    api_key = ApiKey.generate_for(users(:one), name: "Draft test").api_key
    draft, token = AdminEmailDraft.create_with_confirmation!(
      created_by: users(:one),
      recipient: users(:two),
      credential: api_key,
      subject: "Subject",
      body: "Body"
    )

    assert_not_equal token, draft.confirmation_digest
    assert_equal draft, AdminEmailDraft.find_by_confirmation(token)
    assert_nil AdminEmailDraft.find_by_confirmation("wrong-token")
  end
end
