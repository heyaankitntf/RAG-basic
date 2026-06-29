import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

print("Checking your API key permissions...\n")

found_any = False
for m in client.models.list():
    # Only print models that have "embed" in the name
    if "embed" in m.name.lower():
        print(f"✅ {m.name}")
        found_any = True

if not found_any:
    print("❌ No embedding models found. Your API key or region is restricted.")