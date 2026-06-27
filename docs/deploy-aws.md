# docs/deploy-aws.md — how TripBoard runs on AWS (this build)

This is the concrete deployment plan for the app **as built** (device-join identity,
single Lambda, no Cognito/Location required to go live). It supersedes the generic
runbook in `aws-console-setup.md` for the parts that differ.

## Decisions (defaults — change if you want)

| Decision | Default | Why / how to change |
|----------|---------|---------------------|
| Region | `ca-central-1` | Trip is Nova Scotia, currency CAD, tz America/Halifax. Set `AWS_REGION` to anything; nothing is region-pinned in code. |
| Domain | CloudFront default `dxxxx.cloudfront.net` | No ACM/Route 53 needed. Add a custom domain later (ACM cert **must** be in `us-east-1`). |
| Auth | Device-join, **API has no JWT authorizer** | Matches the "type your name" flow. The API is reachable by anyone who finds its URL. See **Hardening** below for a low-effort guard, or enable the Cognito authorizer stubbed in `template.yaml`. |
| Map | Off until configured | Set the `VITE_MAP_STYLE` GitHub var to a MapLibre style URL; otherwise the SPA shows an accessible list fallback. |

## What runs on AWS

```
                         ┌──────────────────────────────┐
   user's phone ───────► │          CloudFront           │  (you create, console)
                         │  default behavior → S3        │  default dxxxx.cloudfront.net
                         │  /api/*       → HTTP API       │
                         └─────────┬──────────────┬──────┘
                                   │              │  /api/* (forward Authorization
                      default      │              │   + x-tripboard-* headers, no cache)
                                   ▼              ▼
                        ┌────────────────┐   ┌─────────────────────────┐
                        │ S3 (private)   │   │ API Gateway HTTP API     │  ← SAM
                        │ OAC, SPA files │   │ (no authorizer)          │
                        └────────────────┘   └───────────┬─────────────┘
                              ▲                           ▼
                              │ s3 sync (CI)   ┌─────────────────────────┐
                              │                │ Lambda (Node20, arm64)   │  ← SAM
                                               │ esbuild ESM bundle        │
                                               │ handler.handler           │
                                               └───────────┬─────────────┘
                                                           ▼
                                               ┌─────────────────────────┐
                                               │ DynamoDB "TripBoard"     │  ← SAM
                                               │ PAY_PER_REQUEST, GSI1/2  │
                                               └─────────────────────────┘
```

There is **no CORS in production** — the browser only ever talks to the CloudFront
origin; CloudFront forwards `/api/*` to the HTTP API. The SPA auto-targets `/api` in a
production build (no API URL variable needed).

### Owned by SAM (`template.yaml`, deployed by CI)
- DynamoDB table `TripBoard` (on-demand, `PK/SK` + `GSI1` + `GSI2`).
- Lambda function (Node 20, arm64) + its execution role (least privilege:
  `DynamoDBCrudPolicy` on the table only).
- API Gateway **HTTP API** with routes `GET /api/health` and `ANY /api/{proxy+}`.

### Owned by you (console, one time)
- **S3 site bucket** — Block Public Access ON; CloudFront reads it via OAC.
- **CloudFront distribution** — two origins (S3 + the HTTP API), the `/api/*` behavior,
  and SPA error responses (403 & 404 → `/index.html`, 200).
- **IAM**: the GitHub OIDC provider + deploy role (you're setting this up — policies below).
- *(Optional)* Cognito / Amazon Location only if you later enable sign-in or the live map.

## First-deploy order (resolves the CloudFront ↔ API chicken-and-egg)

The SPA calls `/api`, which only works once CloudFront has the API origin — but the API
domain doesn't exist until the backend is deployed. So:

1. **Console:** create the S3 site bucket + the IAM OIDC provider & deploy role.
2. **Backend first:** run the deploy workflow (or `sam deploy` locally). It creates the
   table, Lambda, and HTTP API and prints **`ApiUrl`** (stack output).
3. **Console:** create the CloudFront distribution:
   - Origin 1 = S3 bucket (OAC; let the console update the bucket policy).
   - Origin 2 = the `ApiUrl` host from step 2.
   - Behavior `/api/*` → Origin 2; **forward `Authorization`, `x-tripboard-user`,
     `x-tripboard-name`**; disable caching (use the `CachingDisabled` managed policy +
     an origin-request policy that forwards those headers).
   - Default behavior → Origin 1; cache normally.
   - Custom error responses: 403 & 404 → `/index.html` (200).
4. **Frontend:** re-run the workflow (or just the `frontend` job) → `s3 sync` + CloudFront
   invalidation. Site is live at the distribution domain.
5. **Seed once:** `TABLE_NAME=TripBoard AWS_REGION=ca-central-1 npm run seed` (needs AWS
   creds locally), or run the equivalent as a one-off job.

After this, every push to `main` redeploys both halves with no manual step.

> Tip: to avoid granting the CI role bucket-creation rights, run `sam deploy --guided`
> **once locally** with admin creds. That bootstraps the SAM managed-artifact bucket and
> the stack; afterwards the scoped CI role below only needs to *update* the stack.

## GitHub repo Variables (Settings → Variables → Actions)

OIDC means **no secrets** — these are plain Variables.

| Variable | Required | Example |
|----------|----------|---------|
| `AWS_REGION` | ✅ | `ca-central-1` |
| `AWS_DEPLOY_ROLE_ARN` | ✅ | `arn:aws:iam::123456789012:role/tripboard-gh-deploy` |
| `SAM_STACK` | ✅ | `tripboard-api` |
| `SITE_BUCKET` | ✅ (frontend) | `tripboard-site-123456789012` |
| `CF_DISTRIBUTION_ID` | ✅ (frontend) | `E1ABCDEF2GHIJK` |
| `VITE_MAP_STYLE` | optional | a MapLibre style URL (enables the live map) |
| `VITE_*` (Cognito/Location) | optional | only if you enable those features |

## IAM — OIDC trust policy (deploy role)

Scope the trust to this repo and the `main` branch so only `main` can deploy. GitHub's
subject is **case-sensitive** — match the repo path exactly as it appears on GitHub.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:mwongkee/Trip-central:ref:refs/heads/main" }
    }
  }]
}
```

## IAM — deploy permissions policy (attach to the deploy role)

Pragmatic least-privilege: scoped by resource where easy, broader where SAM needs it.
Replace `ACCOUNT_ID`, `REGION`, `SAM_STACK`, `SITE_BUCKET`, `CF_DISTRIBUTION_ID`. Tighten
over time.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormation",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack", "cloudformation:UpdateStack",
        "cloudformation:DescribeStacks", "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResource", "cloudformation:DescribeStackResources",
        "cloudformation:ListStackResources", "cloudformation:GetTemplate",
        "cloudformation:GetTemplateSummary", "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet", "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet", "cloudformation:DeleteChangeSet"
      ],
      "Resource": [
        "arn:aws:cloudformation:REGION:ACCOUNT_ID:stack/SAM_STACK/*",
        "arn:aws:cloudformation:REGION:ACCOUNT_ID:stack/aws-sam-cli-managed-default/*"
      ]
    },
    { "Sid": "CfnValidateAny", "Effect": "Allow",
      "Action": ["cloudformation:ValidateTemplate", "cloudformation:GetTemplateSummary"],
      "Resource": "*" },
    {
      "Sid": "SamArtifactBucket", "Effect": "Allow",
      "Action": ["s3:CreateBucket", "s3:GetObject", "s3:PutObject", "s3:ListBucket",
                 "s3:GetBucketLocation", "s3:PutBucketPolicy", "s3:PutBucketTagging",
                 "s3:GetBucketPolicy", "s3:PutEncryptionConfiguration",
                 "s3:PutBucketVersioning", "s3:PutBucketPublicAccessBlock"],
      "Resource": ["arn:aws:s3:::aws-sam-cli-managed-default*",
                   "arn:aws:s3:::aws-sam-cli-managed-default*/*"]
    },
    {
      "Sid": "SiteBucketSync", "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::SITE_BUCKET", "arn:aws:s3:::SITE_BUCKET/*"]
    },
    {
      "Sid": "Lambda", "Effect": "Allow",
      "Action": ["lambda:CreateFunction", "lambda:UpdateFunctionCode",
                 "lambda:UpdateFunctionConfiguration", "lambda:GetFunction",
                 "lambda:GetFunctionConfiguration", "lambda:DeleteFunction",
                 "lambda:ListVersionsByFunction", "lambda:PublishVersion",
                 "lambda:TagResource", "lambda:UntagResource", "lambda:ListTags",
                 "lambda:AddPermission", "lambda:RemovePermission", "lambda:GetPolicy"],
      "Resource": "arn:aws:lambda:REGION:ACCOUNT_ID:function:SAM_STACK-*"
    },
    {
      "Sid": "HttpApi", "Effect": "Allow",
      "Action": ["apigateway:GET", "apigateway:POST", "apigateway:PUT",
                 "apigateway:PATCH", "apigateway:DELETE"],
      "Resource": ["arn:aws:apigateway:REGION::/apis", "arn:aws:apigateway:REGION::/apis/*"]
    },
    {
      "Sid": "DynamoDB", "Effect": "Allow",
      "Action": ["dynamodb:CreateTable", "dynamodb:DescribeTable",
                 "dynamodb:UpdateTable", "dynamodb:DeleteTable",
                 "dynamodb:TagResource", "dynamodb:UntagResource",
                 "dynamodb:ListTagsOfResource",
                 "dynamodb:DescribeContinuousBackups", "dynamodb:UpdateContinuousBackups",
                 "dynamodb:DescribeTimeToLive", "dynamodb:UpdateTimeToLive"],
      "Resource": "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/TripBoard*"
    },
    {
      "Sid": "IamForLambdaExecRole", "Effect": "Allow",
      "Action": ["iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:TagRole",
                 "iam:AttachRolePolicy", "iam:DetachRolePolicy",
                 "iam:PutRolePolicy", "iam:DeleteRolePolicy",
                 "iam:GetRolePolicy", "iam:ListRolePolicies",
                 "iam:ListAttachedRolePolicies"],
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/SAM_STACK-*"
    },
    {
      "Sid": "PassExecRoleToLambda", "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/SAM_STACK-*",
      "Condition": { "StringEquals": { "iam:PassedToService": "lambda.amazonaws.com" } }
    },
    {
      "Sid": "Logs", "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:DescribeLogGroups",
                 "logs:DeleteLogGroup", "logs:PutRetentionPolicy", "logs:TagResource"],
      "Resource": "arn:aws:logs:REGION:ACCOUNT_ID:log-group:/aws/lambda/SAM_STACK-*"
    },
    {
      "Sid": "CloudFrontInvalidate", "Effect": "Allow",
      "Action": ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"],
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/CF_DISTRIBUTION_ID"
    }
  ]
}
```

Notes:
- The execution role SAM creates gets only `DynamoDBCrudPolicy` on the table (plus the
  AWS-managed basic-execution + X-Ray write because `Tracing: Active`).
- If you bootstrap the SAM bucket/stack manually (the tip above), you can drop the
  `s3:CreateBucket` / `aws-sam-cli-managed-default` create rights.

## Hardening the open API (optional, recommended)

The HTTP API has no authorizer, so it's reachable directly. Two low-effort options:

1. **CloudFront secret header** — add a custom origin header (e.g.
   `x-edge-secret: <random>`) on the `/api/*` origin and have the Lambda reject requests
   missing it. This forces all traffic through CloudFront (no direct API hits). Smallest
   change; doesn't identify *which* family member, which is fine since device-join already
   doesn't.
2. **Cognito JWT** — uncomment the authorizer block in `template.yaml`, add the user-pool
   params, and switch the SPA to real sign-in. Strongest, but more setup.

For a private family trip, option 1 is usually enough.

## Verify after deploy

```bash
curl https://<distribution-domain>/api/health        # → {"ok":true}
curl https://<api-id>.execute-api.<region>.amazonaws.com/api/health   # direct API (before hardening)
```

Then open the site, join as a family member, and cast a family vote — it should persist
across reload (data now in DynamoDB, not the local demo store).

## Cost

Single family, one trip: essentially free-tier — DynamoDB on-demand `< $1`, Lambda + HTTP
API `~$0`, S3 + CloudFront `~$0.50–1`. `~$1–5/month` while active, near-zero idle. The
only watch-item is Amazon Location map tiles *if* you enable the live map.
```
