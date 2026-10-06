# UI version 1

Release date: 2026-10-05 (America/Los_Angeles).
Git release marker: `ui-v1`.

This baseline captures the current ClearPlate website: public landing and compact sign-in, Google/Supabase integration, prominent voice assistant, recipe and nutrient UI, RD report, and the two-section How it works page.

The dietitian consultation image is retained. The personal-use section uses the replacement image supplied by the user, saved as `public/images/how-it-works/at-home-ui-v1.png`. The original `at-home.png` is retained as a previous asset. Layout is unchanged.

Readiness boundaries: phone SMS provider, paid subscriptions, practice sponsorship, automated patient sync, ingredient-based voice recommendations and continuous cooking dialogue are not activated. Google public availability and production environment configuration require their own verification. This UI marker does not certify clinical validation or production data migrations.

Secrets and local browser/test artifacts are excluded from Git. Supabase migrations are versioned as code; this release does not execute them against live patient data.
