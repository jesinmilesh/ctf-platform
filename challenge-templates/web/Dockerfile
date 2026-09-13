FROM python:3.11-alpine

WORKDIR /app

RUN pip install --no-cache-dir flask gunicorn

COPY app.py .
COPY flag.txt /flag.txt

RUN chmod 444 /flag.txt && \
    adduser -D -u 1000 ctfuser && \
    chown -R root:ctfuser /app && \
    chmod -R 555 /app

USER ctfuser

EXPOSE 80

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --spider http://127.0.0.1:80/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:80", "--workers", "2", "app:app"]
