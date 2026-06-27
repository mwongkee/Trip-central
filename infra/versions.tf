terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # Remote state in S3 with native S3 locking (use_lockfile, TF >= 1.10 — no
  # DynamoDB lock table needed). bucket/key/region are supplied at `init` time
  # via -backend-config (see .github/workflows/deploy.yml and docs/setup-deploy.md).
  backend "s3" {
    key          = "tripboard/terraform.tfstate"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Project   = var.name_prefix
      ManagedBy = "terraform"
    }
  }
}
