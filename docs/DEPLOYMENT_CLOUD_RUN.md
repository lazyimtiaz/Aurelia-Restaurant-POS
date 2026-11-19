# Deploying Aurelia Restaurant POS to Google Cloud Run (Always Free)

This guide deploys **Aurelia Restaurant POS** (`https://aurelio-pos.imtiazuddin.tech`) on **Google Cloud Run** using a lean multi-stage **FrankenPHP + Alpine** image, an automatic **keep-warm cron scheduler**, and **Cloudflare DNS**, engineered to eliminate every common GCP hidden charge.

---

## 1. Zero-Hidden-Charge Guardrails

| GCP Resource | Always Free Allowance | Common Hidden Charge Trap | How This Setup Prevents It |
| :--- | :--- | :--- | :--- |
| **Cloud Run Compute** | `2M` requests, `180,000` vCPU-s, `360,000` GiB-s / mo in Tier-1 US regions | Non-US region, `--min-instances >= 1` (24/7 idle billing), or `--no-cpu-throttling` | Pinned to **`us-central1`**, `--min-instances=0`, `--max-instances=1`, `--cpu-throttling`, `--memory=512Mi` |
| **Artifact Registry** | `0.5 GB` (`500 MB`) / mo globally across your billing account | Default `cloud-run-source-deploy` keeps every build forever and bills `$0.10/GB` once `> 0.5 GB` | Repo `aurelia-pos` applies `artifact-cleanup-policy.json` (`keepCount: 1`, deletes older tags after `24h`) + tiny Alpine multi-stage image |
| **Cloud Storage Staging** | `5 GB` Regional Standard US / mo | `gcloud builds submit` defaults to multi-region `us` staging/log buckets | Uses regional `us-central1` Standard bucket `${PROJECT_ID}-aurelia-pos-build` with 1-day auto-delete (`gcs-lifecycle.json`) |
| **Cloud Build** | `120` build-minutes / day | Deploying on every tiny local edit | Build only when pushing release changes via `deploy.sh` |
| **Cloud Scheduler** | `3` jobs / mo per billing account | **Paused jobs still count/bill!** Extra jobs cost `$0.10/job/mo` | Uses **1 job** (`aurelia-pos-keep-warm`) pinging `/up` every 10 min (`0.25%` of free vCPU-s); `teardown.sh` **deletes** instead of pausing |
| **Custom Domain & SSL** | Free via Cloud Run Domain Mapping | Creating a Global HTTPS Load Balancer (`~$18/mo`) or paying for external IPv4 | Uses `gcloud beta run domain-mappings` (`ghs.googlehosted.com`) with Cloudflare DNS set to **DNS only (Grey cloud)** |
| **Cloud Logging** | `50 GiB` / mo | Verbose `APP_DEBUG=true` / `LOG_LEVEL=debug` log floods | Production `ENV` sets `APP_DEBUG=false`, `LOG_LEVEL=warning`, `LOG_CHANNEL=stderr` |
| **Outreach / Egress** | `1 GiB` / mo North America | Uncached static JS/CSS/images served repeatedly | `docker/Caddyfile` sets `Cache-Control: immutable` on `/build/*` and `24h` cache on `/images/*` |

> **Important Note on Keep-Warm Pricing:** Under request-based billing (`--min-instances=0` + `--cpu-throttling`), Google only bills CPU/memory while `/up` is actively executing (~50–100 ms per ping), NOT while the warm container waits between pings. At `*/10 * * * *` (`~4,464` req/mo), keep-warm uses roughly `446` vCPU-seconds/month (`0.25%` of the `180,000` vCPU-second Always Free quota). Still, **set a $1.00 Budget Alert** in **GCP Billing -> Budgets & alerts** before deploying so you receive instant email alerts if anything changes.

---

## 2. One-Command Deploy via Google Cloud Shell

1. Open [Google Cloud Console](https://console.cloud.google.com/), select/create your GCP project, link your billing account, and create a **$1.00 Budget Alert** (Billing -> Budgets & alerts).
2. Click the **Activate Cloud Shell** (`>_`) icon in the top-right bar and run:

```bash
git clone https://github.com/lazyimtiaz/Aurelia-Restaurant-POS.git
cd Aurelia-Restaurant-POS
bash deploy/cloud-run/deploy.sh YOUR_GCP_PROJECT_ID
```

The script automatically:
- Enables Cloud Run, Artifact Registry, Cloud Build, and Cloud Scheduler
- Creates the `us-central1` Artifact Registry repo + `keepCount=1` cleanup policy
- Creates the `us-central1` Standard GCS build bucket + 1-day auto-delete lifecycle rule
- Builds and pushes the multi-stage FrankenPHP Alpine image
- Deploys Cloud Run (`min-instances=0`, `max-instances=1`, `512Mi`) with auto-migrated & auto-seeded SQLite demo data on container startup
- Configures the Cloud Scheduler `aurelia-pos-keep-warm` cron job (`*/10 * * * *` -> `GET /up`)

*(Optional backup)* If all 3 Always Free GCP Cloud Scheduler slots are used by other projects, delete the GCP Scheduler job and set the GitHub Actions repository variable `KEEP_WARM_URL` to `https://aurelio-pos.imtiazuddin.tech/up` so [.github/workflows/keep-warm.yml](../.github/workflows/keep-warm.yml) handles the 10-minute keep-warm pings instead.

---

## 3. Connect `aurelio-pos.imtiazuddin.tech` in Cloudflare DNS

1. **Verify domain ownership once in Google Cloud** (skip if `imtiazuddin.tech` is already verified in your Google Search Console account):
   ```bash
   gcloud domains verify imtiazuddin.tech
   ```
   *(If prompted, add the verification `TXT` record in Cloudflare DNS and re-run.)*

2. **Create the Cloud Run domain mapping:**
   ```bash
   gcloud beta run domain-mappings create \
     --service=aurelia-pos \
     --domain=aurelio-pos.imtiazuddin.tech \
     --region=us-central1 \
     --project=YOUR_GCP_PROJECT_ID
   ```

3. **Add the CNAME record in Cloudflare Dashboard (`imtiazuddin.tech` -> DNS -> Records):**
   - **Type:** `CNAME`
   - **Name:** `aurelio-pos`
   - **Target:** `ghs.googlehosted.com`
   - **Proxy status:** **DNS only (Grey cloud)** *(Required: keeping it on "DNS only" lets Google Cloud Run issue and automatically renew the free managed TLS certificate for `aurelio-pos.imtiazuddin.tech`; enabling the orange Cloudflare Proxy breaks Google's ACME HTTP/TLS domain validation.)*

4. Wait 10–25 minutes for TLS certificate provisioning, verify status via:
   ```bash
   gcloud beta run domain-mappings describe \
     --domain=aurelio-pos.imtiazuddin.tech \
     --region=us-central1 \
     --project=YOUR_GCP_PROJECT_ID
   ```
   and visit `https://aurelio-pos.imtiazuddin.tech`.

---

## 4. Database Persistence vs. Auto-Resetting Portfolio Demo

By default, Cloud Run mounts `/tmp` in container memory/scratch storage (`DB_DATABASE=/tmp/database.sqlite` with `--max-instances=1`). When a cold start or new revision boots, `docker/entrypoint.sh` creates the SQLite file, runs `php artisan migrate --force`, and seeds `AureliaEnterpriseSeeder` so recruiters always see a fresh restaurant with sample orders, tables, and shifts.

If you ever need **persistent data across container restarts**, switch `DB_CONNECTION` / `DB_DATABASE` (or `mysql` / `pgsql` env vars) to an external free-tier database such as TiDB Cloud / Aiven / Neon and set `AUTO_SEED_DEMO=false` after the initial seed.

---

## 5. Clean Teardown (Remove All Resources)

```bash
bash deploy/cloud-run/teardown.sh YOUR_GCP_PROJECT_ID
```

*(Also delete the `aurelio-pos` CNAME record in Cloudflare DNS afterward.)*
