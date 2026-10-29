#!/usr/bin/env node
// Replaces the committed OpenAPI snapshot with a fresh copy from the published
// API. CI runs this weekly and fails when the published document moves ahead,
// so drift is caught before it reaches a customer's workflow.
//
// Usage:
//   node scripts/sync-spec.mjs
//   node scripts/sync-spec.mjs https://api.verifycate.com/api/v1/openapi.json
//   node scripts/sync-spec.mjs ./openapi.json

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE = 'https://api.verifycate.com/api/v1/openapi.json';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const target = path.join(root, 'openapi', 'openapi.json');

const read = async (source) => {
	if (/^https?:\/\//i.test(source)) {
		const response = await fetch(source, { headers: { accept: 'application/json' } });
		if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
		return response.text();
	}
	return readFile(path.resolve(source), 'utf8');
};

const source = process.argv[2] || process.env.VERIFYCATE_OPENAPI || DEFAULT_SOURCE;

let document;
try {
	document = JSON.parse(await read(source));
} catch (error) {
	console.error(`Unable to read an OpenAPI document from ${source}: ${error.message}`);
	process.exit(1);
}

if (!document.openapi || !document.info?.title || !document.paths) {
	console.error(`${source} is not an OpenAPI document.`);
	process.exit(1);
}

await writeFile(target, `${JSON.stringify(document, null, 2)}\n`);

console.log(
	`Wrote ${path.relative(root, target)} from ${source} ` +
		`(${document.info.title} ${document.info.version ?? 'unversioned'}, ` +
		`${Object.keys(document.paths).length} paths).`,
);
