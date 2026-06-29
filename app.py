"""
Sattva RAG — a Streamlit chat app with:
  • Dual Groq API keys (GROQ_API_KEY_1, GROQ_API_KEY_2) with automatic failover
  • Redis-backed semantic cache (fast cache-hit responses)
  • ChromaDB vector store (RAG retrieval from ingested .md files)
  • Source badge on every assistant reply: ⚡ From Cache  |  🗄️ From Database
  • Warm yoga-studio UI: sand, sage green, terracotta, humanist serif typography
"""

import hashlib
import os
import shutil
from pathlib import Path

import streamlit as st
from dotenv import load_dotenv

load_dotenv()


# ═══════════════════════════════════════════════════════════════════════════════
#  REDIS — semantic cache backend
# ═══════════════════════════════════════════════════════════════════════════════
import numpy as np
import redis

try:
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    redis_client.ping()
    REDIS_AVAILABLE = True
except Exception:
    REDIS_AVAILABLE = False

CACHE_INDEX_NAME = "rag_cache"
CACHE_PREFIX = "qa_cache:"
SIMILARITY_THRESHOLD = 0.95


# ═══════════════════════════════════════════════════════════════════════════════
#  GROQ — dual-key client with failover
# ═══════════════════════════════════════════════════════════════════════════════
from groq import Groq

GROQ_API_KEY_1 = os.getenv("GROQ_API_KEY_1")
GROQ_API_KEY_2 = os.getenv("GROQ_API_KEY_2")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

# Build ordered list of (label, client) pairs. Key 1 is tried first; on 429 we
# transparently fall over to key 2. Both are optional, but at least one is required
# for chat to work.
_groq_clients: list[tuple[str, Groq]] = []
if GROQ_API_KEY_1:
    _groq_clients.append(("GROQ_API_KEY_1", Groq(api_key=GROQ_API_KEY_1)))
if GROQ_API_KEY_2:
    _groq_clients.append(("GROQ_API_KEY_2", Groq(api_key=GROQ_API_KEY_2)))

GROQ_READY = len(_groq_clients) > 0


def _groq_stream(prompt: str):
    """
    Stream a chat completion from Groq, trying each configured API key in order.

    Failover policy:
      • 429 / rate-limit error → silently try the next key
      • Any other error → raise immediately (don't waste another key on a real bug)
    """
    last_error: Exception | None = None
    for key_label, client in _groq_clients:
        try:
            for chunk in client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                stream=True,
            ):
                text = chunk.choices[0].delta.content
                if text:
                    yield text
            return  # success — stop trying keys
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            is_rate_limit = (
                "429" in err_str
                or "rate_limit" in err_str
                or "rate limit" in err_str
                or "resource_exhausted" in err_str
            )
            if is_rate_limit and len(_groq_clients) > 1:
                # try next key
                continue
            raise
    if last_error:
        raise last_error


# ═══════════════════════════════════════════════════════════════════════════════
#  GOOGLE / GEMINI — for embeddings (Groq has no embeddings API)
# ═══════════════════════════════════════════════════════════════════════════════
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_READY = bool(GOOGLE_API_KEY)


# ═══════════════════════════════════════════════════════════════════════════════
#  PAGE CONFIG + CUSTOM CSS
# ═══════════════════════════════════════════════════════════════════════════════
st.set_page_config(
    page_title="Sattva RAG",
    page_icon="🌿",
    layout="centered",
    initial_sidebar_state="expanded",
)

# Belt-and-suspenders: explicitly force the sidebar to be expanded. Some
# Streamlit versions ignore initial_sidebar_state when the browser viewport
# is narrow, and auto-collapse the sidebar. This option makes "expanded"
# sticky regardless of viewport width.
try:
    st.set_option("client.showSidebarNavigation", True)
except Exception:
    pass  # older Streamlit versions don't have this option

st.markdown("""
<style>
/* ═══════════════════════════════════════════════════════════════════════════════
   SATTVA RAG — Warm Morning Light Design System
   ─────────────────────────────────────────────────────────────────────────────
   Yoga-studio aesthetic: warm sand, sage green, off-white.
   Accents: terracotta and dusk pink.
   Typography: Cormorant Garamond (humanist serif headings) + Source Sans 3 (body).
   Background: subtle linen paper texture via SVG noise.
   ═══════════════════════════════════════════════════════════════════════════════ */

@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Source+Sans+3:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Design Tokens ── */
:root {
    /* Surfaces — warm sand & linen */
    --bg:               #f5f0e8;
    --surface:          #faf7f2;
    --surface-raised:   #fdfbf7;
    --surface-glass:    rgba(250, 247, 242, 0.72);
    --surface-glass-strong: rgba(250, 247, 242, 0.90);
    --surface-hover:    rgba(188, 108, 72, 0.05);

    /* Borders — warm stone */
    --border:           rgba(120, 100, 75, 0.12);
    --border-strong:    rgba(120, 100, 75, 0.20);
    --border-glass:     rgba(245, 238, 220, 0.70);
    --border-glow:      rgba(188, 108, 72, 0.30);

    /* Text — deep warm slate */
    --text-primary:     #2c2417;
    --text-secondary:   #6b5d4f;
    --text-tertiary:    #a8957f;

    /* Accent — terracotta primary, dusk pink secondary, sage green functional */
    --accent:           #bc6c48;
    --accent-hover:     #a05a38;
    --accent-light:     #d4906e;
    --accent-muted:     rgba(188, 108, 72, 0.09);
    --accent-secondary: #c47a8a;
    --accent-gradient:  linear-gradient(135deg, #bc6c48 0%, #c47a8a 55%, #b07aa0 100%);

    /* Sage green — sidebar & functional elements */
    --sage:             #7a9e87;
    --sage-light:       #a8c4b0;
    --sage-muted:       rgba(122, 158, 135, 0.12);
    --sage-border:      rgba(122, 158, 135, 0.28);

    /* Source badges */
    --cache:            #7a9e87;
    --cache-bg:         rgba(122, 158, 135, 0.12);
    --cache-border:     rgba(122, 158, 135, 0.28);
    --database:         #6d8fa6;
    --database-bg:      rgba(109, 143, 166, 0.12);
    --database-border:  rgba(109, 143, 166, 0.28);
    --system:           #bc6c48;
    --system-bg:        rgba(188, 108, 72, 0.10);
    --system-border:    rgba(188, 108, 72, 0.25);

    /* Status */
    --success:          #7a9e87;
    --warning:          #bc6c48;
    --error:            #b85050;

    /* Shadows — soft warm earth */
    --shadow-1: 0 1px 3px rgba(44, 36, 23, 0.06), 0 1px 2px rgba(44, 36, 23, 0.04);
    --shadow-2: 0 3px 12px rgba(44, 36, 23, 0.07), 0 1px 4px rgba(44, 36, 23, 0.05);
    --shadow-3: 0 8px 32px rgba(44, 36, 23, 0.10), 0 2px 8px rgba(44, 36, 23, 0.06);
    --shadow-glow: 0 4px 20px rgba(188, 108, 72, 0.18), 0 1px 4px rgba(188, 108, 72, 0.10);
    --inset-highlight: inset 0 1px 0 rgba(255, 252, 245, 0.70);

    /* Sidebar — sage green tinted */
    --sidebar-bg:        linear-gradient(180deg, #eef3ef 0%, #e8f0ea 100%);
    --sidebar-surface:   rgba(122, 158, 135, 0.06);
    --sidebar-border:    rgba(100, 140, 112, 0.18);
    --sidebar-text:      #1e2e23;
    --sidebar-muted:     #7a9e87;

    /* Radii — softer, more organic */
    --r-sm:   6px;
    --r-md:   10px;
    --r-lg:   16px;
    --r-xl:   20px;
    --r-pill: 100px;

    /* Typography */
    --font-display: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    --font-body:    'Source Sans 3', 'Helvetica Neue', Arial, sans-serif;
    --font-mono:    'JetBrains Mono', 'SF Mono', monospace;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FORCE WARM THEME — override Streamlit's theme variables
   ═══════════════════════════════════════════════════════════════════════════════ */
:root,
[data-theme="light"],
[data-theme="dark"] {
    --background-color:             var(--bg) !important;
    --secondary-background-color:   var(--surface) !important;
    --tertiary-background-color:    var(--surface-raised) !important;
    --primary-color:                var(--accent) !important;
    --text-color:                   var(--text-primary) !important;
    --secondary-text-color:         var(--text-secondary) !important;
    --link-color:                   var(--accent-hover) !important;
    --code-color:                   var(--accent) !important;
    --code-background-color:        rgba(120, 100, 75, 0.07) !important;
    --border-color:                 var(--border) !important;
    --widget-bg:                    var(--surface) !important;
    --font:                         'Source Sans 3', 'Helvetica Neue', sans-serif !important;
    --font-mono:                    'JetBrains Mono', 'SF Mono', monospace !important;
    --radius:                       16px !important;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BASE — warm morning light, diagonal sunbeams, linen paper texture
   ═══════════════════════════════════════════════════════════════════════════════ */
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body, .stApp {
    font-family: var(--font-body);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    /* Linen paper texture (SVG noise) + warm morning sunbeam orbs */
    background:
        /* diagonal sunbeam — top-left pour */
        linear-gradient(118deg, rgba(255, 230, 180, 0.28) 0%, transparent 45%),
        /* window light bloom — upper right */
        radial-gradient(ellipse 70% 55% at 88% 5%,  rgba(255, 220, 150, 0.22) 0%, transparent 55%),
        /* sage shadow — lower left corner */
        radial-gradient(ellipse 50% 40% at 4% 92%,  rgba(122, 158, 135, 0.14) 0%, transparent 55%),
        /* terracotta warmth — mid right */
        radial-gradient(ellipse 40% 35% at 96% 60%, rgba(188, 108, 72, 0.07) 0%, transparent 50%),
        /* dusk pink bloom — lower center */
        radial-gradient(ellipse 60% 30% at 50% 100%, rgba(196, 122, 138, 0.07) 0%, transparent 55%),
        /* linen base */
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"),
        #f5f0e8 !important;
    background-attachment: fixed !important;
}
.block-container {
    padding-top: 2rem !important;
    padding-bottom: 6rem !important;
    max-width: 840px !important;
}
.stApp,
[data-testid="stAppViewContainer"],
[data-testid="stMainBlockContainer"] {
    background: transparent !important;
    color: var(--text-primary) !important;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SIDEBAR — sage green frosted panel (no collapse, always visible)
   ═══════════════════════════════════════════════════════════════════════════════ */
[data-testid="stSidebar"],
section[data-testid="stSidebar"] {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    bottom: 0 !important;
    height: 100vh !important;
    width: 340px !important;
    min-width: 340px !important;
    max-width: 340px !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
    visibility: visible !important;
    background: var(--sidebar-bg) !important;
    border-right: 1px solid var(--sidebar-border) !important;
    backdrop-filter: blur(20px) saturate(150%) !important;
    -webkit-backdrop-filter: blur(20px) saturate(150%) !important;
    color: var(--sidebar-text) !important;
    box-shadow: 2px 0 24px rgba(44, 36, 23, 0.07) !important;
    z-index: 100 !important;
    overflow: hidden !important;
    transform: none !important;
    opacity: 1 !important;
    flex: none !important;
}

/* Inner scroll container — scrolls independently when content overflows */
[data-testid="stSidebarContent"],
[data-testid="stSidebarUserContent"],
section[data-testid="stSidebar"] > div {
    height: 100vh !important;
    width: 340px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 1.5rem 1.25rem 2rem 1.25rem !important;
    display: block !important;
    visibility: visible !important;
    transform: none !important;
}

/* All sidebar text uses our token */
[data-testid="stSidebar"] * { color: var(--sidebar-text) !important; }
[data-testid="stSidebar"] .sidebar-section-title { color: var(--sidebar-muted) !important; }

/* Push the main content right to make room for the fixed 340px sidebar */
[data-testid="stAppViewContainer"],
[data-testid="stMainBlockContainer"],
.main > div:first-child,
.block-container {
    margin-left: 340px !important;
}
/* On narrow viewports, let the main content shrink but keep the sidebar */
@media (max-width: 768px) {
    [data-testid="stSidebar"],
    section[data-testid="stSidebar"] {
        width: 280px !important;
        min-width: 280px !important;
        max-width: 280px !important;
    }
    [data-testid="stSidebarContent"],
    [data-testid="stSidebarUserContent"],
    section[data-testid="stSidebar"] > div {
        width: 280px !important;
    }
    [data-testid="stAppViewContainer"],
    [data-testid="stMainBlockContainer"],
    .main > div:first-child,
    .block-container {
        margin-left: 280px !important;
    }
}

/* Sidebar inner element spacing — fix the "elements not placed properly" issue */
[data-testid="stSidebar"] .stMarkdown,
[data-testid="stSidebar"] .stButton,
[data-testid="stSidebar"] .stFileUploader,
[data-testid="stSidebar"] [data-testid="stFileUploader"],
[data-testid="stSidebar"] .stVerticalBlock,
[data-testid="stSidebar"] [data-testid="stVerticalBlock"] {
    width: 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
}
[data-testid="stSidebar"] .stButton {
    margin-top: 0.5rem !important;
    margin-bottom: 0.25rem !important;
}
[data-testid="stSidebar"] .stButton + .stButton {
    margin-top: 0.25rem !important;
}
[data-testid="stSidebar"] hr {
    margin-left: 0 !important;
    margin-right: 0 !important;
    width: 100% !important;
}
/* Captions inside sidebar */
[data-testid="stSidebar"] [data-testid="stCaptionContainer"],
[data-testid="stSidebar"] .stCaption {
    color: var(--text-secondary) !important;
    font-size: 0.78rem !important;
    margin-bottom: 0.5rem !important;
}
/* Columns inside sidebar (used for the Clear/Reset buttons) */
[data-testid="stSidebar"] [data-testid="stHorizontalBlock"],
[data-testid="stSidebar"] .stHorizontalBlock {
    gap: 8px !important;
    width: 100% !important;
}
/* Vertical rhythm between sidebar blocks */
[data-testid="stSidebar"] [data-testid="stVerticalBlock"] > div {
    margin-bottom: 0.4rem;
}

/* Upload dropzone */
[data-testid="stSidebar"] [data-testid="stFileUploadDropzone"],
[data-testid="stSidebar"] [data-testid="stFileUploaderDropzone"] {
    background: rgba(250, 247, 242, 0.55) !important;
    border: 1.5px dashed var(--sage-border) !important;
    border-radius: var(--r-lg);
    padding: 1.4rem 1rem;
    transition: all 0.25s ease;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    box-shadow: var(--inset-highlight);
}
[data-testid="stSidebar"] [data-testid="stFileUploadDropzone"]:hover,
[data-testid="stSidebar"] [data-testid="stFileUploaderDropzone"]:hover {
    background: rgba(122, 158, 135, 0.08) !important;
    border-color: var(--sage) !important;
    transform: translateY(-1px);
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HEADER — organic logo chip + warm serif title
   ═══════════════════════════════════════════════════════════════════════════════ */
.app-header {
    text-align: center;
    margin-bottom: 2rem;
    padding: 2rem 0 1rem;
    position: relative;
}
.app-logo-wrap {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 0.5rem;
}
.app-logo {
    width: 50px;
    height: 50px;
    border-radius: 15px;
    background: linear-gradient(135deg, #bc6c48 0%, #c47a8a 60%, #7a9e87 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.45rem;
    box-shadow: 0 4px 18px rgba(188, 108, 72, 0.22), var(--inset-highlight);
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 252, 245, 0.35);
}
.app-logo::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 30%, rgba(255,252,245,0.30) 50%, transparent 70%);
    animation: shimmer 5s infinite;
}
@keyframes shimmer {
    0%   { transform: translateX(-120%); }
    100% { transform: translateX(120%); }
}
.app-title {
    font-family: var(--font-display) !important;
    font-size: 2.4rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    line-height: 1;
    /* No gradient clip — let the serif stand on its own */
}
.app-subtitle {
    font-family: var(--font-body);
    color: var(--text-secondary);
    font-size: 0.92rem;
    font-weight: 400;
    margin-top: 0.4rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-style: italic;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   CHAT MESSAGES — warm parchment & terracotta bubbles
   ═══════════════════════════════════════════════════════════════════════════════ */
.stChatMessage {
    border-radius: var(--r-xl) !important;
    padding: 1rem 1.25rem !important;
    margin-bottom: 0.9rem !important;
    backdrop-filter: blur(10px) saturate(130%);
    -webkit-backdrop-filter: blur(10px) saturate(130%);
    transition: border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
    box-shadow: var(--shadow-1), var(--inset-highlight) !important;
    border: 1px solid var(--border-glass) !important;
}
.stChatMessage:hover {
    border-color: var(--border-strong) !important;
    box-shadow: var(--shadow-2), var(--inset-highlight) !important;
}

/* Assistant — warm parchment with terracotta left rail */
[data-testid="stChatMessageAssitant"],
[data-testid="stChatMessage-assistant"] {
    background: var(--surface-glass) !important;
    border-color: var(--border-glass) !important;
    border-left: 3px solid var(--accent) !important;
}
[data-testid="stChatMessageAssitant"] p,
[data-testid="stChatMessage-assistant"] p,
[data-testid="stChatMessageAssitant"] li,
[data-testid="stChatMessage-assistant"] li {
    font-family: var(--font-body) !important;
    color: var(--text-primary) !important;
    font-size: 0.96rem;
    line-height: 1.8;
}

/* User — terracotta-to-dusk-pink gradient */
[data-testid="stChatMessageUser"],
[data-testid="stChatMessage-user"] {
    background: var(--accent-gradient) !important;
    border-color: transparent !important;
    border-left: none !important;
    box-shadow: var(--shadow-glow) !important;
}
[data-testid="stChatMessageUser"] p,
[data-testid="stChatMessage-user"] p,
[data-testid="stChatMessageUser"] span,
[data-testid="stChatMessage-user"] span {
    font-family: var(--font-body) !important;
    color: #fdf8f4 !important;
    font-size: 0.96rem;
    line-height: 1.8;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SOURCE BADGES
   ═══════════════════════════════════════════════════════════════════════════════ */
.src-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 11px;
    border-radius: var(--r-pill);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-top: 0.7rem;
    text-transform: uppercase;
    border: 1px solid transparent;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: var(--inset-highlight);
}
.src-badge.cache    { background: var(--cache-bg);    color: var(--cache);    border-color: var(--cache-border); }
.src-badge.database { background: var(--database-bg); color: var(--database); border-color: var(--database-border); }
.src-badge.system   { background: var(--system-bg);   color: var(--system);   border-color: var(--system-border); }
.src-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
}
.src-dot.cache    { background: var(--cache);    box-shadow: 0 0 8px var(--cache); }
.src-dot.database { background: var(--database); box-shadow: 0 0 8px var(--database); }
.src-dot.system   { background: var(--system); }

/* ═══════════════════════════════════════════════════════════════════════════════
   CHAT INPUT — warm parchment pill
   ═══════════════════════════════════════════════════════════════════════════════ */
[data-testid="stChatInputContainer"] {
    background: var(--surface-glass-strong) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: var(--r-pill) !important;
    padding: 7px 8px !important;
    backdrop-filter: blur(14px) saturate(130%);
    -webkit-backdrop-filter: blur(14px) saturate(130%);
    box-shadow: var(--shadow-2), var(--inset-highlight) !important;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
[data-testid="stChatInputContainer"]:focus-within {
    border-color: var(--accent) !important;
    box-shadow: var(--shadow-glow), var(--inset-highlight) !important;
}
[data-testid="stChatInputContainer"] textarea {
    color: var(--text-primary) !important;
    background: transparent !important;
    font-family: var(--font-body) !important;
    font-size: 0.95rem !important;
}
[data-testid="stChatInputContainer"] textarea::placeholder {
    color: var(--text-tertiary) !important;
    font-style: italic;
}
[data-testid="stChatInputContainer"] button {
    background: var(--accent-gradient) !important;
    border-radius: 50% !important;
    width: 36px !important;
    height: 36px !important;
    border: none !important;
    box-shadow: var(--shadow-glow);
    transition: transform 0.15s ease;
}
[data-testid="stChatInputContainer"] button:hover { transform: scale(1.08); }
[data-testid="stChatInputContainer"] button svg {
    fill: #ffffff !important;
    color: #ffffff !important;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   BUTTONS
   ═══════════════════════════════════════════════════════════════════════════════ */
.stButton > button {
    font-family: var(--font-body) !important;
    font-size: 0.85rem !important;
    border-radius: var(--r-md) !important;
    padding: 0.5rem 1.2rem !important;
    font-weight: 500 !important;
    letter-spacing: 0.02em;
    transition: all 0.2s ease !important;
}
.stButton > button[kind="primary"] {
    background: var(--accent-gradient) !important;
    color: #fdf8f4 !important;
    border: none !important;
    box-shadow: var(--shadow-glow), var(--inset-highlight) !important;
}
.stButton > button[kind="primary"]:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 6px 24px rgba(188, 108, 72, 0.28), var(--inset-highlight) !important;
}
.stButton > button[kind="primary"]:active { transform: translateY(0) !important; }
.stButton > button[kind="secondary"] {
    background: var(--surface-glass) !important;
    color: var(--text-primary) !important;
    border: 1px solid var(--border) !important;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: var(--inset-highlight);
}
.stButton > button[kind="secondary"]:hover {
    background: var(--surface-hover) !important;
    border-color: var(--accent) !important;
    color: var(--accent-hover) !important;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   STATUS PILLS
   ═══════════════════════════════════════════════════════════════════════════════ */
.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: var(--r-pill);
    font-size: 0.74rem;
    font-weight: 500;
    margin-top: 8px;
    border: 1px solid transparent;
    letter-spacing: 0.01em;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: var(--inset-highlight);
}
.status-pill.ready   { background: var(--cache-bg);     color: var(--success); border-color: var(--cache-border); }
.status-pill.empty   { background: var(--system-bg);    color: var(--warning); border-color: var(--system-border); }
.status-pill.loading { background: var(--accent-muted); color: var(--accent);  border-color: rgba(188, 108, 72, 0.22); }
.status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    display: inline-block;
}
.status-dot.ready   { background: var(--success); box-shadow: 0 0 6px var(--success); }
.status-dot.empty   { background: var(--warning); }
.status-dot.loading { background: var(--accent);  animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse {
    0%,100% { opacity: 1;   transform: scale(1); }
    50%     { opacity: 0.4; transform: scale(0.7); }
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SIDEBAR TYPOGRAPHY & FILE LIST
   ═══════════════════════════════════════════════════════════════════════════════ */
.sidebar-section-title {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    color: var(--sidebar-muted);
    font-weight: 600;
    margin-bottom: 0.5rem;
    margin-top: 1.4rem;
}
.sidebar-divider {
    border: none;
    border-top: 1px solid var(--sidebar-border);
    margin: 1.1rem 0;
}
.file-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 12px;
    border-radius: var(--r-md);
    background: rgba(255, 255, 255, 0.50);
    border: 1px solid var(--sidebar-border);
    margin-bottom: 6px;
    font-size: 0.82rem;
    transition: all 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--sidebar-text);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: var(--inset-highlight);
}
.file-item:hover {
    background: var(--accent-muted);
    border-color: rgba(188, 108, 72, 0.28);
}
.file-item .file-icon { flex-shrink: 0; }

/* ═══════════════════════════════════════════════════════════════════════════════
   WELCOME CARD — frosted glass hero
   ═══════════════════════════════════════════════════════════════════════════════ */
.welcome-card {
    background: var(--surface-glass);
    border: 1px solid var(--border-glass);
    border-radius: var(--r-xl);
    padding: 3rem 2.5rem;
    text-align: center;
    margin: 1rem 0 2rem;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow: var(--shadow-2), var(--inset-highlight);
    position: relative;
    overflow: hidden;
}
.welcome-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(188, 108, 72, 0.08) 0%, transparent 60%);
    pointer-events: none;
}
.welcome-icon {
    font-size: 2.8rem;
    display: block;
    margin-bottom: 1rem;
    line-height: 1;
    position: relative;
}
.welcome-card h3 {
    font-family: var(--font-display) !important;
    color: var(--text-primary) !important;
    font-size: 1.55rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    margin-bottom: 0.6rem;
    position: relative;
}
.welcome-card p {
    font-family: var(--font-body) !important;
    color: var(--text-secondary) !important;
    font-size: 0.93rem;
    line-height: 1.8;
    max-width: 420px;
    margin: 0 auto;
    position: relative;
}
.welcome-card .kbd {
    display: inline-block;
    background: var(--accent-muted);
    color: var(--accent-hover);
    border: 1px solid rgba(188, 108, 72, 0.22);
    border-radius: 5px;
    padding: 1px 7px;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
}
.welcome-hint-row {
    display: flex;
    justify-content: center;
    gap: 18px;
    margin-top: 1.5rem;
    position: relative;
    flex-wrap: wrap;
}
.welcome-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--text-tertiary);
}
.welcome-hint .hint-dot {
    width: 6px; height: 6px; border-radius: 50%;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   STATS ROW — glass cards
   ═══════════════════════════════════════════════════════════════════════════════ */
.stat-row {
    display: flex;
    gap: 8px;
    margin: 0.8rem 0 0;
}
.stat-card {
    flex: 1;
    background: var(--surface-glass);
    border: 1px solid var(--border-glass);
    border-radius: var(--r-md);
    padding: 10px 12px;
    text-align: left;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: var(--shadow-1), var(--inset-highlight);
}
.stat-label {
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-tertiary);
    margin-bottom: 4px;
    font-weight: 600;
}
.stat-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
}
.stat-value.cache    { color: var(--cache); }
.stat-value.database { color: var(--database); }

/* ═══════════════════════════════════════════════════════════════════════════════
   SCROLLBAR — slim terracotta
   ═══════════════════════════════════════════════════════════════════════════════ */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
    background: rgba(188, 108, 72, 0.22);
    border-radius: var(--r-pill);
}
::-webkit-scrollbar-thumb:hover { background: rgba(188, 108, 72, 0.42); }

/* ═══════════════════════════════════════════════════════════════════════════════
   STREAMLIT CHROME CLEANUP — hide only specific widgets, NEVER stHeader
   ═══════════════════════════════════════════════════════════════════════════════ */
#MainMenu,
footer,
.stDeployButton,
[data-testid="stToolbar"],
[data-testid="stToolbarActionElement"],
[data-testid="stMainMenu"],
[data-testid="stLogo"] { display: none !important; }

[data-testid="stHeader"] {
    background: transparent !important;
    visibility: visible !important;
}
[data-testid="stHeader"] > div:first-child {
    background: transparent !important;
}

/* Hide the sidebar collapse/expand toggle completely — sidebar is fixed
   and cannot be hidden or shown by the user. */
[data-testid="stSidebarCollapsedControl"],
[data-testid="stSidebarCollapseButton"],
[data-testid="collapsedControl"],
[data-testid="stSidebarCollapseButton"] button,
button[kind="header"] {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

.main > div:first-child { padding-top: 0 !important; }

[data-testid="stSpinner"] p { color: var(--text-secondary) !important; }
[data-testid="stSpinner"] svg { color: var(--accent) !important; }

</style>
""", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════════════════
#  JAVASCRIPT — force sidebar to stay open.
#  CSS alone can't reliably override Streamlit's sidebar collapse logic across
#  all versions, so we also manipulate the DOM directly via components.html().
#  This runs in an iframe but accesses window.parent.document (same-origin).
# ═══════════════════════════════════════════════════════════════════════════════
import streamlit.components.v1 as components

components.html("""
<script>
(function() {
    const doc = window.parent.document;
    const SIDEBAR_WIDTH = '340px';

    function enforceFixedSidebar() {
        // Force the sidebar container to be fixed & visible
        const sidebar = doc.querySelector('[data-testid="stSidebar"]');
        if (sidebar) {
            sidebar.style.setProperty('position', 'fixed', 'important');
            sidebar.style.setProperty('top', '0', 'important');
            sidebar.style.setProperty('left', '0', 'important');
            sidebar.style.setProperty('bottom', '0', 'important');
            sidebar.style.setProperty('height', '100vh', 'important');
            sidebar.style.setProperty('width', SIDEBAR_WIDTH, 'important');
            sidebar.style.setProperty('min-width', SIDEBAR_WIDTH, 'important');
            sidebar.style.setProperty('max-width', SIDEBAR_WIDTH, 'important');
            sidebar.style.setProperty('display', 'block', 'important');
            sidebar.style.setProperty('visibility', 'visible', 'important');
            sidebar.style.setProperty('transform', 'none', 'important');
            sidebar.style.setProperty('opacity', '1', 'important');
            sidebar.style.setProperty('margin', '0', 'important');
            sidebar.style.setProperty('z-index', '100', 'important');
            sidebar.setAttribute('aria-expanded', 'true');
        }

        // Force the inner content container
        const content = doc.querySelector('[data-testid="stSidebarContent"]');
        if (content) {
            content.style.setProperty('display', 'block', 'important');
            content.style.setProperty('visibility', 'visible', 'important');
            content.style.setProperty('width', SIDEBAR_WIDTH, 'important');
            content.style.setProperty('height', '100vh', 'important');
            content.style.setProperty('overflow-y', 'auto', 'important');
            content.style.setProperty('transform', 'none', 'important');
            content.style.setProperty('padding', '1.5rem 1.25rem 2rem 1.25rem', 'important');
        }

        // Hide the collapse toggle button entirely
        const toggles = doc.querySelectorAll(
            '[data-testid="stSidebarCollapsedControl"], ' +
            '[data-testid="stSidebarCollapseButton"], ' +
            '[data-testid="collapsedControl"]'
        );
        toggles.forEach(function(t) {
            t.style.setProperty('display', 'none', 'important');
            t.style.setProperty('visibility', 'hidden', 'important');
            t.style.setProperty('width', '0', 'important');
            t.style.setProperty('height', '0', 'important');
            t.style.setProperty('opacity', '0', 'important');
            t.style.setProperty('pointer-events', 'none', 'important');
        });

        // Push the main content right to make room for the fixed sidebar
        const mainContainers = doc.querySelectorAll(
            '[data-testid="stAppViewContainer"], ' +
            '[data-testid="stMainBlockContainer"], ' +
            '.main > div:first-child, ' +
            '.block-container'
        );
        mainContainers.forEach(function(c) {
            c.style.setProperty('margin-left', SIDEBAR_WIDTH, 'important');
        });
    }

    // Run immediately + retry to catch Streamlit's async render + reruns
    enforceFixedSidebar();
    setTimeout(enforceFixedSidebar, 100);
    setTimeout(enforceFixedSidebar, 400);
    setTimeout(enforceFixedSidebar, 1000);
    setTimeout(enforceFixedSidebar, 2000);
    setInterval(enforceFixedSidebar, 1500);
})();
</script>
""", height=0)


# ═══════════════════════════════════════════════════════════════════════════════
#  SESSION STATE
# ═══════════════════════════════════════════════════════════════════════════════
if "messages" not in st.session_state:
    st.session_state.messages = []
if "ingested_files" not in st.session_state:
    st.session_state.ingested_files = []
if "db_ready" not in st.session_state:
    st.session_state.db_ready = False
if "processing" not in st.session_state:
    st.session_state.processing = False
if "cache_hits" not in st.session_state:
    st.session_state.cache_hits = 0
if "db_hits" not in st.session_state:
    st.session_state.db_hits = 0


# ═══════════════════════════════════════════════════════════════════════════════
#  HEADER
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown(
    '''<div class="app-header">
        <div class="app-logo-wrap">
            <div class="app-logo">🌿</div>
            <span class="app-title">Sattva RAG</span>
        </div>
        <div class="app-subtitle">Dual-key Groq &bull; Semantic cache &bull; ChromaDB retrieval</div>
    </div>''',
    unsafe_allow_html=True,
)


# ═══════════════════════════════════════════════════════════════════════════════
#  DATA DIRS
# ═══════════════════════════════════════════════════════════════════════════════
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
CHROMA_DIR = Path("./chroma_db")


def _ensure_writable(path: Path) -> None:
    """
    Recursively fix permissions on a directory tree so ChromaDB can write to it.

    Fixes the common 'attempt to write a readonly database' (SQLite error 1032)
    that happens when the chroma_db folder was created by a different user,
    copied from a read-only source, or had restrictive perms applied to it.
    """
    try:
        path.mkdir(parents=True, exist_ok=True)
        path.chmod(0o755)
        for root, dirs, files in os.walk(path):
            for d in dirs:
                try:
                    Path(root, d).chmod(0o755)
                except (PermissionError, OSError):
                    pass
            for f in files:
                try:
                    Path(root, f).chmod(0o644)
                except (PermissionError, OSError):
                    pass
    except (PermissionError, OSError) as e:
        print(f"[warn] Could not fix permissions on {path}: {e}")


def _get_chroma_path() -> Path:
    """
    Return a writable path for ChromaDB.
    Falls back to ~/.chroma_db_neuralrag if ./chroma_db is read-only.
    """
    primary = CHROMA_DIR
    _ensure_writable(primary)
    try:
        sentinel = primary / ".write_test"
        sentinel.write_text("ok", encoding="utf-8")
        sentinel.unlink()
        return primary
    except (PermissionError, OSError):
        fallback = Path.home() / ".chroma_db_neuralrag"
        _ensure_writable(fallback)
        print(f"[warn] {primary} is read-only — using fallback: {fallback}")
        return fallback


# ═══════════════════════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _init_redis_cache():
    """Create the vector index in Redis if it doesn't exist."""
    try:
        redis_client.ft(CACHE_INDEX_NAME).info()
    except Exception:
        from redis.commands.search.field import VectorField
        schema = VectorField(
            "question_vector",
            "HNSW",
            {"TYPE": "FLOAT32", "DIM": 3072, "DISTANCE_METRIC": "COSINE"},
        )
        redis_client.ft(CACHE_INDEX_NAME).create_index([schema])


def _get_cached_answer(question: str, q_embedding: list):
    """Search Redis for a semantically similar question. Returns answer string or None."""
    if not REDIS_AVAILABLE:
        return None
    try:
        _init_redis_cache()
        from redis.commands.search.query import Query as RedisQuery
        q_bytes = np.array(q_embedding, dtype=np.float32).tobytes()

        query = (
            RedisQuery("*=>[KNN 1 @question_vector $vec AS score]")
            .add_param("vec", q_bytes)
            .return_fields("answer", "score")
            .dialect(2)
        )
        results = redis_client.ft(CACHE_INDEX_NAME).search(query)

        if results.docs:
            # Redis COSINE distance: 0 = exact match, 1 = totally different
            score = float(results.docs[0].score)
            if score <= (1 - SIMILARITY_THRESHOLD):
                return results.docs[0].answer
        return None
    except Exception as e:
        print(f"Redis cache lookup error: {e}")
        return None


def _set_cached_answer(question: str, q_embedding: list, answer: str):
    """Save the question vector + answer to Redis."""
    if not REDIS_AVAILABLE:
        return
    try:
        _init_redis_cache()
        q_bytes = np.array(q_embedding, dtype=np.float32).tobytes()
        doc_id = CACHE_PREFIX + hashlib.md5(question.encode()).hexdigest()

        redis_client.hset(doc_id, mapping={
            "question_vector": q_bytes,
            "answer": answer,
        })
    except Exception as e:
        print(f"Redis cache save error: {e}")


def _get_chunk_count() -> int:
    """Return the number of chunks in the ChromaDB collection (or 0 on failure)."""
    try:
        import chromadb
        client = chromadb.PersistentClient(path=str(_get_chroma_path()))
        col = client.get_or_create_collection(name="my_knowledge_base")
        return col.count()
    except Exception:
        return 0


def _ingest_files(uploaded_files):
    """Store files in session state and trigger processing rerun."""
    saved_names = []
    for f in uploaded_files:
        dest = DATA_DIR / f.name
        with open(dest, "wb") as out:
            out.write(f.read())
        saved_names.append(f.name)
    st.session_state._pending_files = saved_names
    st.session_state.processing = True
    st.rerun()


def _run_ingest(file_names: list[str]):
    """Actual ingestion pipeline — runs in the processing rerun."""
    # ── Early API key check — fail fast with a clear message ──
    if not GOOGLE_API_KEY:
        st.error(
            "\U0001f6a8 **GOOGLE_API_KEY is missing!**\n\n"
            "Embeddings use Google Gemini (`gemini-embedding-001`) — Groq does "
            "not offer an embeddings API. You MUST set `GOOGLE_API_KEY` in your "
            "`.env` file even though you're using Groq for chat.\n\n"
            "Get one at: https://aistudio.google.com/app/apikey\n"
            "Then add this line to `.env`:\n"
            "```\nGOOGLE_API_KEY=your_key_here\n```"
        )
        return

    import chromadb
    from langchain_community.document_loaders import UnstructuredMarkdownLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from google import genai

    docs = []
    for fname in file_names:
        loader = UnstructuredMarkdownLoader(str(DATA_DIR / fname))
        docs.extend(loader.load())

    if not docs:
        st.warning("No content extracted from the uploaded files.")
        return

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(docs)

    # Embeddings via Gemini (Groq has no embeddings API)
    client = genai.Client(api_key=GOOGLE_API_KEY)
    texts = [c.page_content for c in chunks]
    response = client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=texts,
    )
    embeddings = [e.values for e in response.embeddings]

    chroma_client = chromadb.PersistentClient(path=str(_get_chroma_path()))
    collection = chroma_client.get_or_create_collection(name="my_knowledge_base")
    start_id = collection.count()
    collection.add(
        documents=texts,
        embeddings=embeddings,
        ids=[f"doc{start_id + i}" for i in range(len(texts))],
    )

    for fname in file_names:
        if fname not in st.session_state.ingested_files:
            st.session_state.ingested_files.append(fname)
    st.session_state.db_ready = True

    st.success(f"Ingested {len(chunks)} chunks from {len(file_names)} file(s).")


def _rag_answer(question: str):
    """
    Retrieve context and stream the answer.

    Returns:
        (stream_generator, source) — source is "cache" or "database".
        On cache hit, the stream yields the cached string in one go and we
        skip both the ChromaDB lookup and the Groq API call entirely.
    """
    from google import genai

    google_client = genai.Client(api_key=GOOGLE_API_KEY)

    # Embed question (still via Gemini — Groq has no embeddings endpoint)
    q_resp = google_client.models.embed_content(
        model="models/gemini-embedding-001",
        contents=question,
    )
    q_embedding = q_resp.embeddings[0].values

    # ── CHECK CACHE FIRST ──
    cached_answer = _get_cached_answer(question, q_embedding)
    if cached_answer:
        def _cached_stream():
            yield cached_answer
        return _cached_stream(), "cache"

    # ── RETRIEVE FROM CHROMADB ──
    import chromadb
    chroma_client = chromadb.PersistentClient(path=str(_get_chroma_path()))
    collection = chroma_client.get_or_create_collection(name="my_knowledge_base")
    results = collection.query(query_embeddings=[q_embedding], n_results=3)
    context = "\n\n---\n\n".join(results["documents"][0])

    system_prompt = (
        "1. You are a helpful RAG assistant.\n"
        "2. Give polite answers to the query and stay grounded in the facts from the context.\n"
        "3. Be professional and don't make up anything that is not present in the context.\n"
        "4. If the context doesn't contain relevant information, say so honestly.\n"
    )
    final_prompt = f"""{system_prompt}

CONTEXT:
{context}

QUERY:
{question}
"""

    def _db_stream():
        full_answer = ""
        for text in _groq_stream(final_prompt):
            full_answer += text
            yield text
        # Persist answer to cache so future semantically-similar questions hit cache
        _set_cached_answer(question, q_embedding, full_answer)

    return _db_stream(), "database"


def _reset_db():
    """Wipe the ChromaDB and ingested-files list."""
    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR, ignore_errors=True)
    st.session_state.db_ready = False
    st.session_state.ingested_files = []
    st.session_state.messages = []
    st.session_state.cache_hits = 0
    st.session_state.db_hits = 0


def _source_badge_html(source: str) -> str:
    """Render the source badge HTML for an assistant message."""
    if source == "cache":
        return (
            '<span class="src-badge cache">'
            '<span class="src-dot cache"></span>'
            '\u26a1 From Cache'
            '</span>'
        )
    if source == "database":
        return (
            '<span class="src-badge database">'
            '<span class="src-dot database"></span>'
            '\U0001f5c4\ufe0f From Database'
            '</span>'
        )
    # system / warning
    return (
        '<span class="src-badge system">'
        '<span class="src-dot system"></span>'
        '\u2699\ufe0f System'
        '</span>'
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  SIDEBAR
# ═══════════════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("<div class=\"sidebar-section-title\">Knowledge Base</div>", unsafe_allow_html=True)
    st.caption("Upload `.md` files to build your RAG knowledge base.")

    uploaded = st.file_uploader(
        "Drop markdown files here",
        type=["md"],
        accept_multiple_files=True,
        key="md_uploader",
        label_visibility="collapsed",
    )

    if uploaded:
        st.markdown("<hr class=\"sidebar-divider\">", unsafe_allow_html=True)
        st.markdown("<div class=\"sidebar-section-title\">Pending Files</div>", unsafe_allow_html=True)
        for f in uploaded:
            st.markdown(
                f"<div class=\"file-item\"><span class=\"file-icon\">\U0001f4c4</span>{f.name}</div>",
                unsafe_allow_html=True,
            )

        if st.button("\u26a1 Ingest Files", use_container_width=True, type="primary"):
            _ingest_files(uploaded)

    st.markdown("<hr class=\"sidebar-divider\">", unsafe_allow_html=True)

    # ── DB Status ──
    st.markdown("<div class=\"sidebar-section-title\">Database Status</div>", unsafe_allow_html=True)
    chunk_count = _get_chunk_count()
    if st.session_state.processing:
        st.markdown(
            '<span class="status-pill loading"><span class="status-dot loading"></span>Processing...</span>',
            unsafe_allow_html=True,
        )
    elif chunk_count > 0:
        st.session_state.db_ready = True
        st.markdown(
            f'<span class="status-pill ready"><span class="status-dot ready"></span>{chunk_count} chunks indexed</span>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<span class="status-pill empty"><span class="status-dot empty"></span>No data yet</span>',
            unsafe_allow_html=True,
        )

    # ── Cache status ──
    st.markdown("<div class=\"sidebar-section-title\">Cache (Redis)</div>", unsafe_allow_html=True)
    if REDIS_AVAILABLE:
        st.markdown(
            '<span class="status-pill ready"><span class="status-dot ready"></span>Connected</span>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<span class="status-pill empty"><span class="status-dot empty"></span>Offline \u2014 cache disabled</span>',
            unsafe_allow_html=True,
        )

    # ── Gemini (Google) key status — required for embeddings ──
    st.markdown("<div class=\"sidebar-section-title\">Gemini (Embeddings)</div>", unsafe_allow_html=True)
    if GEMINI_READY:
        st.markdown(
            '<span class="status-pill ready"><span class="status-dot ready"></span>GOOGLE_API_KEY active</span>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<span class="status-pill empty"><span class="status-dot empty"></span>GOOGLE_API_KEY missing</span>',
            unsafe_allow_html=True,
        )
        st.caption("\u26a0\ufe0f Required for embeddings. Get one at aistudio.google.com/app/apikey")

    # ── Groq key status ──
    st.markdown("<div class=\"sidebar-section-title\">Groq (Chat LLM)</div>", unsafe_allow_html=True)
    if GROQ_API_KEY_1:
        st.markdown(
            '<span class="status-pill ready"><span class="status-dot ready"></span>KEY_1 active</span>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<span class="status-pill empty"><span class="status-dot empty"></span>KEY_1 missing</span>',
            unsafe_allow_html=True,
        )
    if GROQ_API_KEY_2:
        st.markdown(
            '<span class="status-pill ready"><span class="status-dot ready"></span>KEY_2 active (failover)</span>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            '<span class="status-pill empty"><span class="status-dot empty"></span>KEY_2 not configured</span>',
            unsafe_allow_html=True,
        )

    # ── Ingested files list ──
    if st.session_state.ingested_files:
        st.markdown("<hr class=\"sidebar-divider\">", unsafe_allow_html=True)
        st.markdown("<div class=\"sidebar-section-title\">Indexed Files</div>", unsafe_allow_html=True)
        for fname in st.session_state.ingested_files:
            st.markdown(
                f"<div class=\"file-item\"><span class=\"file-icon\">\u2705</span>{fname}</div>",
                unsafe_allow_html=True,
            )

    # ── Clear / Reset ──
    st.markdown("<hr class=\"sidebar-divider\">", unsafe_allow_html=True)
    col1, col2 = st.columns(2)
    with col1:
        if st.button("\U0001f5d1 Clear Chat", use_container_width=True):
            st.session_state.messages = []
            st.session_state.cache_hits = 0
            st.session_state.db_hits = 0
            st.rerun()
    with col2:
        if st.button("\u26a0 Reset DB", use_container_width=True):
            _reset_db()
            st.rerun()


# ═══════════════════════════════════════════════════════════════════════════════
#  CHAT AREA
# ═══════════════════════════════════════════════════════════════════════════════

# Welcome card + live stats when no messages yet
if not st.session_state.messages:
    st.markdown(
        """
        <div class="welcome-card">
            <span class="welcome-icon">\U0001f4da</span>
            <h3>Start a conversation</h3>
            <p>Upload your <span class="kbd">.md</span> files using the sidebar,
            click <span class="kbd">\u26a1 Ingest Files</span>, then ask anything
            about your documents.</p>
            <div class="welcome-hint-row">
                <span class="welcome-hint">
                    <span class="hint-dot" style="background: var(--cache);"></span>
                    Cache = instant
                </span>
                <span class="welcome-hint">
                    <span class="hint-dot" style="background: var(--database);"></span>
                    Database = retrieved
                </span>
                <span class="welcome-hint">
                    <span class="hint-dot" style="background: var(--accent);"></span>
                    Dual Groq keys
                </span>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
else:
    # Live stats row above the chat
    total = len([m for m in st.session_state.messages if m["role"] == "assistant"])
    st.markdown(
        f"""
        <div class="stat-row">
            <div class="stat-card">
                <div class="stat-label">Total Replies</div>
                <div class="stat-value">{total}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">\u26a1 Cache Hits</div>
                <div class="stat-value cache">{st.session_state.cache_hits}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">\U0001f5c4\ufe0f DB Hits</div>
                <div class="stat-value database">{st.session_state.db_hits}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

# Render chat history with source badges
for msg in st.session_state.messages:
    avatar = "\U0001f9e0" if msg["role"] == "assistant" else "\U0001f464"
    with st.chat_message(msg["role"], avatar=avatar):
        st.markdown(msg["content"])
        # Show source badge only on assistant messages that have a source set
        if msg["role"] == "assistant" and msg.get("source"):
            st.markdown(_source_badge_html(msg["source"]), unsafe_allow_html=True)

# Chat input
if prompt := st.chat_input("Ask anything about your documents\u2026"):
    # Add user message
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user", avatar="\U0001f464"):
        st.markdown(prompt)

    # Generate assistant answer
    with st.chat_message("assistant", avatar="\U0001f9e0"):
        if not GROQ_READY:
            answer = (
                "\u26a0\ufe0f **No Groq API keys configured.**\n\n"
                "Set `GROQ_API_KEY_1` (and optionally `GROQ_API_KEY_2` for failover) "
                "in your `.env` file, then restart the app."
            )
            st.markdown(answer)
            st.markdown(_source_badge_html("system"), unsafe_allow_html=True)
            st.session_state.messages.append(
                {"role": "assistant", "content": answer, "source": "system"}
            )
        elif not GEMINI_READY:
            answer = (
                "\u26a0\ufe0f **GOOGLE_API_KEY is missing.**\n\n"
                "Embeddings use Google Gemini — Groq has no embeddings API.\n"
                "Add `GOOGLE_API_KEY=your_key` to your `.env` file.\n"
                "Get one at: https://aistudio.google.com/app/apikey"
            )
            st.markdown(answer)
            st.markdown(_source_badge_html("system"), unsafe_allow_html=True)
            st.session_state.messages.append(
                {"role": "assistant", "content": answer, "source": "system"}
            )
        elif not st.session_state.db_ready:
            answer = (
                "\u26a0\ufe0f **No knowledge base found.**\n\n"
                "Please upload some `.md` files in the sidebar and click "
                "**\u26a1 Ingest Files** first."
            )
            st.markdown(answer)
            st.markdown(_source_badge_html("system"), unsafe_allow_html=True)
            st.session_state.messages.append(
                {"role": "assistant", "content": answer, "source": "system"}
            )
        else:
            stream, source = _rag_answer(prompt)
            answer = st.write_stream(stream)
            st.markdown(_source_badge_html(source), unsafe_allow_html=True)

            # Update counters
            if source == "cache":
                st.session_state.cache_hits += 1
            elif source == "database":
                st.session_state.db_hits += 1

            st.session_state.messages.append(
                {"role": "assistant", "content": answer, "source": source}
            )


# ═══════════════════════════════════════════════════════════════════════════════
#  PROCESSING RERUN — runs the ingest pipeline when triggered
# ═══════════════════════════════════════════════════════════════════════════════
if st.session_state.processing:
    with st.sidebar:
        with st.spinner("Ingesting files\u2026"):
            try:
                _run_ingest(st.session_state.get("_pending_files", []))
            except Exception as e:
                st.error(f"Ingestion failed: {e}")
            finally:
                st.session_state.processing = False
                st.session_state.pop("_pending_files", None)
