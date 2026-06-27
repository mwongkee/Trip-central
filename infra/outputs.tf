output "cloudfront_domain" {
  description = "Public site URL (https://...)."
  value       = "https://${aws_cloudfront_distribution.this.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "Used by CI to invalidate the cache after a frontend deploy."
  value       = aws_cloudfront_distribution.this.id
}

output "site_bucket" {
  description = "S3 bucket the SPA is synced to."
  value       = aws_s3_bucket.site.id
}

output "api_url" {
  description = "Direct HTTP API base URL (CloudFront fronts this at /api/*)."
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "table_name" {
  value = aws_dynamodb_table.this.name
}
