variable "region" {
  type        = string
  description = "AWS region for all resources."
  default     = "us-east-1"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for resource names (also the DynamoDB table name's base)."
  default     = "tripboard"
}

variable "table_name" {
  type        = string
  description = "DynamoDB table name (must match TABLE_NAME used by the Lambda)."
  default     = "TripBoard"
}

variable "lambda_zip_path" {
  type        = string
  description = "Path to the directory holding the bundled handler.mjs."
  default     = "../services/api/lambda-build"
}
