# docs/aws-console-setup.md — first‑time setup from the AWS console

> ⚠️ **Superseded by [`setup-deploy.md`](./setup-deploy.md).** This build provisions
> everything (S3, CloudFront, DynamoDB, Lambda, HTTP API) with **Terraform** (`infra/`),
> so almost none of the clicking below is needed. Follow `setup-deploy.md` instead; this
> file is kept as the original bundle reference (e.g. for optional Cognito/Location).

Do these **once** to stand up the durable + edge infrastructure. The serverless backend
(DynamoDB table, Lambda, HTTP API) is created by the repo's SAM template via CI/CD, so it is
*not* clicked here — see steps 6–7 for how CI/CD plugs in.

Pick one **region** for everything except the CloudFront certificate (which must be
**us‑east‑1**). Example below uses `ca-central-1` (Canada) with the cert in `us-east-1`.

> Console wording shifts over time. If a label differs, follow the current console text and the
> AWS docs for that service.

---

## 1. Cognito — who can sign in

1. **Cognito → User pools → Create user pool.**
   - Sign‑in: **Email**. Password policy: defaults are fine.
   - App client: create a **public client** (no secret) named `tripboard-web`.
   - Note the **User Pool ID** and **App client ID**.
2. **Create an Identity Pool** (Cognito → Identity pools → Create) so the browser can get
   temporary AWS credentials for Amazon Location.
   - Authenticated identity source: the user pool + app client above.
   - It creates two IAM roles; you'll grant the **authenticated role** Location permissions in
     step 3.
   - Note the **Identity Pool ID**.

## 2. DynamoDB — (created by SAM, listed here for reference)

The table `TripBoard` with `PK`/`SK` + `GSI1` + `GSI2` (on‑demand) is defined in
`template.yaml`. If you prefer to click it for a first look: **DynamoDB → Create table**, name
`TripBoard`, partition key `PK` (String), sort key `SK` (String), then add the two GSIs from
`docs/data-model.md`. Otherwise skip — SAM will create it. (Don't create it both ways.)

## 3. Amazon Location Service — maps + address search

1. **Location → Maps → Create map.** Choose a style (e.g. a standard/streets style). Name it
   `tripboard-map`.
2. **Location → Place indexes → Create place index.** Pick a data provider, name it
   `tripboard-places`. This powers address geocoding when adding a place.
3. Give the **Identity Pool authenticated role** (from step 1) an inline policy allowing:
   - `geo:GetMap*` on the map resource ARN, and
   - `geo:SearchPlaceIndex*` on the place‑index ARN.
   Scope to those exact ARNs.

## 4. S3 — the site bucket

1. **S3 → Create bucket**, name e.g. `tripboard-site-<accountId>` in your region.
2. **Block all public access: ON** (CloudFront reaches it privately via OAC — no public
   bucket).
3. Leave versioning optional. No static‑website hosting needed (CloudFront serves it).

## 5. CloudFront — the edge

1. (For a custom domain) **ACM → Request certificate** in **us‑east‑1** for your domain; add
   the validation CNAME in your DNS.
2. **CloudFront → Create distribution.**
   - **Origin 1 (default):** the S3 bucket. Create an **Origin Access Control (OAC)** and let
     the console update the bucket policy so only this distribution can read it.
   - **Default behavior:** redirect HTTP→HTTPS; cache the SPA assets.
   - **Origin 2:** add the API Gateway invoke domain as a second origin. Add a **behavior** for
     path pattern `/api/*` pointing at it; **forward the `Authorization` header** and disable
     caching for that behavior. (You'll get the API domain after the first CI/CD backend
     deploy — add this origin then.)
   - **Custom error responses:** map **403** and **404** to **`/index.html` with response code
     200** so client‑side routes/deep links work.
   - Attach the ACM cert + alternate domain name if using a custom domain.
3. Note the **Distribution ID** and the **distribution domain** (`dxxxx.cloudfront.net`).
4. Point your DNS (Route 53 or other) at the distribution if using a custom domain.

## 6. IAM — let GitHub deploy (OIDC, no stored keys)

1. **IAM → Identity providers → Add provider → OpenID Connect.**
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. **IAM → Roles → Create role → Web identity**, select that provider/audience.
   - **Trust policy:** restrict to your repo, e.g. allow
     `repo:<owner>/<repo>:ref:refs/heads/main`.
   - **Permissions (least privilege)** for deploys:
     - S3: `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` on the site bucket.
     - CloudFront: `cloudfront:CreateInvalidation`.
     - SAM/CloudFormation backend deploy: the CFN, Lambda, API Gateway, IAM (pass‑role for the
       Lambda exec role), and DynamoDB permissions SAM needs. Start from AWS's managed deploy
       guidance and tighten over time.
   - Note the **Role ARN** — it goes into GitHub as a variable (see `docs/cicd.md`).

## 7. Hand off to CI/CD

Once steps 1–6 exist:

- Put these into **GitHub → repo → Settings → Variables** (not secrets; OIDC needs no keys):
  `AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET`, `CF_DISTRIBUTION_ID`, plus the SAM stack
  name `SAM_STACK` (e.g. `tripboard-api`).
- Also expose the frontend build config (Cognito IDs, Identity Pool ID, map/place names,
  region) to the Vite build as `VITE_*` variables.
- Push to `main`. The workflow in `.github/workflows/deploy.yml` deploys the backend (SAM) and
  the frontend (S3 sync + CloudFront invalidation). After the **first** backend deploy, copy
  the API Gateway domain into the CloudFront `/api/*` origin (step 5.2, Origin 2).

### Order of operations the first time
1. Steps 1, 3, 4, 6 (Cognito, Location, S3, IAM OIDC).
2. First CI/CD run → backend (SAM) creates the table + Lambda + HTTP API.
3. Step 5 CloudFront, adding the API origin from step 2's output.
4. Re‑run CI/CD (or just the frontend job) → SPA live at the CloudFront domain.
