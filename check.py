import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

print("Checking ALL available models for your API key...\n")

for m in client.models.list():
    # Check the new 'supported_actions' attribute
    actions = getattr(m, 'supported_actions', None)
    
    if actions:
        if "generateContent" in actions:
            print(f"✅ Chat Model: {m.name}")
        elif "embedContent" in actions:
            print(f"🧠 Embedding Model: {m.name}")
    else:
        # Fallback just in case that attribute is missing too
        print(f"❓ Other Model: {m.name}")

print("\nDone!")