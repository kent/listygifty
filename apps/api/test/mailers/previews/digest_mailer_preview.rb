class DigestMailerPreview < ActionMailer::Preview
  def daily_digest
    user = User.new(email: "demo@example.com", first_name: "Alex")
    collaborator = User.new(email: "sam@example.com", first_name: "Sam")
    holiday = Holiday.new(id: 1, name: "Christmas 2026", date: Date.new(2026, 12, 25), icon: "🎄")
    changes = [
      OpenStruct.new(
        gift: OpenStruct.new(
          id: 1,
          name: "Nintendo Switch",
          recipients: [ OpenStruct.new(name: "Mom") ],
          givers: [ OpenStruct.new(name: "Dad") ],
          gift_status: GiftStatus.new(name: "Purchased")
        ),
        changes_data: {},
        user: user
      ),
      OpenStruct.new(
        gift: OpenStruct.new(
          id: 2,
          name: "Cozy Blanket",
          recipients: [ OpenStruct.new(name: "Sister") ],
          givers: [],
          gift_status: GiftStatus.new(name: "Idea")
        ),
        changes_data: {},
        user: collaborator
      )
    ]

    DigestMailer.daily_digest(user, { holiday => changes }, date: Date.new(2026, 11, 22))
  end
end
