require "test_helper"

class AdminMailerTest < ActionMailer::TestCase
  test "renders administrator plain text safely in text and html parts" do
    mail = AdminMailer.custom_message(
      "recipient@example.com",
      "Listy Gifty update",
      "Hello\n<script>alert('no')</script>"
    )

    assert_equal [ "recipient@example.com" ], mail.to
    assert_equal "Listy Gifty update", mail.subject
    assert_includes mail.text_part.body.decoded, "<script>alert('no')</script>"
    assert_includes mail.html_part.body.decoded, "&lt;script&gt;alert"
    assert_not_includes mail.html_part.body.decoded, "<script>"
  end
end
