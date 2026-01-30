# macOS App Plan (Electron)

We do not currently have a Mac for local testing. This plan focuses on getting a
build pipeline and docs in place so we can start macOS work safely.

## What We Can Do Without a Mac

- Build the macOS app in CI (GitHub Actions).
- Run automated build checks (compile + bundle).
- Prepare config, icons, and documentation.

## What Requires a Mac

- Local UI testing and debugging.
- Code signing and notarization.
- Packaging validation for distribution.

## CI Build Strategy (No‑Mac Local)

We use a macOS GitHub Actions runner to build the Electron app:

1. Install Node 20.
2. Install frontend dependencies.
3. Run `npm run electron:build` in `frontend/`.

This verifies the build path and catches compilation issues.

Workflow: `.github/workflows/electron-macos.yml`

## Next Steps

1. Create a macOS signing plan (developer ID + notarization).
2. Add a simple QA checklist for macOS UI verification.
3. When a Mac is available, run `npm run electron:dev` and validate core flows.
