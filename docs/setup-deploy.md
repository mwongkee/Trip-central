# docs/setup-deploy.md — one-time AWS setup so CI can deploy everything

GitHub Actions runs **Terraform** (`infra/`) to create all AWS resources — DynamoDB,
Lambda, HTTP API, S3, and CloudFront — and then ships the SPA. Terraform wires
CloudFront's `/api/*` behavior straight to the API Gateway, so there's **no manual
console step** and no chicken-and-egg.

You do five one-time things below. After that, every push to `main` deploys itself.

Placeholders to replace as you go: `ACCOUNT_ID`, `REGION` (e.g. `ca-central-1`),
`STATE_BUCKET` (globally-unique, e.g. `tripboard-tfstate-ACCOUNT_ID`).

---

## 1. Create the Terraform state bucket

Terraform stores its state here (with native S3 locking — no DynamoDB lock table needed).

```bash
aws s3api create-bucket --bucket STATE_BUCKET --region REGION \
  --create-bucket-configuration LocationConstraint=REGION
aws s3api put-bucket-versioning --bucket STATE_BUCKET \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket STATE_BUCKET \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

> `us-east-1` only: omit the `--create-bucket-configuration` flag (it rejects it).

## 2. Create the GitHub OIDC provider (you said you'd do this)

If it doesn't already exist in the account:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

## 3. Create the deploy role with this trust policy

Create a role named **`tripboard-gh-deploy`** (Console: IAM → Roles → Create role → Web
identity → that provider, or via CLI). Use this **trust policy** — it limits the role to
this repo's `main` branch. GitHub's subject is **case-sensitive**, so match the repo path
exactly as it appears on GitHub.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:mwongkee/Trip-central:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

## 4. Attach this permissions policy to the role

Copy-paste as an inline policy on `tripboard-gh-deploy`. It's scoped to this project's
resources/services. Replace `ACCOUNT_ID` and `STATE_BUCKET`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TerraformStateBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": "arn:aws:s3:::STATE_BUCKET"
    },
    {
      "Sid": "TerraformStateObjects",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::STATE_BUCKET/*"
    },
    {
      "Sid": "SiteBucket",
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::tripboard-site-*",
        "arn:aws:s3:::tripboard-site-*/*"
      ]
    },
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": "dynamodb:*",
      "Resource": [
        "arn:aws:dynamodb:*:ACCOUNT_ID:table/TripBoard",
        "arn:aws:dynamodb:*:ACCOUNT_ID:table/TripBoard/index/*"
      ]
    },
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": "lambda:*",
      "Resource": "arn:aws:lambda:*:ACCOUNT_ID:function:tripboard-*"
    },
    {
      "Sid": "HttpApi",
      "Effect": "Allow",
      "Action": "apigateway:*",
      "Resource": [
        "arn:aws:apigateway:*::/apis",
        "arn:aws:apigateway:*::/apis/*",
        "arn:aws:apigateway:*::/tags/*"
      ]
    },
    {
      "Sid": "CloudFront",
      "Effect": "Allow",
      "Action": "cloudfront:*",
      "Resource": "*"
    },
    {
      "Sid": "Logs",
      "Effect": "Allow",
      "Action": "logs:*",
      "Resource": [
        "arn:aws:logs:*:ACCOUNT_ID:log-group:/aws/lambda/tripboard-*",
        "arn:aws:logs:*:ACCOUNT_ID:log-group:/aws/lambda/tripboard-*:*"
      ]
    },
    {
      "Sid": "LogsDescribe",
      "Effect": "Allow",
      "Action": "logs:DescribeLogGroups",
      "Resource": "*"
    },
    {
      "Sid": "IamProjectRoles",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:TagRole", "iam:UntagRole",
        "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy", "iam:ListRolePolicies",
        "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:ListAttachedRolePolicies"
      ],
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/tripboard-*"
    },
    {
      "Sid": "IamPassRoleToLambda",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/tripboard-*",
      "Condition": { "StringEquals": { "iam:PassedToService": "lambda.amazonaws.com" } }
    }
  ]
}
```

> Prefer an **IAM user** with access keys instead of OIDC? Attach the same permissions
> policy to the user, skip the trust policy, and put the keys in GitHub **Secrets**
> (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) then swap the `configure-aws-credentials`
> step to use them. OIDC (the role path above) is recommended — no long-lived keys.

## 5. Set GitHub repo Variables

Repo → Settings → Secrets and variables → Actions → **Variables** (not Secrets):

| Variable | Value |
|----------|-------|
| `AWS_REGION` | `REGION` (e.g. `ca-central-1`) |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::ACCOUNT_ID:role/tripboard-gh-deploy` |
| `TF_STATE_BUCKET` | `STATE_BUCKET` |
| `VITE_MAP_STYLE` | *(optional)* a MapLibre style URL to enable the live map |

---

## Deploy

1. Merge this branch to `main` (or Actions → **deploy** → Run workflow on `main`).
   The `deploy` job runs Terraform (creating everything) then builds + syncs the SPA and
   invalidates CloudFront. The site URL is printed in the run summary.
2. Run **Actions → seed → Run workflow** once to load the demo trip + families.
3. Open the CloudFront URL, join as a family member, and cast a family vote.

### Verify

```bash
curl https://<cloudfront-domain>/api/health     # → {"ok":true}
```

## Notes

- **Region**: default `ca-central-1`; set `AWS_REGION` to anything (nothing is
  region-pinned in code). `infra/variables.tf` holds other defaults.
- **API access**: the HTTP API has no JWT authorizer (device-join model), but it is **not
  open** — Terraform generates a secret that CloudFront injects as the `x-edge-secret`
  origin header, and the Lambda rejects requests that lack it. So the API only accepts
  traffic coming through CloudFront; direct API Gateway calls get `403`. The secret lives
  only in Terraform state and the function/CloudFront config (never output). See
  `DECISIONS.md`. (To go further, add a Cognito JWT authorizer in `infra/apigw.tf`.)
  Note: this means you can't hit the raw API URL directly for `curl` checks — use the
  CloudFront domain (which injects the header for you).
- **Teardown**: `cd infra && terraform destroy` (with the same backend config) removes
  everything. Empty the site bucket first if Terraform complains.
- **Cost**: ~$1–5/month while actively used, near-zero idle.
```
