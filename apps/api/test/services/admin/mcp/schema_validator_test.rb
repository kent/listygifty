require "test_helper"

class Admin::Mcp::SchemaValidatorTest < ActiveSupport::TestCase
  test "accepts a valid nested object" do
    schema = {
      type: "object",
      additionalProperties: false,
      required: [ "steps" ],
      properties: {
        steps: { type: "array", minItems: 2, maxItems: 3, items: { type: "string", minLength: 1 } },
        filters: {
          type: "object",
          additionalProperties: false,
          properties: { channel: { type: "string" } }
        }
      }
    }

    assert Admin::Mcp::SchemaValidator.validate!(
      { steps: %w[signup activated], filters: { channel: "organic" } },
      schema
    )
  end

  test "rejects missing, unknown, invalid, and excessive values without echoing them" do
    schema = {
      type: "object",
      additionalProperties: false,
      required: [ "period_days" ],
      properties: { period_days: { type: "integer", minimum: 1, maximum: 365 } }
    }

    assert_raises(ArgumentError) { Admin::Mcp::SchemaValidator.validate!({}, schema) }
    assert_raises(ArgumentError) { Admin::Mcp::SchemaValidator.validate!({ period_days: 7, secret: "do-not-log" }, schema) }
    assert_raises(ArgumentError) { Admin::Mcp::SchemaValidator.validate!({ period_days: "seven" }, schema) }
    error = assert_raises(ArgumentError) { Admin::Mcp::SchemaValidator.validate!({ period_days: 366 }, schema) }

    assert_not_includes error.message, "366"
  end

  test "rejects excessive nesting" do
    value = {}
    cursor = value
    schema = { type: "object", additionalProperties: false, properties: {} }
    schema_cursor = schema
    (Admin::Mcp::SchemaValidator::MAX_DEPTH + 1).times do
      cursor["child"] = {}
      cursor = cursor["child"]
      child_schema = { type: "object", additionalProperties: false, properties: {} }
      schema_cursor[:properties][:child] = child_schema
      schema_cursor = child_schema
    end

    error = assert_raises(ArgumentError) do
      Admin::Mcp::SchemaValidator.validate!(value, schema)
    end

    assert_includes error.message, "nesting is too deep"
  end
end
