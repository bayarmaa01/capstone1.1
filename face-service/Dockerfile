# Single-stage build for face recognition service
FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and setuptools
RUN pip install --upgrade pip setuptools wheel

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 appuser && \
    useradd -m -u 1001 -g appuser appuser

# Copy requirements and install all dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code with correct permissions
COPY --chown=appuser:appuser app.py app.py

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