# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_28_000001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "addresses", force: :cascade do |t|
    t.string "city", null: false
    t.bigint "company_profile_id", null: false
    t.string "country", default: "CA", null: false
    t.datetime "created_at", null: false
    t.boolean "is_default", default: false, null: false
    t.string "label", null: false
    t.string "postal_code", null: false
    t.string "state"
    t.string "street_line_1", null: false
    t.string "street_line_2"
    t.datetime "updated_at", null: false
    t.index ["company_profile_id", "is_default"], name: "index_addresses_on_company_profile_id_and_is_default"
    t.index ["company_profile_id", "label"], name: "index_addresses_on_company_profile_id_and_label", unique: true
    t.index ["company_profile_id"], name: "index_addresses_on_company_profile_id"
  end

  create_table "api_keys", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at"
    t.string "key_hash", null: false
    t.string "key_prefix", null: false
    t.datetime "last_used_at"
    t.string "name", null: false
    t.datetime "revoked_at"
    t.string "scopes", default: [], array: true
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["key_prefix"], name: "index_api_keys_on_key_prefix", unique: true
    t.index ["user_id", "revoked_at"], name: "index_api_keys_on_user_id_and_revoked_at"
    t.index ["user_id"], name: "index_api_keys_on_user_id"
  end

  create_table "company_profiles", force: :cascade do |t|
    t.text "address"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.jsonb "tax_metadata", default: {}
    t.datetime "updated_at", null: false
    t.string "website"
    t.bigint "workspace_id", null: false
    t.index ["workspace_id"], name: "index_company_profiles_on_workspace_id", unique: true
  end

  create_table "email_deliveries", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "dedupe_key", null: false
    t.text "error"
    t.bigint "holiday_id"
    t.string "kind", null: false
    t.jsonb "metadata", default: {}
    t.datetime "sent_at", null: false
    t.string "status", default: "sent", null: false
    t.string "subject", null: false
    t.string "to_email", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["holiday_id"], name: "index_email_deliveries_on_holiday_id"
    t.index ["kind"], name: "index_email_deliveries_on_kind"
    t.index ["user_id", "kind", "dedupe_key"], name: "idx_email_deliveries_dedupe", unique: true
    t.index ["user_id", "kind", "sent_at"], name: "index_email_deliveries_on_user_id_and_kind_and_sent_at"
    t.index ["user_id"], name: "index_email_deliveries_on_user_id"
  end

  create_table "exchange_exclusions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "gift_exchange_id", null: false
    t.bigint "participant_a_id", null: false
    t.bigint "participant_b_id", null: false
    t.datetime "updated_at", null: false
    t.index ["gift_exchange_id", "participant_a_id", "participant_b_id"], name: "idx_exchange_exclusions_unique", unique: true
    t.index ["gift_exchange_id"], name: "index_exchange_exclusions_on_gift_exchange_id"
    t.index ["participant_a_id"], name: "index_exchange_exclusions_on_participant_a_id"
    t.index ["participant_b_id"], name: "index_exchange_exclusions_on_participant_b_id"
  end

  create_table "exchange_participants", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.bigint "gift_exchange_id", null: false
    t.string "invite_token", null: false
    t.bigint "matched_participant_id"
    t.string "name", null: false
    t.string "status", default: "invited", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["email"], name: "index_exchange_participants_on_email"
    t.index ["gift_exchange_id", "email"], name: "index_exchange_participants_on_gift_exchange_id_and_email", unique: true
    t.index ["gift_exchange_id"], name: "index_exchange_participants_on_gift_exchange_id"
    t.index ["invite_token"], name: "index_exchange_participants_on_invite_token", unique: true
    t.index ["matched_participant_id"], name: "index_exchange_participants_on_matched_participant_id"
    t.index ["status"], name: "index_exchange_participants_on_status"
    t.index ["user_id"], name: "index_exchange_participants_on_user_id"
  end

  create_table "exchange_wishlist_items", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.bigint "exchange_participant_id", null: false
    t.string "link"
    t.string "name", null: false
    t.decimal "price", precision: 10, scale: 2
    t.datetime "updated_at", null: false
    t.index ["exchange_participant_id"], name: "index_exchange_wishlist_items_on_exchange_participant_id"
    t.index ["name"], name: "index_exchange_wishlist_items_on_name"
  end

  create_table "gift_changes", force: :cascade do |t|
    t.string "change_type", null: false
    t.jsonb "changes_data", default: {}
    t.datetime "created_at", null: false
    t.bigint "gift_id", null: false
    t.bigint "holiday_id", null: false
    t.datetime "notified_at"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["gift_id"], name: "index_gift_changes_on_gift_id"
    t.index ["holiday_id", "notified_at"], name: "index_gift_changes_on_holiday_id_and_notified_at"
    t.index ["holiday_id"], name: "index_gift_changes_on_holiday_id"
    t.index ["notified_at"], name: "index_gift_changes_on_notified_at"
    t.index ["user_id"], name: "index_gift_changes_on_user_id"
  end

  create_table "gift_exchanges", force: :cascade do |t|
    t.decimal "budget_max", precision: 10, scale: 2
    t.decimal "budget_min", precision: 10, scale: 2
    t.datetime "created_at", null: false
    t.date "exchange_date"
    t.string "name", null: false
    t.string "status", default: "draft", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.bigint "workspace_id", null: false
    t.index ["exchange_date"], name: "index_gift_exchanges_on_exchange_date"
    t.index ["status"], name: "index_gift_exchanges_on_status"
    t.index ["user_id"], name: "index_gift_exchanges_on_user_id"
    t.index ["workspace_id", "user_id"], name: "index_gift_exchanges_on_workspace_id_and_user_id"
    t.index ["workspace_id"], name: "index_gift_exchanges_on_workspace_id"
  end

  create_table "gift_givers", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "gift_id", null: false
    t.integer "person_id", null: false
    t.datetime "updated_at", null: false
    t.index ["gift_id"], name: "index_gift_givers_on_gift_id"
    t.index ["person_id"], name: "index_gift_givers_on_person_id"
  end

  create_table "gift_recipients", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "gift_id", null: false
    t.integer "person_id", null: false
    t.bigint "shipping_address_id"
    t.datetime "updated_at", null: false
    t.index ["gift_id"], name: "index_gift_recipients_on_gift_id"
    t.index ["person_id"], name: "index_gift_recipients_on_person_id"
    t.index ["shipping_address_id"], name: "index_gift_recipients_on_shipping_address_id"
  end

  create_table "gift_statuses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name"
    t.integer "position"
    t.datetime "updated_at", null: false
  end

  create_table "gift_suggestions", force: :cascade do |t|
    t.string "approximate_price"
    t.datetime "created_at", null: false
    t.text "description"
    t.integer "holiday_id"
    t.string "name"
    t.integer "person_id", null: false
    t.datetime "updated_at", null: false
    t.index ["holiday_id"], name: "index_gift_suggestions_on_holiday_id"
    t.index ["person_id"], name: "index_gift_suggestions_on_person_id"
  end

  create_table "gifts", force: :cascade do |t|
    t.decimal "cost", precision: 10, scale: 2
    t.datetime "created_at", null: false
    t.integer "created_by_user_id"
    t.text "description"
    t.integer "gift_status_id", null: false
    t.integer "holiday_id", null: false
    t.string "link"
    t.string "name"
    t.integer "position", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_user_id"], name: "index_gifts_on_created_by_user_id"
    t.index ["gift_status_id"], name: "index_gifts_on_gift_status_id"
    t.index ["holiday_id", "position"], name: "index_gifts_on_holiday_id_and_position"
    t.index ["holiday_id"], name: "index_gifts_on_holiday_id"
  end

  create_table "holiday_people", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "holiday_id", null: false
    t.bigint "person_id", null: false
    t.datetime "updated_at", null: false
    t.index ["holiday_id", "person_id"], name: "index_holiday_people_on_holiday_id_and_person_id", unique: true
    t.index ["holiday_id"], name: "index_holiday_people_on_holiday_id"
    t.index ["person_id"], name: "index_holiday_people_on_person_id"
  end

  create_table "holiday_users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "holiday_id", null: false
    t.string "role", default: "collaborator", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.index ["holiday_id"], name: "index_holiday_users_on_holiday_id"
    t.index ["user_id"], name: "index_holiday_users_on_user_id"
  end

  create_table "holidays", force: :cascade do |t|
    t.boolean "archived", default: false, null: false
    t.boolean "completed", default: false, null: false
    t.datetime "created_at", null: false
    t.date "date"
    t.string "icon"
    t.boolean "is_template", default: false, null: false
    t.string "name"
    t.string "share_token"
    t.datetime "updated_at", null: false
    t.bigint "workspace_id"
    t.index ["share_token"], name: "index_holidays_on_share_token", unique: true
    t.index ["workspace_id", "is_template"], name: "index_holidays_on_workspace_id_and_is_template"
    t.index ["workspace_id"], name: "index_holidays_on_workspace_id"
  end

  create_table "match_arrangements", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "groupings", default: [], null: false
    t.bigint "holiday_id", null: false
    t.integer "person_ids", default: [], array: true
    t.string "title", default: "Gift Comparison"
    t.datetime "updated_at", null: false
    t.index ["holiday_id"], name: "index_match_arrangements_on_holiday_id"
  end

  create_table "match_slots", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "gift_id"
    t.string "group_key"
    t.bigint "match_arrangement_id", null: false
    t.bigint "person_id", null: false
    t.integer "row_index", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["gift_id"], name: "index_match_slots_on_gift_id"
    t.index ["match_arrangement_id", "person_id", "row_index"], name: "idx_match_slots_unique", unique: true
    t.index ["match_arrangement_id"], name: "index_match_slots_on_match_arrangement_id"
    t.index ["person_id"], name: "index_match_slots_on_person_id"
  end

  create_table "notification_preferences", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "no_gift_lists_december_enabled", default: true, null: false
    t.boolean "no_gifts_before_christmas_enabled", default: true, null: false
    t.boolean "pending_gifts_reminder_enabled", default: true, null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id"], name: "index_notification_preferences_on_user_id", unique: true
  end

  create_table "oauth_access_tokens", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "ip_address"
    t.datetime "last_used_at"
    t.bigint "oauth_client_id", null: false
    t.datetime "refresh_token_expires_at"
    t.string "refresh_token_hash"
    t.string "resource"
    t.datetime "revoked_at"
    t.jsonb "scopes", default: [], null: false
    t.string "token_hash", null: false
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.bigint "user_id", null: false
    t.index ["expires_at"], name: "index_oauth_access_tokens_on_expires_at"
    t.index ["oauth_client_id"], name: "index_oauth_access_tokens_on_oauth_client_id"
    t.index ["refresh_token_hash"], name: "index_oauth_access_tokens_on_refresh_token_hash", unique: true, where: "(refresh_token_hash IS NOT NULL)"
    t.index ["token_hash"], name: "index_oauth_access_tokens_on_token_hash", unique: true
    t.index ["user_id", "revoked_at"], name: "idx_oauth_tokens_user_active"
    t.index ["user_id"], name: "index_oauth_access_tokens_on_user_id"
  end

  create_table "oauth_authorization_codes", force: :cascade do |t|
    t.string "code_challenge"
    t.string "code_challenge_method"
    t.string "code_hash", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "oauth_client_id", null: false
    t.string "redirect_uri", null: false
    t.string "resource"
    t.jsonb "scopes", default: [], null: false
    t.string "state"
    t.datetime "updated_at", null: false
    t.datetime "used_at"
    t.bigint "user_id", null: false
    t.index ["code_hash"], name: "index_oauth_authorization_codes_on_code_hash", unique: true
    t.index ["expires_at"], name: "index_oauth_authorization_codes_on_expires_at"
    t.index ["oauth_client_id"], name: "index_oauth_authorization_codes_on_oauth_client_id"
    t.index ["user_id"], name: "index_oauth_authorization_codes_on_user_id"
  end

  create_table "oauth_clients", force: :cascade do |t|
    t.string "client_id", null: false
    t.string "client_secret_hash"
    t.string "client_uri"
    t.datetime "created_at", null: false
    t.text "description"
    t.jsonb "grant_types", default: ["authorization_code"], null: false
    t.boolean "is_dynamic", default: false, null: false
    t.boolean "is_system", default: false, null: false
    t.string "logo_uri"
    t.string "name", null: false
    t.jsonb "redirect_uris", default: [], null: false
    t.jsonb "response_types", default: ["code"], null: false
    t.datetime "revoked_at"
    t.jsonb "scopes", default: ["read", "write"], null: false
    t.string "token_endpoint_auth_method", default: "none"
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.index ["client_id"], name: "index_oauth_clients_on_client_id", unique: true
    t.index ["is_system"], name: "index_oauth_clients_on_is_system"
    t.index ["user_id"], name: "index_oauth_clients_on_user_id"
  end

  create_table "people", force: :cascade do |t|
    t.integer "age"
    t.datetime "created_at", null: false
    t.string "email"
    t.string "gender"
    t.string "name"
    t.text "notes"
    t.string "relationship"
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.bigint "workspace_id", null: false
    t.index ["user_id"], name: "index_people_on_user_id"
    t.index ["workspace_id", "email"], name: "index_people_on_workspace_id_and_email_unique", unique: true, where: "(email IS NOT NULL)"
    t.index ["workspace_id", "user_id"], name: "index_people_on_workspace_id_and_user_id"
    t.index ["workspace_id"], name: "index_people_on_workspace_id"
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "clerk_user_id", null: false
    t.datetime "created_at", null: false
    t.boolean "digest_enabled", default: true, null: false
    t.string "email", null: false
    t.string "email_preferences_token"
    t.string "first_name"
    t.string "image_url"
    t.datetime "last_digest_sent_at"
    t.string "last_name"
    t.string "phone"
    t.string "stripe_customer_id"
    t.datetime "subscription_expires_at"
    t.string "subscription_plan", default: "free", null: false
    t.datetime "updated_at", null: false
    t.string "username"
    t.datetime "welcomed_at"
    t.index ["clerk_user_id"], name: "index_users_on_clerk_user_id", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["email_preferences_token"], name: "index_users_on_email_preferences_token", unique: true
    t.index ["stripe_customer_id"], name: "index_users_on_stripe_customer_id", unique: true
  end

  create_table "wishlist_item_claims", force: :cascade do |t|
    t.string "claim_token"
    t.datetime "claimed_at", null: false
    t.string "claimer_email"
    t.string "claimer_name"
    t.datetime "created_at", null: false
    t.text "message"
    t.datetime "purchased_at"
    t.integer "quantity", default: 1, null: false
    t.datetime "revealed_at"
    t.string "status", default: "reserved", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id"
    t.bigint "wishlist_item_id", null: false
    t.index ["claim_token"], name: "index_wishlist_item_claims_on_claim_token", unique: true
    t.index ["status"], name: "index_wishlist_item_claims_on_status"
    t.index ["user_id"], name: "index_wishlist_item_claims_on_user_id"
    t.index ["wishlist_item_id", "claimer_email"], name: "idx_unique_guest_claim_per_item", unique: true, where: "(claimer_email IS NOT NULL)"
    t.index ["wishlist_item_id", "user_id"], name: "idx_unique_user_claim_per_item", unique: true, where: "(user_id IS NOT NULL)"
    t.index ["wishlist_item_id"], name: "index_wishlist_item_claims_on_wishlist_item_id"
  end

  create_table "wishlist_items", force: :cascade do |t|
    t.datetime "archived_at"
    t.datetime "created_at", null: false
    t.string "image_url"
    t.string "name", null: false
    t.text "notes"
    t.integer "position", default: 0, null: false
    t.decimal "price_max", precision: 10, scale: 2
    t.decimal "price_min", precision: 10, scale: 2
    t.integer "priority", default: 0, null: false
    t.integer "quantity", default: 1, null: false
    t.datetime "updated_at", null: false
    t.string "url"
    t.bigint "wishlist_id", null: false
    t.index ["wishlist_id", "archived_at"], name: "index_wishlist_items_on_wishlist_id_and_archived_at"
    t.index ["wishlist_id", "position"], name: "index_wishlist_items_on_wishlist_id_and_position"
    t.index ["wishlist_id"], name: "index_wishlist_items_on_wishlist_id"
  end

  create_table "wishlists", force: :cascade do |t|
    t.boolean "anti_spoiler_enabled", default: true, null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.string "share_token"
    t.date "target_date"
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.string "visibility", default: "private", null: false
    t.bigint "workspace_id", null: false
    t.index ["share_token"], name: "index_wishlists_on_share_token", unique: true
    t.index ["user_id"], name: "index_wishlists_on_user_id"
    t.index ["visibility", "workspace_id"], name: "index_wishlists_on_visibility_and_workspace_id"
    t.index ["workspace_id", "user_id"], name: "index_wishlists_on_workspace_id_and_user_id"
    t.index ["workspace_id"], name: "index_wishlists_on_workspace_id"
  end

  create_table "workspace_invites", force: :cascade do |t|
    t.datetime "accepted_at"
    t.bigint "accepted_by_id"
    t.datetime "created_at", null: false
    t.string "email"
    t.datetime "expires_at", null: false
    t.bigint "invited_by_id", null: false
    t.string "role", default: "member", null: false
    t.string "token", null: false
    t.datetime "updated_at", null: false
    t.bigint "workspace_id", null: false
    t.index ["accepted_by_id"], name: "index_workspace_invites_on_accepted_by_id"
    t.index ["invited_by_id"], name: "index_workspace_invites_on_invited_by_id"
    t.index ["token"], name: "index_workspace_invites_on_token", unique: true
    t.index ["workspace_id", "expires_at"], name: "index_workspace_invites_on_workspace_id_and_expires_at"
    t.index ["workspace_id"], name: "index_workspace_invites_on_workspace_id"
  end

  create_table "workspace_memberships", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "role", default: "member", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.bigint "workspace_id", null: false
    t.index ["role"], name: "index_workspace_memberships_on_role"
    t.index ["user_id"], name: "index_workspace_memberships_on_user_id"
    t.index ["workspace_id", "user_id"], name: "index_workspace_memberships_on_workspace_id_and_user_id", unique: true
    t.index ["workspace_id"], name: "index_workspace_memberships_on_workspace_id"
  end

  create_table "workspaces", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "created_by_user_id", null: false
    t.string "name", null: false
    t.boolean "show_gift_addresses", default: false, null: false
    t.datetime "updated_at", null: false
    t.string "workspace_type", default: "personal", null: false
    t.index ["created_by_user_id"], name: "index_workspaces_on_created_by_user_id"
    t.index ["workspace_type"], name: "index_workspaces_on_workspace_type"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "addresses", "company_profiles"
  add_foreign_key "api_keys", "users"
  add_foreign_key "company_profiles", "workspaces"
  add_foreign_key "email_deliveries", "holidays"
  add_foreign_key "email_deliveries", "users"
  add_foreign_key "exchange_exclusions", "exchange_participants", column: "participant_a_id"
  add_foreign_key "exchange_exclusions", "exchange_participants", column: "participant_b_id"
  add_foreign_key "exchange_exclusions", "gift_exchanges"
  add_foreign_key "exchange_participants", "exchange_participants", column: "matched_participant_id"
  add_foreign_key "exchange_participants", "gift_exchanges"
  add_foreign_key "exchange_participants", "users"
  add_foreign_key "exchange_wishlist_items", "exchange_participants"
  add_foreign_key "gift_changes", "gifts"
  add_foreign_key "gift_changes", "holidays"
  add_foreign_key "gift_changes", "users"
  add_foreign_key "gift_exchanges", "users"
  add_foreign_key "gift_exchanges", "workspaces"
  add_foreign_key "gift_givers", "gifts"
  add_foreign_key "gift_givers", "people"
  add_foreign_key "gift_recipients", "addresses", column: "shipping_address_id"
  add_foreign_key "gift_recipients", "gifts"
  add_foreign_key "gift_recipients", "people"
  add_foreign_key "gift_suggestions", "holidays"
  add_foreign_key "gift_suggestions", "people"
  add_foreign_key "gifts", "gift_statuses"
  add_foreign_key "gifts", "holidays"
  add_foreign_key "gifts", "users", column: "created_by_user_id"
  add_foreign_key "holiday_people", "holidays"
  add_foreign_key "holiday_people", "people"
  add_foreign_key "holiday_users", "holidays"
  add_foreign_key "holiday_users", "users"
  add_foreign_key "holidays", "workspaces"
  add_foreign_key "match_arrangements", "holidays"
  add_foreign_key "match_slots", "gifts"
  add_foreign_key "match_slots", "match_arrangements"
  add_foreign_key "match_slots", "people"
  add_foreign_key "notification_preferences", "users"
  add_foreign_key "oauth_access_tokens", "oauth_clients"
  add_foreign_key "oauth_access_tokens", "users"
  add_foreign_key "oauth_authorization_codes", "oauth_clients"
  add_foreign_key "oauth_authorization_codes", "users"
  add_foreign_key "oauth_clients", "users"
  add_foreign_key "people", "users"
  add_foreign_key "people", "workspaces"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "wishlist_item_claims", "users"
  add_foreign_key "wishlist_item_claims", "wishlist_items"
  add_foreign_key "wishlist_items", "wishlists"
  add_foreign_key "wishlists", "users"
  add_foreign_key "wishlists", "workspaces"
  add_foreign_key "workspace_invites", "users", column: "accepted_by_id"
  add_foreign_key "workspace_invites", "users", column: "invited_by_id"
  add_foreign_key "workspace_invites", "workspaces"
  add_foreign_key "workspace_memberships", "users"
  add_foreign_key "workspace_memberships", "workspaces"
  add_foreign_key "workspaces", "users", column: "created_by_user_id"
end
