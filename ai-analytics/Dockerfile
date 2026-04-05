# AI Analytics Service Dockerfile
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user
RUN groupadd -g 1001 analytics && \
    useradd -m -u 1001 -g analytics analytics

# Copy application code
COPY --chown=analytics:analytics . .

# Switch to non-root user
USER analytics

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5002/analytics/health', timeout=5)" || exit 1

EXPOSE 5002

# Security: Remove sensitive files
USER root
RUN rm -rf /tmp/* /var/tmp/* || true

# Switch to non-root user
USER analytics

# Use gunicorn for production
CMD ["gunicorn", "-b", "0.0.0.0:5002", "-w", "2", "--timeout", "300", "--max-requests", "1000", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
