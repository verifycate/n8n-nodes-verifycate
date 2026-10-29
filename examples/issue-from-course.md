# Issue a certificate from a completed course

Use this when a course platform, form, or database records a completion and the
learner should receive a credential.

1. **Trigger** — your LMS webhook, a **Schedule Trigger** reading a sheet, or a
   form submission.
2. **Verifycate → Certificate Issue → Add Recipient**
   - **Certificate**: select the course certificate.
   - **Recipient Email**: map the learner's email.
   - **Recipient Name**: map the learner's display name.
   - **Attributes**: map `score`, `completed_at`, or any attribute defined on
     the certificate.
3. **Slack → Send a message**
   - Text: `Certificate issued to {{ $json.recipient_name }}: {{ $json.verification_url }}`

Re-running the workflow for the same learner is safe. Verifycate returns the
existing issue with `already_enrolled: true` instead of failing.
