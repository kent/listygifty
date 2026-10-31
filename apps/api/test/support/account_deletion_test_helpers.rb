# Stands in for Clerk's users API. Every account deletion test swaps this in, so
# none of them can reach the real service.
class FakeClerkUsers
  attr_reader :deletions
  attr_accessor :delete_error

  def self.not_found
    Clerk::Models::Errors::ClerkErrors.new(
      errors: [],
      raw_response: Faraday::Response.new(status: 404)
    )
  end

  def initialize
    @deletions = []
  end

  def delete(user_id:, **options)
    @deletions << { user_id: user_id, **options }
    raise delete_error if delete_error
  end

  def get(user_id:)
    raise self.class.not_found
  end

  def deleted_user_ids
    deletions.map { |deletion| deletion[:user_id] }
  end
end

module AccountDeletionTestHelpers
  extend ActiveSupport::Concern

  included do
    setup do
      fake = @clerk_users = FakeClerkUsers.new
      @real_clerk_users = Clerk::SDK.instance_method(:users)
      Clerk::SDK.define_method(:users) { fake }
    end

    teardown do
      Clerk::SDK.define_method(:users, @real_clerk_users)
    end
  end

  def person(label, first_name: label.capitalize, last_name: "Testerson", **attributes)
    user = User.create!(
      email: "#{label}-#{SecureRandom.hex(4)}@example.com",
      clerk_user_id: "user_#{label}_#{SecureRandom.hex(4)}",
      first_name: first_name,
      last_name: last_name,
      image_url: "https://example.com/#{label}.png",
      clerk_profile_synced_at: Time.current,
      **attributes
    )
    user.ensure_personal_workspace!
    user
  end

  def join_exchange(exchange, user, name: "#{user.first_name} #{user.last_name}")
    exchange.exchange_participants.create!(user: user, email: user.email, name: name, status: "accepted")
  end

  def inviting_exchange(owner, *members, name: "Family Secret Santa")
    exchange = GiftExchange.create!(name: name, user: owner, workspace: owner.personal_workspace, status: "inviting")
    [ owner, *members ].each { |member| join_exchange(exchange, member) }
    exchange
  end

  # A ring, so each person gives to the next and everyone is both a giver and a
  # recipient. Returned in the order the people were passed.
  def drawn_exchange(owner, *members, name: "Family Secret Santa")
    exchange = inviting_exchange(owner, *members, name: name)
    rows = exchange.exchange_participants.order(:id).to_a
    rows.each_with_index { |row, index| row.update!(matched_participant: rows[(index + 1) % rows.size]) }
    exchange.update!(status: "active", published_at: Time.current)
    [ exchange, rows ]
  end

  def share_workspace(workspace, user, role: "member")
    workspace.workspace_memberships.create!(user: user, role: role)
  end

  def tables_pointing_at_users
    connection = ActiveRecord::Base.connection
    connection.tables.flat_map do |table|
      connection.foreign_keys(table).select { |key| key.to_table == "users" }.map { |key| [ table, key.column ] }
    end
  end

  def references_to_user(id)
    connection = ActiveRecord::Base.connection
    tables_pointing_at_users.select do |table, column|
      connection.select_value(
        "SELECT COUNT(*) FROM #{connection.quote_table_name(table)} " \
        "WHERE #{connection.quote_column_name(column)} = #{id.to_i}"
      ).positive?
    end
  end

  def columns_mentioning(text)
    connection = ActiveRecord::Base.connection
    pattern = connection.quote("%#{text}%")
    connection.tables.flat_map do |table|
      searchable = connection.columns(table).select { |column| %i[string text jsonb].include?(column.type) }
      searchable.filter_map do |column|
        quoted_column = connection.quote_column_name(column.name)
        count = connection.select_value(
          "SELECT COUNT(*) FROM #{connection.quote_table_name(table)} WHERE #{quoted_column}::text ILIKE #{pattern}"
        )
        "#{table}.#{column.name}" if count.positive?
      end
    end
  end
end
