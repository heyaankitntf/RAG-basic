"""
Quick smoke test for the RAG retrieval + Groq dual-key pipeline.

Run with:
    python test_retrieval.py

Requires:
    GOOGLE_API_KEY   — for Gemini embeddings (question vectorization)
    GROQ_API_KEY_1   — primary Groq key (required)
    GROQ_API_KEY_2   — failover Groq key (optional but recommended)
"""

import os
from dotenv import load_dotenv
from google import genai
from groq import Groq
import chromadb

load_dotenv()


# ── Build ordered Groq client list (same failover logic as app.py) ──
_groq_clients = []
_key_1 = os.getenv("GROQ_API_KEY_1")
_key_2 = os.getenv("GROQ_API_KEY_2")
if _key_1:
    _groq_clients.append(("GROQ_API_KEY_1", Groq(api_key=_key_1)))
if _key_2:
    _groq_clients.append(("GROQ_API_KEY_2", Groq(api_key=_key_2)))

if not _groq_clients:
    raise RuntimeError(
        "No Groq API keys found. Set GROQ_API_KEY_1 and/or GROQ_API_KEY_2 in .env"
    )

print(f"Groq clients configured: {len(_groq_clients)}")
for label, _ in _groq_clients:
    print(f"  - {label}")


google_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_collection(name='my_knowledge_base')

user_question = "what is eeg?"


# Embed the question via Gemini
question_vector = google_client.models.embed_content(
    model="models/gemini-embedding-001",
    contents=user_question,
)
question_embeddings = [question_vector.embeddings[0].values]

print(f'\nSearching database for: "{user_question}"...')

retrieved_context = collection.query(
    query_embeddings=question_embeddings,
    n_results=1
)

print("---- FOUND THIS CHUNK ----")
print(retrieved_context['documents'][0][0])
print('---- Retrieved context from DB ----')


system_prompt = """
1. You are a helpful RAG assistant.
2. Give polite answers to query and stay grounded facts in the context.
3. Make no mistakes.
4. Be professional and don't make up anything that is not present in the context.
"""

final_prompt = f"""
{system_prompt}

CONTEXT:
{retrieved_context}

QUERY:
{user_question}
"""


def generate_answer(prompt: str) -> str:
    """
    Try each Groq key in order. On 429 / rate-limit, fall over to the next key.
    Other errors propagate immediately.
    """
    last_error = None
    for key_label, client in _groq_clients:
        try:
            print(f"\n[尝试 {key_label}] Generating answer...")
            return client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
            ).choices[0].message.content
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            if "429" in err_str or "rate_limit" in err_str or "rate limit" in err_str:
                print(f"  {key_label} rate-limited, trying next key...")
                continue
            raise
    if last_error:
        raise last_error


print("\n--- FINAL AI ANSWER ---")
final_answer = generate_answer(final_prompt)
print(final_answer)
