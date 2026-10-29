// n8n-workflow ships ESM source maps without their sources, which makes Node
// print hundreds of warnings during tests. Source maps are not useful here.
// eslint-disable-next-line @n8n/community-nodes/no-restricted-globals
process.setSourceMapsEnabled?.(false);
