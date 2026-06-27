data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Zip the single bundled ESM handler produced by `npm run bundle -w @tripboard/api`.
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = var.lambda_zip_path
  output_path = "${path.module}/build/handler.zip"
}

# Least-privilege execution role: assume-by-Lambda, inline logs + DynamoDB only.
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${var.name_prefix}-api-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_perms" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.lambda.arn}:*"]
  }
  statement {
    sid = "DynamoCrud"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:TransactWriteItems",
      "dynamodb:TransactGetItems",
    ]
    resources = [
      aws_dynamodb_table.this.arn,
      "${aws_dynamodb_table.this.arn}/index/*",
    ]
  }
}

resource "aws_iam_role_policy" "lambda_perms" {
  name   = "${var.name_prefix}-api-perms"
  role   = aws_iam_role.lambda_exec.id
  policy = data.aws_iam_policy_document.lambda_perms.json
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.name_prefix}-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.name_prefix}-api"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  architectures    = ["arm64"]
  handler          = "handler.handler"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.this.name
    }
  }

  depends_on = [aws_iam_role_policy.lambda_perms, aws_cloudwatch_log_group.lambda]
}
