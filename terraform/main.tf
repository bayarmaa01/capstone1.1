terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "attendance_rg" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = var.environment
    Project     = "AI Attendance System"
    ManagedBy   = "Terraform"
  }
}

# Azure App Service Plan
resource "azurerm_service_plan" "attendance_plan" {
  name                = "${var.project_name}-plan"
  location            = azurerm_resource_group.attendance_rg.location
  resource_group_name = azurerm_resource_group.attendance_rg.name
  os_type             = "Linux"
  sku_name            = var.app_service_sku

  tags = {
    Environment = var.environment
    Project     = var.project_name
  }
}

# Azure App Service (Backend)
resource "azurerm_linux_web_app" "attendance_backend" {
  name                = "${var.project_name}-backend"
  location            = azurerm_resource_group.attendance_rg.location
  resource_group_name = azurerm_resource_group.attendance_rg.name
  service_plan_id     = azurerm_service_plan.attendance_plan.id

  site_config {
    always_on = true
    app_command_line = "npm start"
    linux_fx_version = "NODE|18-lts"
  }

  app_settings = {
    "WEBSITES_PORT"                    = "4000"
    "WEBSITE_NODE_DEFAULT_VERSION"     = "18"
    "DATABASE_URL"                     = var.database_url
    "JWT_SECRET"                       = var.jwt_secret
    "FRONTEND_URL"                     = "https://${var.domain_name}"
    "MOODLE_CLIENT_ID"                 = var.moodle_client_id
    "MOODLE_CLIENT_SECRET"             = var.moodle_client_secret
    "MOODLE_URL"                       = var.moodle_url
    "MOODLE_REDIRECT_URI"             = "https://${var.domain_name}/auth/callback"
    "AZURE_STORAGE_CONNECTION_STRING"  = azurerm_storage_account.attendance_storage.primary_connection_string
    "AZURE_STORAGE_CONTAINER"          = azurerm_storage_container.face_images.name
  }

  https_only = true

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Backend"
  }
}

# Azure App Service (Frontend)
resource "azurerm_linux_web_app" "attendance_frontend" {
  name                = "${var.project_name}-frontend"
  location            = azurerm_resource_group.attendance_rg.location
  resource_group_name = azurerm_resource_group.attendance_rg.name
  service_plan_id     = azurerm_service_plan.attendance_plan.id

  site_config {
    always_on = true
    linux_fx_version = "STATIC|1.0"
  }

  app_settings = {
    "REACT_APP_API_URL" = "https://${var.project_name}-backend.azurewebsites.net/api"
  }

  https_only = true

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Frontend"
  }
}

# PostgreSQL Database
resource "azurerm_postgresql_flexible_server" "attendance_db" {
  name                   = "${var.project_name}-db"
  location               = azurerm_resource_group.attendance_rg.location
  resource_group_name    = azurerm_resource_group.attendance_rg.name
  version                = "14"
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  storage_mb             = var.db_storage_mb
  sku_name               = var.db_sku

  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  create_mode                  = "Default"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Database"
  }
}

# PostgreSQL Database
resource "azurerm_postgresql_flexible_server_database" "attendance_db" {
  name                = var.db_name
  server_name         = azurerm_postgresql_flexible_server.attendance_db.name
  resource_group_name = azurerm_resource_group.attendance_rg.name
  charset             = "UTF8"
  collation           = "en_US.utf8"
}

# Storage Account for face images
resource "azurerm_storage_account" "attendance_storage" {
  name                     = "${var.project_name}storage"
  location                 = azurerm_resource_group.attendance_rg.location
  resource_group_name      = azurerm_resource_group.attendance_rg.name
  account_tier             = "Standard"
  account_replication_type = "LRS"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Storage"
  }
}

# Storage container for face images
resource "azurerm_storage_container" "face_images" {
  name                  = "face-images"
  storage_account_name  = azurerm_storage_account.attendance_storage.name
  container_access_type = "private"
}

# Key Vault for secrets
resource "azurerm_key_vault" "attendance_kv" {
  name                       = "${var.project_name}-kv"
  location                   = azurerm_resource_group.attendance_rg.location
  resource_group_name        = azurerm_resource_group.attendance_rg.name
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7

  access_policy {
    tenant_id = var.tenant_id
    object_id = var.object_id

    secret_permissions = [
      "Get",
      "List",
      "Set",
      "Delete",
    ]
  }

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "KeyVault"
  }
}

# Store secrets in Key Vault
resource "azurerm_key_vault_secret" "db_url" {
  name         = "DATABASE-URL"
  value        = var.database_url
  key_vault_id = azurerm_key_vault.attendance_kv.id
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "JWT-SECRET"
  value        = var.jwt_secret
  key_vault_id = azurerm_key_vault.attendance_kv.id
}

resource "azurerm_key_vault_secret" "moodle_client_secret" {
  name         = "MOODLE-CLIENT-SECRET"
  value        = var.moodle_client_secret
  key_vault_id = azurerm_key_vault.attendance_kv.id
}

# Custom Domain and SSL Certificate
resource "azurerm_app_service_custom_hostname_binding" "frontend_domain" {
  hostname            = var.domain_name
  app_service_name    = azurerm_linux_web_app.attendance_frontend.name
  resource_group_name = azurerm_resource_group.attendance_rg.name

  depends_on = [
    azurerm_linux_web_app.attendance_frontend
  ]
}

# Application Insights for monitoring
resource "azurerm_application_insights" "attendance_ai" {
  name                = "${var.project_name}-ai"
  location            = azurerm_resource_group.attendance_rg.location
  resource_group_name = azurerm_resource_group.attendance_rg.name
  application_type    = "web"

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Monitoring"
  }
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "attendance_logs" {
  name                = "${var.project_name}-logs"
  location            = azurerm_resource_group.attendance_rg.location
  resource_group_name = azurerm_resource_group.attendance_rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Component   = "Logging"
  }
}
