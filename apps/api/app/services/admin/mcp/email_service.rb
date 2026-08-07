module Admin
  module Mcp
    class EmailService
      def initialize(actor:, credential:, request_id: nil)
        @actor = actor
        @credential = Admin::Credential.wrap(credential)
        @request_id = request_id
      end

      def preview(user_id:, subject:, body:)
        recipient = User.find(user_id)
        draft = nil
        token = nil

        AdminEmailDraft.transaction do
          draft, token = AdminEmailDraft.create_with_confirmation!(
            created_by: @actor,
            recipient: recipient,
            credential: @credential,
            subject: subject,
            body: body
          )
          AdminAuditEvent.record!(
            actor: @actor,
            action: "email.preview",
            resource: draft,
            metadata: audit_metadata(
              recipient_user_id: recipient.id,
              recipient_email: recipient.email,
              subject: draft.subject
            )
          )
        end

        {
          draft_id: draft.id,
          recipient: { user_id: recipient.id, email: recipient.email, name: recipient.safe_name },
          subject: draft.subject,
          body_preview: draft.body,
          expires_at: draft.expires_at.iso8601,
          confirmation_token: token
        }
      end

      def confirm(token:)
        draft = AdminEmailDraft.find_by_confirmation(token)
        raise ArgumentError, "Invalid email confirmation token" unless draft

        draft.with_lock do
          raise ArgumentError, "This email confirmation belongs to another administrator" unless draft.created_by_id == @actor.id
          raise ArgumentError, "This email confirmation belongs to another #{@credential.label}" unless @credential.matches?(draft)
          raise ArgumentError, "This email confirmation has expired" if draft.expired?
          raise ArgumentError, "This email has already been queued" if draft.consumed?

          AdminEmailDraft.transaction do
            AdminMailer.custom_message(draft.recipient_email, draft.subject, draft.body).deliver_later
            draft.update!(queued_at: Time.current)
            AdminAuditEvent.record!(
              actor: @actor,
              action: "email.confirm",
              resource: draft,
              metadata: audit_metadata(
                recipient_user_id: draft.recipient_id,
                recipient_email: draft.recipient_email,
                subject: draft.subject
              )
            )
          end
        end

        { draft_id: draft.id, status: "queued", queued_at: draft.queued_at.iso8601 }
      end

      private

      def audit_metadata(metadata)
        metadata.merge(@credential.audit_metadata).merge(request_id: @request_id).compact
      end
    end
  end
end
