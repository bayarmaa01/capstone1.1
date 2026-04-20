# Production-ready Python face service
FROM python:3.10-slim

# Install system dependencies for face_recognition
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    libgl1 \
    libglib2.0-0 \
    git \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and setuptools
RUN pip install --upgrade pip setuptools wheel

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -g 1001 appuser && \
    useradd -m -u 1001 -g appuser appuser

# Install Python dependencies in correct order
RUN pip install --no-cache-dir numpy
RUN pip install --no-cache-dir \
    face_recognition \
    git+https://github.com/ageitgey/face_recognition_models

# Copy requirements and install remaining dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code with correct permissions
COPY --chown=appuser:appuser app.py app.py

# Create necessary directories
RUN mkdir -p encodings logs && \
    chown -R appuser:appuser encodings logs

# Switch to non-root user
USER appuser

# Health check with increased start period for initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5001/health', timeout=5)" || exit 1

EXPOSE 5001

# Security: Remove sensitive files and caches (run as root before switching user)
USER root
RUN rm -rf /tmp/* /var/tmp/* /root/.cache || true

# Switch to non-root user
USER appuser

# Use gunicorn for production with proper configuration
CMD ["gunicorn", "-b", "0.0.0.0:5001", "-w", "2", "--timeout", "120", "--max-requests", "1000", "--max-requests-jitter", "50", "--access-logfile", "-", "--error-logfile", "-", "app:app"]