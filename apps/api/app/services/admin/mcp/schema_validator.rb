module Admin
  module Mcp
    class SchemaValidator
      MAX_DEPTH = 20

      def self.validate!(value, schema)
        new.validate!(value, schema.deep_stringify_keys, "$", 0)
      end

      def validate!(value, schema, path, depth)
        raise ArgumentError, "Invalid arguments at #{path}: nesting is too deep" if depth > MAX_DEPTH

        validate_one_of!(value, schema["oneOf"], path, depth) if schema["oneOf"]
        validate_type!(value, schema["type"], path) if schema["type"]
        validate_enum!(value, schema["enum"], path) if schema["enum"]

        case value
        when Hash then validate_object!(value.stringify_keys, schema, path, depth)
        when Array then validate_array!(value, schema, path, depth)
        when String then validate_string!(value, schema, path)
        when Numeric then validate_number!(value, schema, path)
        end
        true
      end

      private

      def validate_one_of!(value, schemas, path, depth)
        matches = schemas.count do |candidate|
          validate!(value, candidate, path, depth + 1)
        rescue ArgumentError
          false
        end
        return if matches == 1

        raise ArgumentError, "Invalid arguments at #{path}: expected exactly one allowed shape"
      end

      def validate_type!(value, expected, path)
        types = Array(expected)
        return if types.any? { |type| type_matches?(value, type) }

        raise ArgumentError, "Invalid arguments at #{path}: expected #{types.join(' or ')}"
      end

      def type_matches?(value, type)
        case type
        when "object" then value.is_a?(Hash)
        when "array" then value.is_a?(Array)
        when "string" then value.is_a?(String)
        when "integer" then value.is_a?(Integer)
        when "number" then value.is_a?(Numeric)
        when "boolean" then value == true || value == false
        when "null" then value.nil?
        else false
        end
      end

      def validate_enum!(value, allowed, path)
        return if allowed.include?(value)

        raise ArgumentError, "Invalid arguments at #{path}: value is not in the allowed set"
      end

      def validate_object!(value, schema, path, depth)
        properties = (schema["properties"] || {}).stringify_keys
        missing = Array(schema["required"]).map(&:to_s) - value.keys
        raise ArgumentError, "Invalid arguments at #{path}: missing #{missing.sort.join(', ')}" if missing.any?

        unknown = value.keys - properties.keys
        additional = schema.fetch("additionalProperties", true)
        if additional == false && unknown.any?
          raise ArgumentError, "Invalid arguments at #{path}: unknown #{unknown.sort.join(', ')}"
        end

        value.each do |key, child|
          child_schema = properties[key]
          child_schema ||= additional if additional.is_a?(Hash)
          validate!(child, child_schema, "#{path}.#{key}", depth + 1) if child_schema
        end
      end

      def validate_array!(value, schema, path, depth)
        if schema.key?("minItems") && value.length < schema["minItems"]
          raise ArgumentError, "Invalid arguments at #{path}: too few items"
        end
        if schema.key?("maxItems") && value.length > schema["maxItems"]
          raise ArgumentError, "Invalid arguments at #{path}: too many items"
        end

        if schema["uniqueItems"] && value.uniq.length != value.length
          raise ArgumentError, "Invalid arguments at #{path}: duplicate items"
        end

        item_schema = schema["items"]
        value.each_with_index { |child, index| validate!(child, item_schema, "#{path}[#{index}]", depth + 1) } if item_schema
      end

      def validate_string!(value, schema, path)
        if schema.key?("minLength") && value.length < schema["minLength"]
          raise ArgumentError, "Invalid arguments at #{path}: string is too short"
        end
        if schema.key?("maxLength") && value.length > schema["maxLength"]
          raise ArgumentError, "Invalid arguments at #{path}: string is too long"
        end
      end

      def validate_number!(value, schema, path)
        if schema.key?("minimum") && value < schema["minimum"]
          raise ArgumentError, "Invalid arguments at #{path}: value is below the minimum"
        end
        if schema.key?("maximum") && value > schema["maximum"]
          raise ArgumentError, "Invalid arguments at #{path}: value is above the maximum"
        end
      end
    end
  end
end
