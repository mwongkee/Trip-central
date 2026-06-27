# Shared secret that CloudFront injects on every /api/* origin request and the
# Lambda verifies (see services/api/src/edge.ts). Forces all API traffic through
# CloudFront — direct API Gateway hits lack the header and get 403. Stored only
# in Terraform state (private S3) and the two places below; never output.
resource "random_password" "edge_secret" {
  length  = 40
  special = false # keep it HTTP-header-safe (alphanumeric)
}
