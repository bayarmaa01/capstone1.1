# Grafana Dashboard Provisioning Guide

## Overview
This directory contains the complete Grafana provisioning setup for the AI Attendance System monitoring dashboard.

## Folder Structure
```
grafana/
|-- provisioning/
|   |-- datasources/
|   |   `-- datasource.yml          # Prometheus datasource configuration
|   `-- dashboards/
|       `-- dashboard.yml           # Dashboard provisioning configuration
`-- dashboards/
    `-- attendance-dashboard.json   # Complete monitoring dashboard
```

## Dashboard Panels
The attendance dashboard includes 10 key monitoring panels:

1. **API Request Rate** - HTTP requests per second by method and status
2. **API Response Time** - 50th and 95th percentile latency
3. **HTTP Error Rate** - 4xx and 5xx error rates
4. **Face Recognition Success Rate** - Face service accuracy percentage
5. **Attendance Submissions Count** - Attendance records per minute
6. **Container CPU Usage** - CPU utilization for backend, frontend, face services
7. **Container Memory Usage** - Memory consumption by service
8. **Redis Health** - Connected clients and memory usage
9. **PostgreSQL Connections & Activity** - Database connections and transactions
10. **Service Uptime Status** - Service availability status

## Deployment
The dashboard is automatically provisioned when Grafana starts via Docker Compose mounts.

## Extending Dashboards

### Adding New Panels
1. Edit `attendance-dashboard.json`
2. Add new panel objects to the `panels` array
3. Use appropriate PromQL queries for your metrics

### Adding New Dashboards
1. Create new JSON file in `grafana/dashboards/`
2. Update `grafana/provisioning/dashboards/dashboard.yml` if needed
3. Restart Grafana container

## Recommended Alerts

### High Latency Alert
```yaml
- alert: HighAPILatency
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="backend"}[5m])) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High API latency detected"
    description: "95th percentile latency is {{ $value }}s"
```

### High Error Rate Alert
```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{job="backend",status=~"5.."}[1m]) / rate(http_requests_total{job="backend"}[1m]) > 0.05
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value | humanizePercentage }}"
```

### Service Down Alert
```yaml
- alert: ServiceDown
  expr: up{job=~"backend|frontend|face-service"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Service {{ $labels.job }} is down"
    description: "Service {{ $labels.job }} has been down for more than 1 minute"
```

### Face Recognition Low Accuracy Alert
```yaml
- alert: LowFaceRecognitionAccuracy
  expr: rate(face_recognition_success_total[1m]) / (rate(face_recognition_success_total[1m]) + rate(face_recognition_failure_total[1m])) * 100 < 80
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Face recognition accuracy is low"
    description: "Success rate is {{ $value }}%"
```

## Access
- Grafana URL: http://localhost:3000
- Default credentials: admin/admin
- Dashboard available in "AI Attendance System" folder

## Troubleshooting
1. Check Grafana logs: `docker logs grafana`
2. Verify datasource connection in Grafana UI
3. Ensure Prometheus is running and accessible
4. Check Prometheus targets: http://localhost:9090/targets
