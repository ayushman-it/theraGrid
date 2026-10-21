# TheraGrid static site

A lightweight, single-page site built with plain HTML, CSS, and JavaScript. No Node, npm, or build step is used. Serve the page over HTTPS for model loading and device verification.

## Form setup (required before accepting enquiries)

The forms do not report success until a Google Apps Script endpoint has been configured. The endpoint writes enquiries to a private Google Sheet and emails a notification to `thecodemunk@gmail.com` containing only the request reference and enquiry type.

1. Sign in to the Google account that should own the enquiry sheet and open [script.google.com](https://script.google.com/).
2. Create a new project, replace its starter code with `Code.gs`, and save.
3. In the Apps Script editor, select `setupTheraGrid` and click **Run**. Review the requested Google Sheets and email permissions. The script creates a spreadsheet with `Appointments` and `Partners` tabs. Copy its URL from the execution log and keep the sheet private to the authorized care team.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as** to your account. Set access to **Anyone** so website visitors can submit without logging in. Deploy, authorize if prompted, and copy the URL ending in `/exec`.
5. In `index.html`, set `const FORM_ENDPOINT` to the deployed URL ending in `/exec` (the current project endpoint is already configured). Upload the updated site files to your hosting provider.
6. For later `Code.gs` changes, choose **Deploy → Manage deployments → Edit**, select **New version**, and deploy. Run `setupTheraGrid` again after this update so the new state and body-area column headers are added while existing rows remain in place.
7. Send a real onboarding request, appointment request, and partner enquiry from the deployed site. Confirm rows appear in the correct tabs and that the email notification arrives. Then remove test rows and any test message from the inbox.

The receiver validates required fields and consent, limits input lengths, rejects its hidden honeypot field, prevents duplicate reference replays, serializes sheet writes, and escapes spreadsheet formula prefixes. Keep the Sheet private. If the Apps Script deployment URL is changed, update `FORM_ENDPOINT` and redeploy the site. Google Apps Script quotas and availability apply.

## Hosting

For Hostinger shared hosting, upload `index.html` and the complete `assets/` folder (including `models/human-body.glb` and `MODEL-CREDITS.txt`) to the website's `public_html` directory using File Manager or FTP. The 3D viewer code is embedded in `index.html`; it loads the pinned Google model-viewer 4.4.0 module directly from Google CDN, then loads the local Draco-compressed GLB. Do not upload or reference the obsolete `body-selector.js`. Keep `Code.gs` and this README outside the public web directory; `Code.gs` is deployed separately in Google Apps Script. No production build command is needed. Serve the site over HTTPS; `file://` is not a supported deployment test.

## Site settings before launch

- Add the final domain as a canonical URL and update Open Graph metadata in the `<head>` after DNS and HTTPS are active.
- Add a real business phone, address, and contact email if the business wants them shown. The current site does not invent these details.
- Confirm service availability, geography, privacy notice wording, data retention period, and the business's legal name before launch. Update the privacy copy to match the organization's actual practices.
- Replace or approve the Unsplash photos, and verify their current image URLs and licensing/terms for the intended commercial use.
- Add a `robots.txt` and `sitemap.xml` only after the public domain is confirmed.

## Privacy and language

The first-visit onboarding form sends a visitor's name, phone, selected therapy, body area, state, city, and privacy consent to the configured Apps Script. It does not request an email address. The regular appointment form continues to send its contact, service, scheduling, and consent fields. The body-map selection and editable concern summary stay on the page and are excluded from appointment submissions. Marketing consent is optional and stored separately from required privacy consent. The two reserved spreadsheet columns remain blank. Generic UTM campaign fields may be stored with appointment requests; no analytics library or user-level tracking is installed. The page includes English, Hindi, and Hinglish UI strings.

## Project files

- `index.html` — responsive site, content, styling, language controls, and Apps Script endpoint.
- `assets/models/human-body.glb` — locally hosted BodyParts3D anatomical skin model.
- `assets/MODEL-CREDITS.txt` — attribution, license, and ShareAlike notice for the model.
- `Code.gs` — Google Apps Script form receiver and one-time sheet setup.

