# Multi-stage build for face recognition service
FROM jjanzic/docker-python3-opencv:latest AS base

# Install Python dependencies
RUN pip install --upgrade pip setuptools wheel gunicorn requests

# Dependencies stage
FROM base AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base AS development
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p encodings logs
EXPOSE 5001
CMD ["python", "app.py"]

# Production stage
FROM base AS production
WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 appuser && \
    useradd -m -u 1001 -g appuser appuser

# Copy dependencies
COPY --from=deps /usr/local/lib/python3.*/site-packages /usr/local/lib/python3.*/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy application code
COPY --chown=appuser:appuser . .

# Create necessary directories
RUN mkdir -p encodings logs && \
    chown -R appuser:appuser encodings logs

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5001/health', timeout=5)" || exit 1

EXPOSE 5001

# Security: Remove sensitive files and caches (run as root before switching user)
USER root
RUN rm -rf /tmp/* /var/tmp/* /root/.cache || true

# Switch to non-root user
USER appuser

# Use gunicorn for production with proper configuration
CMD ["gunicorn", "-b", "0.0.0.0:5001", "-w", "2", "--timeout", "300", "--max-requests", "1000", "--max-requests-jitter", "50", "--access-logfile", "-", "--error-logfile", "-", "app:app"]