# IHI Soft Launch Updates

This zip includes the soft-launch polish updates requested:

## Included changes

- Account avatar fallback image
  - Added `client/public/img/avatar-placeholder.png`
  - Updated profile avatar rendering to fall back if a saved avatar URL breaks.

- Customer Forms PDF downloads
  - Added styled download/preview cards on `CustomerForms.jsx`
  - Added CSS in `CustomerForms.css`
  - Added PDF template files in `client/public/forms/`
    - `ihi-credit-application.pdf`
    - `ihi-tax-exempt-form.pdf`
    - `ihi-new-account-setup.pdf`

> Note: the included PDFs are soft-launch templates. Replace them with your final approved company forms when those are ready, keeping the same filenames if you want the page links to keep working.

- Subcategory images
  - Added missing images in `client/public/images/subcategories/`
  - Added an image fallback inside `CategoryCard.jsx`.

- Newsletter setup
  - Footer newsletter form now validates, submits, disables while sending, and shows success/error text.
  - Added backend route: `server/src/routes/newsletterRoutes.js`
  - Mounted route at `POST /api/newsletter` in `server/src/server.js`
  - Added `sendNewsletterSignupEmail` in `server/src/utils/mailer.js`
  - Optional env: `NEWSLETTER_TO`. If not set, it uses `EMAIL_TO`.

- Shop Now placeholders for featured products
  - Added missing featured images in `client/public/images/featured/`
  - Added fallback image handling/styling in the Shop Now featured cards.

- Extra quick win
  - Fixed two design-token asset references:
    - `hero-main.jph` -> `hero-main.jpg`
    - account thumb now points to an existing public image.
  - Added `framer-motion` to `client/package.json` because `App.jsx` imports it and the build was failing without it.

## Validation

- `client npm run build` passes.
- Server newsletter route and mailer files pass Node syntax checks.

## After copying in

Run this from the client folder to make sure the new dependency is installed:

```bash
npm install
```

Then restart your backend server so `/api/newsletter` is available.
