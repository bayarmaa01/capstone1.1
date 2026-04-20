FROM python:3.10

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN python -m pip install --upgrade pip

# Clean old installs
RUN python -m pip uninstall -y face_recognition face_recognition_models || true

# Install models FIRST with explicit clone and install
RUN git clone https://github.com/ageitgey/face_recognition_models.git /tmp/face_recognition_models && \
    cd /tmp/face_recognition_models && \
    python -m pip install --no-cache-dir . && \
    cd /app && \
    rm -rf /tmp/face_recognition_models

# Install main library
RUN python -m pip install --no-cache-dir face_recognition

# Verify installation
RUN python -c "import face_recognition_models; print('MODELS OK'); print('MODELS PATH:', face_recognition_models.__file__)" && \
    python -c "import face_recognition; print('FACE_RECOGNITION OK')"

COPY . .

EXPOSE 5001

CMD ["gunicorn", "-b", "0.0.0.0:5001", "app:app"]