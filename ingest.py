
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("API key is not found!")

print("API key loaded, environment variable is loaded.")


from langchain_community.document_loaders import DirectoryLoader
from langchain_community.document_loaders import UnstructuredMarkdownLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from google import genai
import chromadb


# Add the laoding code

print("Loading markdown file form the data folder")

loader = DirectoryLoader(
    path='data',
    glob='**/*.md',
    loader_cls=UnstructuredMarkdownLoader
)

docs = loader.load()

print(f'Successfully loaded {len(docs)} markdown files.')

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)

chunks = text_splitter.split_documents(docs)

print(f'Created {len(chunks)} ready for the database.')

print('Sending chunks to Gemini for embeddings (this takes a few secs)')

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(name='my_knowledge_base')

texts = [chunk.page_content for chunk in chunks]


print("Converting text to vectors...")
response = client.models.embed_content(
    model = "models/gemini-embedding-001",
    contents = texts
)
embeddings = [e.values for e in response.embeddings]

collection.add(
    documents = texts,
    embeddings = embeddings,
    ids = [f'doc{i}' for i in range(len(texts))]
)

print('Your knowledge is saved into chroma_db folder')