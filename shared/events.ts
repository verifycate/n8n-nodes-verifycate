export type VerifycateEvent = {
	value: string;
	label: string;
	group: string;
	description: string;
};

/**
 * Every event type Verifycate documents for workspace webhooks. The trigger
 * subscribes to the selected values; adding a new event is a single entry here.
 *
 * Source: https://developers.verifycate.com/docs/api/webhooks/overview
 */
export const VERIFYCATE_EVENTS: readonly VerifycateEvent[] = [
	{
		value: 'certificate.created',
		label: 'Created',
		group: 'Certificate',
		description: 'A certificate was created.',
	},
	{
		value: 'certificate.updated',
		label: 'Updated',
		group: 'Certificate',
		description: 'A certificate programme or its settings changed.',
	},
	{
		value: 'certificate.archived',
		label: 'Archived',
		group: 'Certificate',
		description: 'A certificate was archived.',
	},
	{
		value: 'template.published',
		label: 'Design Published',
		group: 'Certificate',
		description: 'A certificate design was published.',
	},
	{
		value: 'recipient.enrolled',
		label: 'Recipient Enrolled',
		group: 'Certificate',
		description: 'A recipient was added to a certificate, before it is issued.',
	},
	{
		value: 'certificate.issued',
		label: 'Issued',
		group: 'Certificate',
		description: 'A recipient was issued a certificate.',
	},
	{
		value: 'certificate.bulk_sent',
		label: 'Bulk Sent',
		group: 'Certificate',
		description: 'Certificates were sent to several recipients in one batch.',
	},
	{
		value: 'certificate.reissued',
		label: 'Reissued',
		group: 'Certificate',
		description: 'A certificate was reissued onto the latest published design.',
	},
	{
		value: 'certificate.amended',
		label: 'Amended',
		group: 'Certificate',
		description: 'An issued certificate was corrected or amended.',
	},
	{
		value: 'certificate.revoked',
		label: 'Revoked',
		group: 'Certificate',
		description: 'A recipient certificate was revoked.',
	},
	{
		value: 'certificate.deleted',
		label: 'Issue Deleted',
		group: 'Certificate',
		description: 'A recipient certificate record was deleted.',
	},
	{
		value: 'request.submitted',
		label: 'Submitted',
		group: 'Certificate Request',
		description: 'An applicant submitted a certificate request form.',
	},
	{
		value: 'request.approved',
		label: 'Approved',
		group: 'Certificate Request',
		description: 'A certificate request was approved.',
	},
	{
		value: 'request.rejected',
		label: 'Rejected',
		group: 'Certificate Request',
		description: 'A certificate request was rejected.',
	},
	{
		value: 'request.reopened',
		label: 'Reopened',
		group: 'Certificate Request',
		description: 'A certificate request was reopened for review.',
	},
	{
		value: 'correction.submitted',
		label: 'Submitted',
		group: 'Correction',
		description: 'A recipient submitted a correction to their certificate details.',
	},
	{
		value: 'correction.approved',
		label: 'Approved',
		group: 'Correction',
		description: 'A correction request was approved and applied.',
	},
	{
		value: 'correction.rejected',
		label: 'Rejected',
		group: 'Correction',
		description: 'A correction request was rejected.',
	},
	{
		value: 'certificate.verified',
		label: 'Verified',
		group: 'Engagement',
		description: 'Someone verified a certificate on its public page.',
	},
	{
		value: 'certificate.opened_from_email',
		label: 'Opened From Email',
		group: 'Engagement',
		description: 'A recipient opened their certificate from a delivery email.',
	},
	{
		value: 'certificate.downloaded',
		label: 'Downloaded',
		group: 'Engagement',
		description: 'A recipient downloaded their certificate.',
	},
	{
		value: 'email.opened',
		label: 'Email Opened',
		group: 'Engagement',
		description: 'A certificate delivery email was opened.',
	},
	{
		value: 'email.clicked',
		label: 'Email Link Clicked',
		group: 'Engagement',
		description: 'A link in a certificate delivery email was clicked.',
	},
	{
		value: 'share.linkedin_add',
		label: 'LinkedIn Profile Add',
		group: 'Engagement',
		description: 'A recipient added the certificate to their LinkedIn profile.',
	},
	{
		value: 'share.linkedin',
		label: 'LinkedIn Share',
		group: 'Engagement',
		description: 'A certificate was shared on LinkedIn.',
	},
	{
		value: 'share.x',
		label: 'X Share',
		group: 'Engagement',
		description: 'A certificate was shared on X.',
	},
	{
		value: 'share.facebook',
		label: 'Facebook Share',
		group: 'Engagement',
		description: 'A certificate was shared on Facebook.',
	},
	{
		value: 'share.whatsapp',
		label: 'WhatsApp Share',
		group: 'Engagement',
		description: 'A certificate was shared on WhatsApp.',
	},
	{
		value: 'share.telegram',
		label: 'Telegram Share',
		group: 'Engagement',
		description: 'A certificate was shared on Telegram.',
	},
	{
		value: 'share.email',
		label: 'Email Share',
		group: 'Engagement',
		description: 'A certificate was shared by email.',
	},
	{
		value: 'share.link_copied',
		label: 'Verification Link Copied',
		group: 'Engagement',
		description: 'A recipient copied the public verification link.',
	},
	{
		value: 'form_invite.sent',
		label: 'Invite Sent',
		group: 'Forms',
		description: 'An unlock or request form invitation was sent.',
	},
	{
		value: 'request_form.opened',
		label: 'Request Form Opened',
		group: 'Forms',
		description: 'A recipient opened a certificate request form.',
	},
	{
		value: 'request_form.submitted',
		label: 'Request Form Submitted',
		group: 'Forms',
		description: 'A recipient submitted a certificate request form.',
	},
];

export const EVENT_TYPE_VALUES = VERIFYCATE_EVENTS.map((event) => event.value);

export const eventOptions = [
	{
		name: 'All Events',
		value: '*',
		description: 'Receive every event in the workspace.',
	},
	...VERIFYCATE_EVENTS.map((event) => ({
		name: `${event.group}: ${event.label}`,
		value: event.value,
		description: event.description,
	})),
];
