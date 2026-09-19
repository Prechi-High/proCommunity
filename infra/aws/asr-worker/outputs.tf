output "ecr_repository_url" {
  value = aws_ecr_repository.asr.repository_url
}

output "cluster_name" {
  value = aws_ecs_cluster.asr.name
}

output "task_definition_arn" {
  value = aws_ecs_task_definition.asr.arn
}

output "log_group" {
  value = aws_cloudwatch_log_group.asr.name
}

output "service_desired_count" {
  value = aws_ecs_service.asr.desired_count
}
