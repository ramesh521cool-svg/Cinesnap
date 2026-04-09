FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Expose port (Render/Railway inject $PORT automatically)
EXPOSE 8000

# Start server — bind to 0.0.0.0 so it's reachable from outside the container
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
