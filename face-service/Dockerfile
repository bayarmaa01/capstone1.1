# Use official face_recognition base image (has dlib pre-installed)
FROM jjanzic/docker-python3-opencv:latest AS base

WORKDIR /app

# Install Python dependencies
RUN pip install --upgrade pip


# Development stage
FROM base AS development

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create encodings directory
RUN mkdir -p encodings

EXPOSE 5001

# Run with Flask development server
CMD ["python", "app.py"]


# Production stage
FROM base AS production

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application code
COPY . .

# Create encodings directory
RUN mkdir -p encodings

EXPOSE 5001

# Use gunicorn for production
CMD ["gunicorn", "-b", "0.0.0.0:5001", "-w", "2", "--timeout", "120", "app:app"]