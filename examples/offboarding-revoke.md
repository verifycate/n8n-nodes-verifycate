# Revoke and replace on offboarding

Use this when an employee leaves and their credential must stop verifying.

1. **Trigger** — an HR webhook, a schedule reading an offboarding sheet, or a
   manual trigger.
2. **Verifycate → Certificate Issue → Revoke**
   - **Certificate**: the employee credential.
   - **Recipient Email**: the employee's email.
   - **Reason**: `Offboarded on {{ $now.format('yyyy-MM-dd') }}`
   - **Public Note**: optional; this is shown on the revoked credential page.
3. **Verifycate → Certificate Issue → Replace** (only when the same person
   should receive a corrected credential)
   - The revoked credential stays revoked.
   - The replacement gets a new verification link.
   - Replacing costs one credit.

Both actions look up the recipient by certificate and email, then explain the
current status if the request cannot proceed. For example, revoking an already
revoked credential stops with a message instead of calling the API again.
