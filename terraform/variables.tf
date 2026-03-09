variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "attendance-ml"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "attendance-ml-rg"
}

variable "domain_name" {
  description = "Custom domain name"
  type        = string
  default     = "attendance-ml.duckdns.org"
}

variable "app_service_sku" {
  description = "App Service SKU"
  type        = string
  default     = "B1"
}

variable "db_admin_username" {
  description = "Database admin username"
  type        = string
  default     = "attendanceadmin"
}

variable "db_admin_password" {
  description = "Database admin password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "attendance"
}

variable "db_storage_mb" {
  description = "Database storage in MB"
  type        = number
  default     = 32768
}

variable "db_sku" {
  description = "Database SKU"
  type        = string
  default     = "B_Standard_B2ms"
}

variable "tenant_id" {
  description = "Azure AD tenant ID"
  type        = string
}

variable "object_id" {
  description = "Azure AD object ID"
  type        = string
}

variable "database_url" {
  description = "Database connection URL"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "moodle_client_id" {
  description = "Moodle OAuth client ID"
  type        = string
  sensitive   = true
}

variable "moodle_client_secret" {
  description = "Moodle OAuth client secret"
  type        = string
  sensitive   = true
}

variable "moodle_url" {
  description = "Moodle instance URL"
  type        = string
  default     = "https://your-moodle-instance.com"
}
