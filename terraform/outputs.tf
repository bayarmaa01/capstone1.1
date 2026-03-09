output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.attendance_rg.name
}

output "backend_url" {
  description = "URL of the backend App Service"
  value       = "https://${azurerm_linux_web_app.attendance_backend.name}.azurewebsites.net"
}

output "frontend_url" {
  description = "URL of the frontend App Service"
  value       = "https://${azurerm_linux_web_app.attendance_frontend.name}.azurewebsites.net"
}

output "custom_domain_url" {
  description = "Custom domain URL"
  value       = "https://${var.domain_name}"
}

output "database_host" {
  description = "PostgreSQL database host"
  value       = azurerm_postgresql_flexible_server.attendance_db.fqdn
}

output "database_name" {
  description = "PostgreSQL database name"
  value       = azurerm_postgresql_flexible_server_database.attendance_db.name
}

output "storage_account_name" {
  description = "Storage account name"
  value       = azurerm_storage_account.attendance_storage.name
}

output "storage_container_name" {
  description = "Storage container name for face images"
  value       = azurerm_storage_container.face_images.name
}

output "key_vault_name" {
  description = "Key Vault name"
  value       = azurerm_key_vault.attendance_kv.name
}

output "application_insights_key" {
  description = "Application Insights instrumentation key"
  value       = azurerm_application_insights.attendance_ai.instrumentation_key
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID"
  value       = azurerm_log_analytics_workspace.attendance_logs.workspace_id
}
