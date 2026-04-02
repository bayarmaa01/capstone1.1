# Single-stage build for face recognition service
FROM jjanzic/docker-python3-opencv:latest

# Fix deprecated repositories and install build dependencies
RUN sed -i 's|http://deb.debian.org|http://archive.debian.org|g' /etc/apt/sources.list && \
    sed -i 's|http://security.debian.org|http://archive.debian.org|g' /etc/apt/sources.list && \
    apt-get update && apt-get install -y cmake build-essential

# Upgrade pip and setuptools
RUN pip install --upgrade pip setuptools wheel

# Set working directory
WORKDIR /app

# Copy requirements and install all dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user for security
RUN groupadd -g 1001 appuser && \
    useradd -m -u 1001 -g appuser appuser

# Copy application code with correct permissions
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