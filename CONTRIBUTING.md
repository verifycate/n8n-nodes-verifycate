# Contributing

Thanks for helping improve the Verifycate n8n node.

## Development

Requires Node.js 22.

```bash
npm ci
npm run check
```

`npm run check` runs formatting, API drift, the strict n8n linter, the build,
and the tests. Run it before opening a pull request.

## Adding an action

1. Add the operation to the relevant resource in
   `nodes/Verifycate/descriptions.ts`.
2. Implement it in `nodes/Verifycate/operations.ts`.
3. Add the API route to `OPERATIONS` in `scripts/generate-api.mjs`.
4. Run `npm run api:generate`.
5. Add or update a test in `test/operations.test.ts`.

## Adding an event

1. Add the event to `shared/events.ts`.
2. Keep the value identical to the Verifycate webhook documentation.
3. Add it to the trigger test list if the event shape changes.

## Changing the API contract

The committed `openapi/openapi.json` is the source of truth. To refresh it:

```bash
npm run spec:sync
npm run api:generate
```

Review both diffs. The weekly `spec-sync` workflow fails when the published API
moves ahead of the snapshot.

## Pull request checklist

- [ ] `npm run check` passes.
- [ ] New operations have tests and user-facing descriptions.
- [ ] No runtime dependencies were added.
- [ ] README operations or trigger tables updated when the surface changes.
- [ ] CHANGELOG updated for user-visible changes.
