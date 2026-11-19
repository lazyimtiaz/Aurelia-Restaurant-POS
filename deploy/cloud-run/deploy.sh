#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
    echo "Usage: bash deploy/cloud-run/deploy.sh <GCP_PROJECT_ID>" >&2
    echo "Or set a default project first: gcloud config set project <GCP_PROJECT_ID>" >&2
    exit 1
fi

# Strictly pinned to Tier-1 US Always Free region + caps
REGION="us-central1"
SERVICE_NAME="aurelia-pos"
REPO_NAME="aurelia-pos"
SCHEDULER_JOB="aurelia-pos-keep-warm"
DOMAIN="aurelio-pos.imtiazuddin.tech"
BUILD_BUCKET="${PROJECT_ID}-aurelia-pos-build"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

cd "${ROOT_DIR}"

echo "==> [1/7] Enabling required GCP APIs for project: ${PROJECT_ID}"
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    cloudscheduler.googleapis.com \
    --project="${PROJECT_ID}"

echo "==> [2/7] Ensuring Artifact Registry repo in ${REGION} with keepCount=1 cleanup policy"
if ! gcloud artifacts repositories describe "${REPO_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" >/dev/null 2>&1; then
    gcloud artifacts repositories create "${REPO_NAME}" \
        --project="${PROJECT_ID}" \
        --repository-format=docker \
        --location="${REGION}" \
        --description="Aurelia Restaurant POS container images"
fi

gcloud artifacts repositories set-cleanup-policies "${REPO_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --policy="${SCRIPT_DIR}/artifact-cleanup-policy.json" \
    --no-dry-run

echo "==> [3/7] Ensuring regional ${REGION} Standard GCS build bucket with 1-day auto-delete lifecycle"
if ! gcloud storage buckets describe "gs://${BUILD_BUCKET}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://${BUILD_BUCKET}" \
        --project="${PROJECT_ID}" \
        --location="${REGION}" \
        --default-storage-class=STANDARD \
        --uniform-bucket-level-access \
        --public-access-prevention
fi

gcloud storage buckets update "gs://${BUILD_BUCKET}" \
    --project="${PROJECT_ID}" \
    --lifecycle-file="${SCRIPT_DIR}/gcs-lifecycle.json"

echo "==> [4/7] Building and pushing FrankenPHP image via Cloud Build"
gcloud builds submit "${ROOT_DIR}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --gcs-source-staging-dir="gs://${BUILD_BUCKET}/source" \
    --gcs-log-dir="gs://${BUILD_BUCKET}/logs" \
    --tag="${IMAGE_URI}"

echo "==> [5/7] Resolving persistent APP_KEY"
APP_KEY=""
if gcloud run services describe "${SERVICE_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" >/dev/null 2>&1; then
    APP_KEY="$(gcloud run services describe "${SERVICE_NAME}" \
        --project="${PROJECT_ID}" \
        --region="${REGION}" \
        --format=json \
        | python3 -c "import json,sys; d=json.load(sys.stdin); envs=d.get('spec',{}).get('template',{}).get('spec',{}).get('containers',[{}])[0].get('env',[]); print(next((e.get('value','') for e in envs if e.get('name')=='APP_KEY'), ''))" 2>/dev/null || true)"
fi

if [[ -z "${APP_KEY}" ]]; then
    APP_KEY="base64:$(openssl rand -base64 32)"
    echo "    Generated new APP_KEY for Cloud Run service."
else
    echo "    Reusing existing APP_KEY from Cloud Run service."
fi

echo "==> [6/7] Deploying Cloud Run service (${REGION}, min=0, max=1, 512Mi, cpu-throttling)"
gcloud run deploy "${SERVICE_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --image="${IMAGE_URI}" \
    --platform=managed \
    --port=8080 \
    --min-instances=0 \
    --max-instances=1 \
    --concurrency=80 \
    --cpu=1 \
    --memory=512Mi \
    --cpu-throttling \
    --timeout=60 \
    --allow-unauthenticated \
    --set-env-vars="APP_NAME=Aurelia POS,APP_ENV=production,APP_DEBUG=false,APP_URL=https://${DOMAIN},APP_KEY=${APP_KEY},LOG_CHANNEL=stderr,LOG_LEVEL=warning,DB_CONNECTION=sqlite,DB_DATABASE=/tmp/database.sqlite,SESSION_DRIVER=database,SESSION_SECURE_COOKIE=true,CACHE_STORE=database,QUEUE_CONNECTION=database,BROADCAST_CONNECTION=log,BCRYPT_ROUNDS=10,AUTO_SEED_DEMO=true"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --format='value(status.url)')"

echo "==> [7/7] Configuring Cloud Scheduler keep-warm cron (*/10 * * * * -> ${SERVICE_URL}/up)"
if gcloud scheduler jobs describe "${SCHEDULER_JOB}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "${SCHEDULER_JOB}" \
        --project="${PROJECT_ID}" \
        --location="${REGION}" \
        --schedule="*/10 * * * *" \
        --uri="${SERVICE_URL}/up" \
        --http-method=GET \
        --attempt-deadline=30s \
        --max-retry-attempts=0
else
    gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
        --project="${PROJECT_ID}" \
        --location="${REGION}" \
        --schedule="*/10 * * * *" \
        --uri="${SERVICE_URL}/up" \
        --http-method=GET \
        --attempt-deadline=30s \
        --max-retry-attempts=0
fi

cat <<EOF

====================================================================
Deployment complete!
  Cloud Run URL : ${SERVICE_URL}
  Keep-Warm Job : ${SCHEDULER_JOB} (every 10 min -> ${SERVICE_URL}/up)
  Target Domain : https://${DOMAIN}
====================================================================

Next step — map your custom domain in Cloud Run + Cloudflare DNS:
1. Verify domain ownership (one-time if not already verified in Search Console):
   gcloud domains verify imtiazuddin.tech
2. Map the subdomain in Cloud Run:
   gcloud beta run domain-mappings create \\
     --service=${SERVICE_NAME} \\
     --domain=${DOMAIN} \\
     --region=${REGION} \\
     --project=${PROJECT_ID}
3. In Cloudflare DNS for imtiazuddin.tech, add:
   Type: CNAME | Name: aurelio-pos | Target: ghs.googlehosted.com | Proxy: DNS only (Grey cloud)

EOF
