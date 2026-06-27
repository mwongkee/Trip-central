# docs/cicd.md — CI/CD with GitHub Actions + OIDC

Deploys are keyless: GitHub Actions assumes an AWS IAM role via OIDC (set up in
`docs/aws-console-setup.md` step 6). No access keys are ever stored.

## Repo variables (Settings → Variables → Actions)

| Variable | Example | Used for |
|----------|---------|----------|
| `AWS_REGION` | `ca-central-1` | all AWS calls |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::123…:role/tripboard-gh-deploy` | role to assume |
| `SAM_STACK` | `tripboard-api` | backend CloudFormation stack name |
| `SITE_BUCKET` | `tripboard-site-123…` | frontend upload target |
| `CF_DISTRIBUTION_ID` | `E1ABCDEF…` | cache invalidation |
| `VITE_COGNITO_USER_POOL_ID` | `ca-central-1_xxxx` | SPA auth |
| `VITE_COGNITO_CLIENT_ID` | `xxxx` | SPA auth |
| `VITE_IDENTITY_POOL_ID` | `ca-central-1:uuid` | SPA → Location creds |
| `VITE_MAP_NAME` | `tripboard-map` | SPA map |
| `VITE_PLACE_INDEX` | `tripboard-places` | SPA address search |

Frontend talks to the API same‑origin at `/api`, so no API URL variable is needed in prod.

## Pipeline shape

Two jobs on push to `main`:

1. **backend** — `sam build` + `sam deploy` (creates/updates DynamoDB table, Lambda, HTTP API,
   JWT authorizer). Outputs the API Gateway domain.
2. **frontend** — `npm ci` + `vite build` (with `VITE_*` envs) → `aws s3 sync` to the site
   bucket → `cloudfront create-invalidation "/*"`.

Run a separate **CI** workflow (lint + typecheck + test) on pull requests; only deploy from
`main`.

> First deploy only: after the backend job creates the HTTP API, add that API domain as the
> CloudFront `/api/*` origin (console step 5.2). Subsequent deploys need no manual step.

## What the provided workflow does

See `.github/workflows/deploy.yml`. It:

- requests an OIDC token (`permissions: id-token: write`),
- assumes `AWS_DEPLOY_ROLE_ARN` with `aws-actions/configure-aws-credentials`,
- builds/deploys the SAM backend, then
- builds and ships the SPA, invalidating CloudFront.

Tighten the deploy role's permissions as the stack stabilizes, and scope the OIDC trust policy
to `ref:refs/heads/main` so only `main` can deploy.
