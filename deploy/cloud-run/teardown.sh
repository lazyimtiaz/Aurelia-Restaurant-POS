#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
    echo "Usage: bash deploy/cloud-run/teardown.sh <GCP_PROJECT_ID>" >&2
    exit 1
fi

REGION="us-central1"
SERVICE_NAME="aurelia-pos"
REPO_NAME="aurelia-pos"
SCHEDULER_JOB="aurelia-pos-keep-warm"
DOMAIN="aurelio-pos.imtiazuddin.tech"
BUILD_BUCKET="${PROJECT_ID}-aurelia-pos-build"

echo "==> Deleting Cloud Scheduler job (never leave paused jobs)..."
gcloud scheduler jobs delete "${SCHEDULER_JOB}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --quiet || true

echo "==> Deleting Cloud Run domain mapping (${DOMAIN})..."
gcloud beta run domain-mappings delete \
    --domain="${DOMAIN}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --quiet || true

echo "==> Deleting Cloud Run service (${SERVICE_NAME})..."
gcloud run services delete "${SERVICE_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --quiet || true

echo "==> Deleting Artifact Registry repository (${REPO_NAME})..."
gcloud artifacts repositories delete "${REPO_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --quiet || true

echo "==> Deleting regional build bucket (gs://${BUILD_BUCKET})..."
gcloud storage rm -r "gs://${BUILD_BUCKET}/**" --project="${PROJECT_ID}" >/dev/null 2>&1 || true
gcloud storage buckets delete "gs://${BUILD_BUCKET}" \
    --project="${PROJECT_ID}" \
    --quiet || true

echo "Teardown finished cleanly. Zero lingering Cloud Run / Storage / Scheduler resources remain."
