# UWMadison Lecture Recorder

Cloud-based lecture recording app with:
- Schedule UI (`weekday + start/end + timezone`)
- API for schedule and recording management
- Cloud Scheduler triggers
- Cloud Run Job execution
- FFmpeg capture/trim pipeline
- Cloud Storage upload + signed playback URLs

No always-on local machine is required.

## Architecture

`Web UI + API (Cloud Run service) -> Cloud Scheduler -> internal trigger endpoint -> Cloud Run Job (worker) -> FFmpeg -> Cloud Storage`

## Features Implemented

- `POST /api/schedules`
- `GET /api/schedules`
- `PATCH /api/schedules/:id`
- `DELETE /api/schedules/:id` (disable)
- `GET /api/recordings`
- `POST /api/schedules/:id/run-now` (manual test trigger)
- `POST /internal/triggers/:scheduleId` (Cloud Scheduler target with token auth)

Data models:
- `Schedule { id, streamPageUrl, directStreamUrl?, timezone, weekdays[], startTime, endTime, enabled, leadSeconds, tailSeconds }`
- `Recording { id, scheduleId, lectureDate, status, startedAt?, endedAt?, storagePath?, durationSec?, error? }`

## Local Development

### 1) Prerequisites

- Node.js 20+
- FFmpeg on PATH (for worker execution tests)

### 2) Install and configure

```bash
cp .env.example .env
# edit .env
npm install
```

Default local mode uses memory datastore:
- `DATASTORE_MODE=memory`
- `DRY_RUN_CLOUD_CALLS=true`

### 3) Run API

```bash
npm run dev
```

Open:
- `http://localhost:8080`
- Health: `http://localhost:8080/health`

### 4) Run worker manually

```bash
npm run dev:worker -- --schedule-id=<id> --lecture-date=2026-03-05 --recording-id=<id__date>
```

## Cloud Deployment (GCP)

Use `scripts/deploy-gcp.sh` (Cloud Build + Cloud Run service + Cloud Run Job).

Required env vars for the script:
- `PROJECT_ID`
- `REGION`
- `API_SERVICE`
- `JOB_NAME`
- `IMAGE`
- `RECORDINGS_BUCKET`
- `TRIGGER_TOKEN`
- `SCHEDULER_SA`

Example:

```bash
PROJECT_ID=my-project \
REGION=us-central1 \
API_SERVICE=lecture-recorder-api \
JOB_NAME=lecture-recorder-worker \
IMAGE=gcr.io/my-project/lecture-recorder:latest \
RECORDINGS_BUCKET=my-lecture-recordings \
TRIGGER_TOKEN=replace-me \
SCHEDULER_SA=scheduler-invoker@my-project.iam.gserviceaccount.com \
./scripts/deploy-gcp.sh
```

After deployment:
- set `API_BASE_URL` to deployed API URL for schedule sync correctness.
- set `DATASTORE_MODE=firestore` in both service and job.
- ensure IAM:
  - Scheduler SA can invoke API endpoint.
  - API service account can run Cloud Run Jobs.
  - Worker service account can write to Cloud Storage.

## Time/Cron Behavior

- Start cron is computed from `startTime - leadSeconds`.
- Example: start `13:10`, lead `60` sec => cron minute `13:09`.
- Capture duration = `window + lead + tail`.
- Trim output to exact lecture window.

## Testing

```bash
npm test
```

Included tests:
- cron + duration math
- idempotent recording key behavior
- FFmpeg command generation
