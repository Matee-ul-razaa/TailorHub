import json
import logging
import re
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from .config import settings

logger = logging.getLogger("tailorhub.chat")

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessage(BaseModel):
    sender: str # "user" or "bot"
    text: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class ActionButton(BaseModel):
    label: str
    link: Optional[str] = None
    action: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    actions: Optional[List[ActionButton]] = []

# ── Knowledge Base for Instant Matching ──
FAQ_RULES = [
    {
        "keywords": [r"\btrack\b", r"\border\b", r"\bkahan\b", r"\bstatus\b", r"\bpohanch\b", r"\btrck\b", r"آرڈر", r"ٹریک"],
        "reply": "Aap apna order asani se track kar sakte hain! Bas apna Order ID (jaise ORD-88FE044F) hamare Tracking page par daalein ya neeche diye gaye button par click karein.",
        "actions": [{"label": "📦 Track Order Now", "link": "/tracking"}]
    },
    {
        "keywords": [r"\bnaap\b", r"\bmeasurement\b", r"\bsize\b", r"\bfitting\b", r"\blambai\b", r"\bcollar\b", r"پیمائش", r"ناپ"],
        "reply": "TailorHub par naap dene ke 3 aasan tareeqe hain:\n1. Hamari visual guide dekh kar apna naap profile mein save karein.\n2. Standard sizes (S, M, L, XL, XXL) muntakhib karein.\n3. Hamare Master Tailor ka Home Visit book karein jo ghar aa kar accurate naap lenge!",
        "actions": [
            {"label": "📏 Measurements Page", "link": "/measurements"},
            {"label": "👔 View Catalog", "link": "/catalog"}
        ]
    },
    {
        "keywords": [r"\bdelivery\b", r"\btime\b", r"\bdin\b", r"\bdays\b", r"\bcharges\b", r"\bshipping\b", r"\bkab\b", r"ڈیلیوری", r"وقت"],
        "reply": "Hamari delivery details:\n• Bespoke Stitching & Quality Inspection: 5 se 7 working days.\n• Delivery Charges: Flat Rs. 250 (Pore Pakistan mein).\n• Rs. 10,000 se zyadah ke orders par FREE Delivery di jaati hai!",
        "actions": [{"label": "🛍️ Explore Collection", "link": "/catalog"}]
    },
    {
        "keywords": [r"\bpayment\b", r"\badvance\b", r"\bcod\b", r"\bcard\b", r"\bkhata\b", r"\bpaise\b", r"\bstripe\b", r"ادائیگی", r"ایڈوانس", r"پیسے"],
        "reply": "Adaiygi ke tareeqe:\n• 50% Advance (Stripe Card ya Bank Transfer) taake cutting masters kapra katna shuru kar sakein.\n• Baqaya 50% Delivery ke waqt Cash on Delivery (COD) ya online.\n• Registered regular customers ke liye Khata ledger system bhi mojud hai.",
        "actions": [{"label": "💳 View Invoices", "link": "/invoices"}]
    },
    {
        "keywords": [r"\balter\b", r"\breturn\b", r"\brefund\b", r"\btang\b", r"\bkhula\b", r"\bkharab\b", r"الٹریشن", r"ریفنڈ", r"وارنٹی"],
        "reply": "Hamari **7-Day Free Alteration Guarantee** hai!\nAgar suit ki fitting mein koi bhi kami peshi ho, toh delivery ke 7 din ke andar batayein. Hamara rider suit wapas le kar aayega aur Master Tailor bilkul muft alter karke wapas pohchayega.",
        "actions": [{"label": "💬 WhatsApp Support", "link": "https://wa.me/923157855767"}]
    },
    {
        "keywords": [r"\bvto\b", r"\btry\s*on\b", r"\bvirtual\b", r"\bskin\b", r"\bcolor\b", r"\bcamera\b", r"ٹرائی آن", r"ورچوئل"],
        "reply": "Hamari AI Virtual Try-On technology se aap kisi bhi suit ko order karne se pehle apni photo par pehan kar dekh sakte hain, aur Skin Tone Analyzer aap ke rang ke mutabiq best suit colors recommend karta hai!",
        "actions": [
            {"label": "✨ Virtual Try-On", "link": "/virtual-try-on"},
            {"label": "🎨 Skin Tone Analysis", "link": "/skin-tone"}
        ]
    },
    {
        "keywords": [r"\bprice\b", r"\brate\b", r"\bcost\b", r"\bkitne\b", r"\bshikayat\b", r"\bsuit\b", r"قیمت", r"ریٹ"],
        "reply": "Hamari starting prices:\n• Bespoke Shalwar Kameez: Rs. 4,500 se shuru\n• Prince Coats & Waistcoats: Rs. 14,500 se shuru\n• 2-Piece & 3-Piece Pent Coats: Rs. 18,000 se shuru\nHar suit mein high-grade fabric aur expert master stitching shamil hai.",
        "actions": [{"label": "👔 View Catalog", "link": "/catalog"}]
    },
    {
        "keywords": [r"\bhelp\b", r"\bcontact\b", r"\brabta\b", r"\bphone\b", r"\bcall\b", r"\bwhatsapp\b", r"\bnumber\b", r"رابطہ", r"نمبر"],
        "reply": "Aap hamari support team se direct rabta kar sakte hain:\n• WhatsApp / Call: +92 315 7855767\n• Email: support@tailorhub.pk\n• Timings: 10:00 AM - 10:00 PM (Monday to Saturday)",
        "actions": [{"label": "💬 Chat on WhatsApp", "link": "https://wa.me/923157855767"}]
    },
    {
        "keywords": [r"\bhi\b", r"\bhello\b", r"\bsalam\b", r"\baoa\b", r"\bhey\b", r"\bkese\b", r"\bkaise\b", r"سلام", r"ہیلو"],
        "reply": "Assalam-o-Alaikum! TailorHub Assistant mein khush aamdeed ✂️\nMain aap ki custom stitching, naap, order tracking ya designs se mutalliq kya madad kar sakta hoon?",
        "actions": [
            {"label": "📦 Track Order", "link": "/tracking"},
            {"label": "📏 Measurements", "link": "/measurements"},
            {"label": "✨ Virtual Try-On", "link": "/virtual-try-on"}
        ]
    }
]

def _match_faq(message: str) -> Optional[dict]:
    msg_clean = message.lower()
    for rule in FAQ_RULES:
        for kw in rule["keywords"]:
            if re.search(kw, msg_clean, re.IGNORECASE):
                return {"reply": rule["reply"], "actions": rule["actions"]}
    return None

SYSTEM_INSTRUCTION = """You are TailorHub AI Assistant, an elegant, friendly customer support representative for TailorHub — Pakistan's premier bespoke tailoring house.
TailorHub stitches custom luxury menswear: Suits, Pent Coats, Prince Coats, Sherwanis, and Bespoke Shalwar Kameez.
Key facts:
- Delivery takes 5-7 business days across Pakistan. Shipping is Rs. 250, but FREE on orders above Rs. 10,000.
- Payment terms: 50% advance via Stripe card or bank transfer to begin cutting; remaining 50% on Cash on Delivery.
- 7-Day Free Alterations Guarantee: Any fitting issue is altered for free within 7 days of delivery.
- Measurements: User can enter sizes online (/measurements), pick standard sizes, or request a Master Tailor home visit.
- AI Features: Virtual Try-On (/virtual-try-on) and Skin Tone Analysis (/skin-tone).
- Support Phone/WhatsApp: +92 315 7855767, Email: support@tailorhub.pk.

Guidelines:
1. Always be polite, warm, and helpful.
2. Reply in the user's language (English, Urdu, or Roman Urdu).
3. Keep answers concise (2 to 4 sentences).
4. If relevant, suggest visiting /tracking, /catalog, /measurements, or contacting WhatsApp.
"""

@router.post("", response_model=ChatResponse)
def handle_chat_message(payload: ChatRequest):
    user_msg = payload.message.strip()
    if not user_msg:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty")

    # 1. Fast, reliable rule-based match first
    matched = _match_faq(user_msg)
    if matched:
        return ChatResponse(reply=matched["reply"], actions=matched["actions"])

    # 2. Try Gemini direct if configured
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = f"{SYSTEM_INSTRUCTION}\n\nCustomer Message: {user_msg}\nAssistant Reply:"
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=300,
                    temperature=0.7,
                )
            )
            if resp and resp.text:
                return ChatResponse(
                    reply=resp.text.strip(),
                    actions=[
                        {"label": "📦 Track Order", "link": "/tracking"},
                        {"label": "💬 WhatsApp Support", "link": "https://wa.me/923157855767"}
                    ]
                )
        except Exception as e:
            logger.warning(f"[CHAT] Gemini call failed: {e}")

    # 3. Fallback answer
    return ChatResponse(
        reply="Shukriya aap ke sawal ka! Hamari team aap ki mukammal rehnumai ke liye tayar hai. Aap apna order track kar sakte hain, naap save kar sakte hain ya direct hamare WhatsApp number (+92 315 7855767) par rabta kar sakte hain.",
        actions=[
            {"label": "📦 Track Order", "link": "/tracking"},
            {"label": "📏 Measurements", "link": "/measurements"},
            {"label": "💬 WhatsApp Support", "link": "https://wa.me/923157855767"}
        ]
    )
