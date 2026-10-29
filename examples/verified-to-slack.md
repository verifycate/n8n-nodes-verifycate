# Notify a channel when a certificate is verified

Use this to route public verification activity into Slack, Teams, or a CRM.

1. **Verifycate Trigger**
   - **Events**: `Engagement: Verified`
   - **Certificate**: leave empty for every certificate, or select one.
   - **Include Full Certificate Issue**: on if you need the latest status and
     attributes.
2. **Slack → Send a message**
   - Text:
     ```
     {{ $json.data.recipient_name }} verified
     {{ $json.data.certificate_name }}
     {{ $json.verification_url }}
     ```

The trigger is a signed webhook. Failed deliveries are retried by Verifycate,
and the same event id can arrive more than once. Add a deduplication step if
your destination is not idempotent.
