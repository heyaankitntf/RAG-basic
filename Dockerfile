# 1. The Base Image (Layer 1)
FROM python:3.10-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy the requirements file FIRST (For fast caching - Concept 7!)
COPY requirements.txt .

# 4. Install Python dependencies (Layer 2)
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy the rest of your code (Layer 3)
COPY . .

# 6. Create a directory for ChromaDB data inside the container
RUN mkdir -p /app/chroma_db

# 7. Expose the port Streamlit runs on
EXPOSE 8501

# 8. The correct command to start a Streamlit app
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]