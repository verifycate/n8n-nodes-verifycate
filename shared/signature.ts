import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifycate signs the exact raw request body with HMAC-SHA256 and sends the
 * hex digest in `X-Verifycate-Signature`. Verification must run before the
 * parsed body is trusted, because re-serialising JSON can change the bytes.
 */
export function verifySignature(
	rawBody: Buffer | string,
	signature: string | undefined,
	secret: string,
): boolean {
	if (!signature || !secret) return false;

	const received = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature;
	if (!/^[a-f0-9]+$/i.test(received)) return false;

	const expected = createHmac('sha256', secret).update(rawBody).digest();
	let receivedBytes: Buffer;
	try {
		receivedBytes = Buffer.from(received, 'hex');
	} catch {
		return false;
	}

	return expected.length === receivedBytes.length && timingSafeEqual(expected, receivedBytes);
}
