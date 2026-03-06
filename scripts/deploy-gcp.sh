#!/usr/bin/env bash
set -euo pipefail

# Required env vars:
# PROJECT_ID, REGION, API_SERVICE, JOB_NAME, IMAGE
# RECORDINGS_BUCKET, TRIGGER_TOKEN, SCHEDULER_SA

: "${PROJECT_ID:?PROJECT_ID is required}"
: "${REGION:?REGION is required}"
: "${API_SERVICE:?API_SERVICE is required}"
: "${JOB_NAME:?JOB_NAME is required}"
: "${IMAGE:?IMAGE is required}"
: "${RECORDINGS_BUCKET:?RECORDINGS_BUCKET is required}"
: "${TRIGGER_TOKEN:?TRIGGER_TOKEN is required}"
: "${SCHEDULER_SA:?SCHEDULER_SA is required}"

gcloud config set project "${PROJECT_ID}"

gcloud builds submit --tag "${IMAGE}"

gcloud run deploy "${API_SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "DATASTORE_MODE=firestore,DRY_RUN_CLOUD_CALLS=false,GCP_PROJECT_ID=${PROJECT_ID},CLOUD_SCHEDULER_LOCATION=${REGION},CLOUD_SCHEDULER_JOB_PREFIX=lecture-recorder,CLOUD_RUN_REGION=${REGION},CLOUD_RUN_JOB_NAME=${JOB_NAME},RECORDINGS_BUCKET=${RECORDINGS_BUCKET},TRIGGER_TOKEN=${TRIGGER_TOKEN},CLOUD_SCHEDULER_SERVICE_ACCOUNT=${SCHEDULER_SA}"

gcloud run jobs deploy "${JOB_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --tasks 1 \
  --max-retries 1 \
  --task-timeout 1h \
  --set-env-vars "DATASTORE_MODE=firestore,DRY_RUN_CLOUD_CALLS=false,GCP_PROJECT_ID=${PROJECT_ID},RECORDINGS_BUCKET=${RECORDINGS_BUCKET}" \
  --command "node" \
  --args "dist/worker.js"

API_URL="$(gcloud run services describe "${API_SERVICE}" --region "${REGION}" --format 'value(status.url)')"
echo "API URL: ${API_URL}"
echo "Set API_BASE_URL=${API_URL} for future deployments."
