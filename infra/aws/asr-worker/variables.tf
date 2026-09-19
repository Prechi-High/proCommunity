variable "aws_region" {
  type        = string
  description = "Closest practical region for West Africa users with full Fargate + Budgets coverage."
  default     = "eu-west-1"
}

variable "image_tag" {
  type        = string
  description = "Immutable image tag, for example git SHA. Do not use latest in production."
}

variable "whisper_model_size" {
  type    = string
  default = "tiny"
}

variable "desired_count" {
  type        = number
  description = "Keep 0 unless you want a 24/7 poller. Scheduled RunTask is the low-cost default."
  default     = 0
}

variable "enable_schedule" {
  type        = bool
  description = "EventBridge starts a Fargate task on a schedule. Disable until you approve spend."
  default     = false
}

variable "schedule_expression" {
  type    = string
  default = "rate(15 minutes)"
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "Public subnets so the task can use a public IP and skip a NAT Gateway (~$32/month)."
}

variable "supabase_secret_arn" {
  type = string
}

variable "upstash_secret_arn" {
  type = string
}

variable "llm_secret_arn" {
  type = string
}

variable "budget_amount" {
  type    = string
  default = "10"
}

variable "budget_emails" {
  type = list(string)
}
