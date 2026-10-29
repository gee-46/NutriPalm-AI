# NutriPalm AI backend. Includes the OCR system binaries (Tesseract + Poppler) the soil-report
# pipeline needs; without them scanned PDFs / images cannot be read (see /health/ready).
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Run unprivileged. Configuration comes from the environment (never bake secrets into the image).
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin nutripalm
USER nutripalm

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

# Two workers: OCR is CPU-bound, and each worker also bounds its own concurrent OCR jobs (OCR_MAX_CONCURRENT).
# Put TLS termination, edge/IP rate limiting and request-size limits in the reverse proxy in front of this.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
