class RenameDefaultWorkspaceNames < ActiveRecord::Migration[8.1]
  OLD_SUFFIX = "'s Workspace".freeze
  NEW_SUFFIXES = { "personal" => "'s Gifts", "business" => "'s Group" }.freeze

  def up
    NEW_SUFFIXES.each do |workspace_type, suffix|
      execute <<~SQL
        UPDATE workspaces
        SET name = SUBSTR(name, 1, LENGTH(name) - #{OLD_SUFFIX.length}) || #{connection.quote(suffix)},
            updated_at = CURRENT_TIMESTAMP
        WHERE workspace_type = #{connection.quote(workspace_type)}
          AND name LIKE #{connection.quote("%#{OLD_SUFFIX}")}
      SQL
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
