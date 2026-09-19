terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  name = "sourced-asr-worker"
}

resource "aws_ecr_repository" "asr" {
  name                 = local.name
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_cloudwatch_log_group" "asr" {
  name              = "/ecs/${local.name}"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "asr" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_iam_role" "execution" {
  name = "${local.name}-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "${local.name}-secrets"
  role = aws_iam_role.execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        var.supabase_secret_arn,
        var.upstash_secret_arn,
        var.llm_secret_arn,
      ]
    }]
  })
}

resource "aws_iam_role" "task" {
  name = "${local.name}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "task_logs" {
  name = "${local.name}-logs"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.asr.arn}:*"
    }]
  })
}

resource "aws_ecs_task_definition" "asr" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${aws_ecr_repository.asr.repository_url}:${var.image_tag}"
    essential = true
    command   = ["python", "worker.py"]
    environment = [
      { name = "ASR_REDIS_ENV", value = "production" },
      { name = "WHISPER_MODEL_SIZE", value = var.whisper_model_size },
      { name = "WHISPER_DEVICE", value = "cpu" },
      { name = "WHISPER_COMPUTE_TYPE", value = "int8" },
      { name = "ASR_POLL_SECONDS", value = "5" },
      { name = "ASR_EXIT_WHEN_IDLE", value = "true" },
      { name = "AWS_REGION", value = var.aws_region },
    ]
    secrets = [
      { name = "SUPABASE_URL", valueFrom = "${var.supabase_secret_arn}:SUPABASE_URL::" },
      { name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = "${var.supabase_secret_arn}:SUPABASE_SERVICE_ROLE_KEY::" },
      { name = "UPSTASH_REDIS_REST_URL", valueFrom = "${var.upstash_secret_arn}:UPSTASH_REDIS_REST_URL::" },
      { name = "UPSTASH_REDIS_REST_TOKEN", valueFrom = "${var.upstash_secret_arn}:UPSTASH_REDIS_REST_TOKEN::" },
      { name = "GEMINI_API_KEY", valueFrom = "${var.llm_secret_arn}:GEMINI_API_KEY::" },
      { name = "OPENROUTER_API_KEY", valueFrom = "${var.llm_secret_arn}:OPENROUTER_API_KEY::" },
      { name = "NVIDIA_API_KEY", valueFrom = "${var.llm_secret_arn}:NVIDIA_API_KEY::" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.asr.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "asr" {
  name            = local.name
  cluster         = aws_ecs_cluster.asr.id
  task_definition = aws_ecs_task_definition.asr.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.asr.id]
    assign_public_ip = true
  }
}

resource "aws_security_group" "asr" {
  name        = "${local.name}-egress"
  description = "ASR worker egress only"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "events" {
  name = "${local.name}-events"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "events_run_task" {
  name = "${local.name}-run-task"
  role = aws_iam_role.events.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecs:RunTask"]
        Resource = aws_ecs_task_definition.asr.arn
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.execution.arn, aws_iam_role.task.arn]
      }
    ]
  })
}

resource "aws_cloudwatch_event_rule" "poll" {
  name                = "${local.name}-poll"
  schedule_expression = var.schedule_expression
  state               = var.enable_schedule ? "ENABLED" : "DISABLED"
}

resource "aws_cloudwatch_event_target" "poll" {
  rule     = aws_cloudwatch_event_rule.poll.name
  arn      = aws_ecs_cluster.asr.arn
  role_arn = aws_iam_role.events.arn

  ecs_target {
    task_definition_arn = aws_ecs_task_definition.asr.arn
    launch_type         = "FARGATE"
    platform_version    = "LATEST"
    network_configuration {
      subnets          = var.subnet_ids
      security_groups  = [aws_security_group.asr.id]
      assign_public_ip = true
    }
  }
}

resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = var.budget_amount
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_emails
  }
}
