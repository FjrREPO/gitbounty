#!/usr/bin/env bash
# Builds the enclave image and runs it on a Google Confidential Space VM
# (Intel TDX). Run from the monorepo root.
#
#   PROJECT_ID=my-project ./packages/plugin-tee/deploy-confidential-space.sh
#
# Secrets are passed as launcher env overrides, so they live only in enclave
# memory — they are never baked into the image.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-${REGION}-a}"
REPO="${REPO:-gitbounty}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/tee-verifier:latest"
VM_NAME="${VM_NAME:-gitbounty-tee-verifier}"
SA_NAME="${SA_NAME:-gitbounty-tee}"
SERVICE_ACCOUNT="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

: "${GITHUB_TOKEN:?set GITHUB_TOKEN}"
: "${ESCROW_ADDRESS:?set ESCROW_ADDRESS}"
# TEE_SIGNING_KEY is deliberately optional: leaving it unset makes the enclave
# mint its own key, so not even the operator running this script can sign
# payouts. Point the escrow's teeSigner at the address /healthz reports.
CHAIN_ID="${CHAIN_ID:-114}"

echo "==> Enabling APIs"
gcloud services enable \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  confidentialcomputing.googleapis.com \
  --project "${PROJECT_ID}"

echo "==> Ensuring Artifact Registry repository"
gcloud artifacts repositories describe "${REPO}" \
  --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker --location "${REGION}" --project "${PROJECT_ID}"

echo "==> Ensuring workload service account"
gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "${SA_NAME}" \
    --display-name "GitBounty TEE verifier" --project "${PROJECT_ID}"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${SERVICE_ACCOUNT}" \
  --role roles/confidentialcomputing.workloadUser --condition=None >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${SERVICE_ACCOUNT}" \
  --role roles/logging.logWriter --condition=None >/dev/null

# The launcher pulls the workload image as this service account.
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${SERVICE_ACCOUNT}" \
  --role roles/artifactregistry.reader --condition=None >/dev/null

echo "==> Building and pushing ${IMAGE}"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
docker build --platform linux/amd64 -f packages/plugin-tee/Dockerfile -t "${IMAGE}" .
docker push "${IMAGE}"

echo "==> Launching Confidential Space VM"
gcloud compute instances create "${VM_NAME}" \
  --project "${PROJECT_ID}" \
  --zone "${ZONE}" \
  --machine-type c3-standard-4 \
  --confidential-compute-type TDX \
  --shielded-secure-boot \
  --maintenance-policy TERMINATE \
  --image-family "${CS_IMAGE_FAMILY:-confidential-space}" \
  --image-project confidential-space-images \
  --service-account "${SERVICE_ACCOUNT}" \
  --scopes cloud-platform \
  --tags gitbounty-tee \
  --metadata "^~^tee-image-reference=${IMAGE}~tee-container-log-redirect=true~tee-env-GITHUB_TOKEN=${GITHUB_TOKEN}${TEE_SIGNING_KEY:+~tee-env-TEE_SIGNING_KEY=${TEE_SIGNING_KEY}}~tee-env-ESCROW_ADDRESS=${ESCROW_ADDRESS}~tee-env-CHAIN_ID=${CHAIN_ID}"

echo "==> Allowing inbound verifier traffic"
gcloud compute firewall-rules describe gitbounty-tee-8080 --project "${PROJECT_ID}" >/dev/null 2>&1 ||
  gcloud compute firewall-rules create gitbounty-tee-8080 \
    --project "${PROJECT_ID}" --allow tcp:8080 --target-tags gitbounty-tee \
    --description "GitBounty enclave verifier" >/dev/null

echo
echo "Deployed. Read the enclave's signer address and set it on the escrow:"
echo "  curl http://<EXTERNAL_IP>:8080/healthz"
echo "  cast send \$ESCROW_ADDRESS 'setTeeSigner(address)' <signer>"
echo
echo "Check the workload log:"
echo "  gcloud compute instances get-serial-port-output ${VM_NAME} --zone ${ZONE} --project ${PROJECT_ID} | grep tee-verifier"
