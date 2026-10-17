# @marbothgxbot: GitHub + Apps Script + Google Sheets

Telegram sends QR photos to an Apps Script webhook. Apps Script calls the QR decoder on Cloud Run, creates a secret code, replies in Telegram, and stores the timestamp, chat ID, and code in a `Hasil QR` Google Sheets tab. The original QR contents are not stored.

## Deploy

1. Push this repository to a private GitHub repo. Configure GitHub Actions with Google Cloud Workload Identity Federation. Required GitHub Actions secrets: `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `GCP_RUNTIME_SERVICE_ACCOUNT`, and `GCP_PROJECT_ID`.
2. In Google Cloud, create a Secret Manager secret named `marbothgxbot-decoder-key` and grant the decoder runtime service account `roles/secretmanager.secretAccessor`. The secret value must match the `DECODER_SHARED_KEY` you enter in Apps Script.
3. Run the `Deploy QR decoder` workflow. Copy the Cloud Run service URL and append `/decode`. Cloud Run is configured with zero minimum and one maximum instance. It has a monthly free tier, but Google Cloud requires billing and over-quota or related service usage can cost money.
4. Create a Google Sheet, open **Extensions → Apps Script**, and copy `apps_script/Code.gs` into its script project. Deploy as a Web App, executing as you and accessible to anyone.
5. Run `setupBot()` from the bound script and enter the Telegram token, decoder URL, decoder key, webhook key, and HMAC key. Then run `installWebhook()`.
6. Message [@marbothgxbot](https://t.me/marbothgxbot) with `/start`, then send a QR image.

Keep tokens and keys out of GitHub source. Store the decoder key in Google Secret Manager and Apps Script Script Properties.
