import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle, X, Send, Sparkles, Scissors, Trash2,
  ArrowRight, ExternalLink, Package, Ruler, Truck,
  CreditCard, RefreshCw, PhoneCall, HelpCircle, Bot
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { apiRequest } from '@/lib/api';

const QUICK_QUESTIONS_EN = [
  { id: 'track', label: '📦 Track Order', query: 'How do I track my order?' },
  { id: 'measure', label: '📏 Sizing & Measurements', query: 'How do measurements work?' },
  { id: 'delivery', label: '⏱️ Delivery Time & Cost', query: 'What is the delivery time and cost?' },
  { id: 'payment', label: '💳 Payment & Advance', query: 'What are the payment options and advance requirements?' },
  { id: 'alteration', label: '✂️ 7-Day Alteration Policy', query: 'What is your alteration and fitting guarantee?' },
  { id: 'vto', label: '✨ Virtual Try-On & AI', query: 'How does Virtual Try-On work?' },
  { id: 'support', label: '📞 WhatsApp / Call Support', query: 'How can I contact human customer support?' },
];

const QUICK_QUESTIONS_UR = [
  { id: 'track', label: '📦 آرڈر ٹریکنگ', query: 'میرا آرڈر کہاں ہے اور کیسے ٹریک کروں؟' },
  { id: 'measure', label: '📏 ناپ اور سائزنگ', query: 'ناپ دینے کا طریقہ کیا ہے؟' },
  { id: 'delivery', label: '⏱️ ڈیلیوری کا وقت اور چارجز', query: 'سوٹس کتنے دنوں میں ڈیلیور ہوتے ہیں؟' },
  { id: 'payment', label: '💳 ادائیگی اور ایڈوانس', query: 'ادائیگی اور ایڈوانس کا طریقہ کیا ہے؟' },
  { id: 'alteration', label: '✂️ ۷ دن کی مفت الٹریشن', query: 'اگر سوٹ کی فٹنگ ٹھیک نہ ہو تو کیا کریں؟' },
  { id: 'vto', label: '✨ ورچوئل ٹرائی آن', query: 'ورچوئل ٹرائی آن کیسے کام کرتا ہے؟' },
  { id: 'support', label: '📞 کسٹمر سپورٹ سے رابطہ', query: 'ٹیلر ہب سپورٹ سے کیسے رابطہ کریں؟' },
];

// ── Client-side Knowledge Base for Instant Zero-Latency Answers ──
const CLIENT_KNOWLEDGE_BASE = [
  {
    regex: /\b(track|order|status|kahan|where is|tracing|deliver ho gya|pohanch|trck|آرڈر|ٹریک)\b/i,
    replyEn: "You can track your order live! Enter your Order ID (e.g. ORD-88FE044F) on our Tracking page to check live progress from cutting to stitching and delivery handover.",
    replyUr: "آپ اپنا آرڈر لائیو ٹریک کر سکتے ہیں! اپنا آرڈر نمبر (جیسے ORD-88FE044F) ہمارے ٹریکنگ پیج پر درج کریں تاکہ کٹنگ، سلائی اور ڈیلیوری کا لائیو اسٹیٹس معلوم ہو سکے۔",
    actions: [
      { label: "📦 Go to Order Tracking", link: "/tracking" }
    ]
  },
  {
    regex: /\b(naap|measurement|size|fitting|collar|lambai|kameez|waist|chest|پیمائش|ناپ)\b/i,
    replyEn: "TailorHub offers 3 easy ways to submit your measurements:\n1. Save custom measurements in your profile via our step-by-step visual guide.\n2. Choose standard sizes (S, M, L, XL, XXL) from the catalog.\n3. Book our Master Tailor home-visit for precision fitting at your doorstep!",
    replyUr: "ٹیلر ہب پر ناپ دینے کے ۳ آسان طریقے ہیں:\n۱. ہماری گائیڈ دیکھ کر اپنی پیمائشیں پروفائل میں محفوظ کریں۔\n۲. کیٹلاگ سے اسٹینڈرڈ سائز (S, M, L, XL, XXL) منتخب کریں۔\n۳. ہمارے ماسٹر درزی کا ہوم وزٹ بک کریں جو خود آ کر ناپ لیں گے!",
    actions: [
      { label: "📏 Measurements Page", link: "/measurements" },
      { label: "👔 View Catalog", link: "/catalog" }
    ]
  },
  {
    regex: /\b(delivery|time|kitne din|days|charges|shipping|kab milega|deliver|ڈیلیوری|وقت|کتنے دن)\b/i,
    replyEn: "Our delivery timeline & shipping terms:\n• Bespoke Crafting: 5 to 7 business days from cutting to finishing.\n• Shipping Cost: Flat Rs. 250 across all cities in Pakistan.\n• Free Delivery: On all orders above Rs. 10,000!",
    replyUr: "ہماری ڈیلیوری کی تفصیلات:\n• کسٹم سلائی اور فائنل فنشنگ: ۵ سے ۷ کام کے دن۔\n• ڈیلیوری چارجز: پورے پاکستان میں صرف ۲۵۰ روپے۔\n• ۱۰ ہزار روپے سے زائد کے آرڈرز پر مفت ڈیلیوری فراہم کی جاتی ہے!",
    actions: [
      { label: "🛍️ Explore Collection", link: "/catalog" }
    ]
  },
  {
    regex: /\b(payment|advance|cod|card|khata|paise|stripe|cash on delivery|ادائیگی|ایڈوانس|پیسے|بینک)\b/i,
    replyEn: "Our payment methods:\n• 50% Advance via Credit/Debit Card (Stripe) or Bank Transfer to commence bespoke cutting.\n• Remaining 50% balance on delivery (Cash on Delivery / COD).\n• Registered clients can also settle accounts via our transparent Khata ledger.",
    replyUr: "ادائیگی کے اختیارات:\n• کٹنگ شروع کرنے کے لیے ۵۰ فیصد ایڈوانس (آن لائن کارڈ یا بینک ٹرانسفر)۔\n• بقیہ ۵۰ فیصد رقم پارسل ملنے پر (Cash on Delivery)۔\n• رجسٹرڈ کسٹمرز کے لیے کھاتہ لیجر کی سہولت بھی دستیاب ہے۔",
    actions: [
      { label: "💳 View Invoices", link: "/invoices" }
    ]
  },
  {
    regex: /\b(alter|return|refund|tang|khula|kharab|warranty|exchange|الٹریشن|ریفنڈ|وارنٹی|واپسی)\b/i,
    replyEn: "We offer a 100% 7-Day Free Alteration Guarantee!\nIf your bespoke garment needs minor adjustments (tight, loose, or length tweaks), contact us within 7 days of delivery. Our rider will pick it up and our Master Tailor will alter it for free.",
    replyUr: "ہم ۷ دن کی مفت فٹنگ الٹریشن گارنٹی فراہم کرتے ہیں!\nاگر سوٹ کی فٹنگ میں کوئی بھی فرق ہو تو ڈیلیوری کے ۷ دن کے اندر بتائیں۔ ہمارا رائیڈر سوٹ لے کر جائے گا اور ماسٹر درزی مفت میں الٹریشن کر کے واپس پہنچائے گا۔",
    actions: [
      { label: "💬 WhatsApp Alteration Help", link: "https://wa.me/923284630780?text=Hi%20TailorHub%2C%20I%20need%20assistance%20with%20alteration" }
    ]
  },
  {
    regex: /\b(vto|try on|virtual|skin|color|camera|photo|رنگ|ورچوئل|ٹرائی آن)\b/i,
    replyEn: "With our AI Virtual Try-On, you can visualize how a suit looks on you before ordering! Plus, our Skin Tone Analyzer suggests the best fabric shades tailored to your personal complexion.",
    replyUr: "ہمارے AI ورچوئل ٹرائی آن سے آپ آرڈر کرنے سے پہلے سوٹ اپنے فوٹو پر پہن کر دیکھ سکتے ہیں، اور سکن ٹون اینالائزر آپ کے رنگ کے مطابق بہترین فیبرک کلرز تجویز کرتا ہے۔",
    actions: [
      { label: "✨ Try Virtual Try-On", link: "/virtual-try-on" },
      { label: "🎨 Skin Tone Analysis", link: "/skin-tone" }
    ]
  },
  {
    regex: /\b(price|rate|cost|kitne ka|suit rate|sherwani|pent coat|قیمت|ریٹ)\b/i,
    replyEn: "Our starting prices for bespoke tailoring:\n• Bespoke Shalwar Kameez: Starting from Rs. 4,500\n• Prince Coats & Waistcoats: Starting from Rs. 14,500\n• Luxury 2-Piece / 3-Piece Pent Coats: Starting from Rs. 18,000\nEvery piece includes premium fabric, imported inner lining, and master handcrafted stitching.",
    replyUr: "ہماری ابتدائی قیمتیں:\n• کسٹم شلوار قمیض: ۴،۵۰۰ روپے سے شروع\n• پرنس کوٹس اور واسکٹ: ۱۴،۵۰۰ روپے سے شروع\n• پینٹ کوٹ (۲ اور ۳ پیس): ۱۸،۰۰۰ روپے سے شروع\nہر لباس میں اعلیٰ کوالٹی فیبرک اور ماسٹر کٹنگ شامل ہے۔",
    actions: [
      { label: "👔 Browse Catalog", link: "/catalog" }
    ]
  },
  {
    regex: /\b(help|contact|rabta|phone|call|whatsapp|number|human|agent|support|رابطہ|نمبر|مدد)\b/i,
    replyEn: "Our customer support team is available to assist you directly:\n• WhatsApp / Call: +92 315 7855767\n• Email: support@tailorhub.pk\n• Operating Hours: Mon – Sat, 10:00 AM – 10:00 PM PKT",
    replyUr: "ہماری سپورٹ ٹیم کسٹمرز کی رہنمائی کے لیے ہمیشہ تیار ہے:\n• واٹس ایپ / فون کال: +92 315 7855767\n• ای میل: support@tailorhub.pk\n• اوقات: پیر تا ہفتہ، صبح ۱۰ بجے سے رات ۱۰ بجے تک",
    actions: [
      { label: "💬 Chat on WhatsApp", link: "https://wa.me/923157855767?text=Assalam%20o%20Alaikum%20TailorHub%20Support" }
    ]
  },
  {
    regex: /\b(hi|hello|salam|aoa|hey|kese|kaise ho|hal|اسلام|سلام|ہیلو)\b/i,
    replyEn: "Assalam-o-Alaikum! Welcome to TailorHub Support. How can I assist you with your tailoring, order status, or styling today?",
    replyUr: "وعلیکم السلام! ٹیلر ہب اسسٹنٹ میں خوش آمدید۔ آج میں سلائی، ناپ، یا آرڈر ٹریکنگ میں آپ کی کیا مدد کر سکتا ہوں؟",
    actions: [
      { label: "📦 Track Order", link: "/tracking" },
      { label: "📏 Measurements", link: "/measurements" },
      { label: "✨ Virtual Try-On", link: "/virtual-try-on" }
    ]
  }
];

const ChatAssistant = () => {
  const { language } = useLanguage();
  const isUrdu = language === 'ur';
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      text: isUrdu
        ? "خوش آمدید! میں ٹیلر ہب اسسٹنٹ ہوں۔ میں آپ کی کسٹم سلائی، آرڈر ٹریکنگ یا ناپ میں کس طرح مدد کر سکتا ہوں؟"
        : "Hello! I'm your TailorHub Assistant. How can I help you with your tailoring, orders, or measurements today?",
      isBot: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actions: [
        { label: isUrdu ? "📦 آرڈر ٹریکنگ" : "📦 Track Order", link: "/tracking" },
        { label: isUrdu ? "📏 ناپ دیں" : "📏 Measurements", link: "/measurements" },
        { label: isUrdu ? "✨ ورچوئل ٹرائی آن" : "✨ Virtual Try-On", link: "/virtual-try-on" },
      ]
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen, isTyping]);

  const quickQuestions = isUrdu ? QUICK_QUESTIONS_UR : QUICK_QUESTIONS_EN;

  // Process message and find smart answer
  const processQuery = async (queryText) => {
    if (!queryText.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Append user message
    const userMsg = { text: queryText, isBot: false, time: timeStr };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // 2. Client-side rule matching first for instant high-confidence response
    const matchedRule = CLIENT_KNOWLEDGE_BASE.find(rule => rule.regex.test(queryText));

    if (matchedRule) {
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          {
            text: isUrdu ? matchedRule.replyUr : matchedRule.replyEn,
            isBot: true,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actions: matchedRule.actions
          }
        ]);
        if (!isOpen) setHasUnread(true);
      }, 500);
      return;
    }

    // 3. Fallback to Backend AI / Gemini API
    try {
      const data = await apiRequest('/api/chat', {
        method: 'POST',
        skipAuth: true,
        body: { message: queryText }
      });

      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          text: data?.reply || (isUrdu
            ? "آپ کے سوال کا شکریہ! اگر آپ کو فوری مدد درکار ہے تو آپ ہمارے واٹس ایپ نمبر پر بھی براہ راست رابطہ کر سکتے ہیں۔"
            : "Thank you for reaching out! For immediate personal guidance, our master tailoring team is also available via WhatsApp."),
          isBot: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: data?.actions || [
            { label: isUrdu ? "📦 آرڈر ٹریکنگ" : "📦 Track Order", link: "/tracking" },
            { label: "💬 WhatsApp Support", link: "https://wa.me/923157855767" }
          ]
        }
      ]);
    } catch {
      // Graceful offline/error fallback
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          text: isUrdu
            ? "ہمیں آپ کا پیغام موصول ہو گیا ہے۔ عام سوالات کے لیے آپ نیچے دیئے گئے بٹنز استعمال کر سکتے ہیں یا ہمارے واٹس ایپ پر رابطہ کریں۔"
            : "Thank you! You can choose one of the common topics below, or tap WhatsApp to talk directly with our support team.",
          isBot: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: [
            { label: isUrdu ? "📦 آرڈر ٹریکنگ" : "📦 Track Order", link: "/tracking" },
            { label: isUrdu ? "📏 ناپ اور سائز" : "📏 Measurements", link: "/measurements" },
            { label: "💬 WhatsApp Support", link: "https://wa.me/923157855767" }
          ]
        }
      ]);
    }

    if (!isOpen) setHasUnread(true);
  };

  const handleSend = (e) => {
    e.preventDefault();
    processQuery(input);
  };

  const handleActionClick = (action) => {
    if (!action?.link) return;
    if (action.link.startsWith('http')) {
      window.open(action.link, '_blank', 'noopener,noreferrer');
    } else {
      navigate(action.link);
      setIsOpen(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        text: isUrdu
          ? "چیٹ ہسٹری صاف کر دی گئی ہے۔ میں آپ کی کیا مدد کر سکتا ہوں؟"
          : "Chat history cleared. How can I assist you with your bespoke tailoring today?",
        isBot: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: [
          { label: isUrdu ? "📦 آرڈر ٹریکنگ" : "📦 Track Order", link: "/tracking" },
          { label: isUrdu ? "📏 ناپ دیں" : "📏 Measurements", link: "/measurements" },
        ]
      }
    ]);
  };

  return (
    <>
      {/* ── Keyframe Animations ── */}
      <style>{`
        @keyframes chatBotPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes chatTypingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .chat-chip-btn {
          padding: 6px 14px;
          border-radius: 9999px;
          border: 1px solid rgba(197, 160, 89, 0.35);
          background: #ffffff;
          color: #7d591b;
          font-size: 0.76rem;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .chat-chip-btn:hover {
          background: #fcf7ed;
          border-color: #c5a059;
          color: #553b0e;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(197, 160, 89, 0.18);
        }
        .chat-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          border-radius: 12px;
          border: 1.5px solid rgba(197, 160, 89, 0.4);
          background: linear-gradient(135deg, #ffffff 0%, #fdfbf7 100%);
          color: #8c671a;
          font-size: 0.8rem;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 6px rgba(197, 160, 89, 0.08);
          gap: 8px;
        }
        .chat-action-btn:hover {
          background: linear-gradient(135deg, #c5a059 0%, #aa8033 100%);
          color: #ffffff !important;
          border-color: #aa8033;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(197, 160, 89, 0.35);
        }
        .chat-action-btn:hover svg {
          transform: translateX(2px);
          color: #ffffff;
        }
        .chat-scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .chat-messages-area::-webkit-scrollbar {
          width: 5px;
        }
        .chat-messages-area::-webkit-scrollbar-track {
          background: transparent;
        }
        .chat-messages-area::-webkit-scrollbar-thumb {
          background: rgba(197, 160, 89, 0.25);
          border-radius: 10px;
        }
        .chat-messages-area::-webkit-scrollbar-thumb:hover {
          background: rgba(197, 160, 89, 0.45);
        }
      `}</style>

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open TailorHub AI Assistant"
        className="rounded-circle d-flex align-items-center justify-content-center position-fixed"
        style={{
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          zIndex: 1050,
          background: 'linear-gradient(135deg, #d4af37 0%, #b88a44 100%)',
          color: '#ffffff',
          border: '2px solid rgba(255, 255, 255, 0.6)',
          boxShadow: '0 8px 24px rgba(184, 138, 68, 0.45)',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isOpen ? 'scale(0)' : 'scale(1)',
          pointerEvents: isOpen ? 'none' : 'auto'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08) translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = isOpen ? 'scale(0)' : 'scale(1)'; }}
      >
        <MessageCircle size={28} strokeWidth={2.2} />
        {/* Unread indicator */}
        {hasUnread && (
          <span
            className="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-white rounded-circle shadow-sm"
            style={{ width: 14, height: 14 }}
          />
        )}
      </button>

      {/* Chat Window Container */}
      <div
        className="position-fixed d-flex flex-column"
        dir={isUrdu ? 'rtl' : 'ltr'}
        style={{
          bottom: '24px',
          right: '24px',
          width: '390px',
          height: '590px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 40px)',
          zIndex: 1060,
          borderRadius: '22px',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(25px) scale(0.92)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          overflow: 'hidden',
          background: '#ffffff',
          border: '1px solid rgba(197, 160, 89, 0.3)',
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(197, 160, 89, 0.15)'
        }}
      >
        {/* ── 1. Luxury Dark & Gold Header ── */}
        <div
          className="px-3 py-3 text-white d-flex align-items-center justify-content-between flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #18191d 0%, #101114 100%)',
            borderBottom: '1px solid rgba(197, 160, 89, 0.25)'
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center shadow-sm"
              style={{
                width: 38,
                height: 38,
                background: 'linear-gradient(135deg, #d4af37 0%, #aa8033 100%)',
                color: '#fff',
                border: '1.5px solid rgba(255, 255, 255, 0.4)'
              }}
            >
              <Scissors size={18} strokeWidth={2.4} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-1">
                <span className="fw-bold" style={{ fontSize: '0.94rem', letterSpacing: '0.01em', color: '#f8fafc' }}>
                  {isUrdu ? 'ٹیلر ہب اسسٹنٹ' : 'TailorHub Assistant'}
                </span>
                <Sparkles size={13} style={{ color: '#d4af37' }} />
              </div>
              <div className="d-flex align-items-center gap-1 mt-0" style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                <span
                  className="rounded-circle d-inline-block"
                  style={{
                    width: 7,
                    height: 7,
                    backgroundColor: '#10b981',
                    boxShadow: '0 0 8px #10b981'
                  }}
                />
                <span>{isUrdu ? 'آن لائن • فوری رہنمائی' : 'Online • Instant Support'}</span>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="btn btn-sm text-white p-1 d-flex align-items-center justify-content-center rounded-circle"
              onClick={handleClearHistory}
              title={isUrdu ? 'ہسٹری صاف کریں' : 'Clear Chat'}
              style={{ width: 32, height: 32, background: 'rgba(255, 255, 255, 0.08)', border: 'none', transition: 'background 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
            >
              <Trash2 size={15} style={{ opacity: 0.85 }} />
            </button>
            <button
              type="button"
              className="btn btn-sm text-white p-1 d-flex align-items-center justify-content-center rounded-circle"
              onClick={() => setIsOpen(false)}
              aria-label="Close Chat"
              style={{ width: 32, height: 32, background: 'rgba(255, 255, 255, 0.08)', border: 'none', transition: 'background 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── 2. Quick FAQ Chips Bar (No Clipping, Comfortable Scrolling) ── */}
        <div
          className="px-3 py-2 border-bottom d-flex align-items-center gap-2 overflow-auto flex-shrink-0 chat-scrollbar-hide"
          style={{
            background: '#ffffff',
            scrollbarWidth: 'none',
            minHeight: '48px',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {quickQuestions.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => processQuery(q.query)}
              className="chat-chip-btn"
            >
              <span>{q.label}</span>
            </button>
          ))}
        </div>

        {/* ── 3. Messages Scroll Area ── */}
        <div
          className="flex-grow-1 p-3 overflow-auto d-flex flex-column gap-3 chat-messages-area"
          style={{
            background: '#f8fafc',
            minHeight: 0
          }}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`d-flex ${msg.isBot ? 'justify-content-start' : 'justify-content-end'}`}
            >
              <div
                className="d-flex gap-2"
                style={{
                  maxWidth: '88%',
                  flexDirection: msg.isBot ? 'row' : 'row-reverse'
                }}
              >
                {/* Bot Avatar Icon */}
                {msg.isBot && (
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-1 shadow-xs"
                    style={{
                      width: 28,
                      height: 28,
                      background: 'linear-gradient(135deg, #d4af37 0%, #aa8033 100%)',
                      color: '#ffffff'
                    }}
                  >
                    <Sparkles size={14} />
                  </div>
                )}

                {/* Message Bubble + Action Buttons + Timestamp */}
                <div className={`d-flex flex-column ${msg.isBot ? 'align-items-start' : 'align-items-end'}`}>
                  <div
                    className="p-3 position-relative"
                    style={{
                      borderRadius: msg.isBot ? '4px 18px 18px 18px' : '18px 18px 4px 18px',
                      background: msg.isBot
                        ? '#ffffff'
                        : 'linear-gradient(135deg, #c5a059 0%, #9e792b 100%)',
                      color: msg.isBot ? '#1e293b' : '#ffffff',
                      border: msg.isBot ? '1px solid rgba(226, 232, 240, 0.9)' : 'none',
                      boxShadow: msg.isBot
                        ? '0 2px 10px rgba(0, 0, 0, 0.04)'
                        : '0 4px 14px rgba(197, 160, 89, 0.3)',
                      fontSize: '0.865rem',
                      lineHeight: 1.58,
                      whiteSpace: 'pre-line',
                      wordBreak: 'break-word'
                    }}
                  >
                    {msg.text}

                    {/* Interactive Action Buttons */}
                    {msg.isBot && msg.actions && msg.actions.length > 0 && (
                      <div
                        className="mt-3 pt-2 d-flex flex-column gap-2"
                        style={{ borderTop: '1px solid #f1f5f9' }}
                      >
                        {msg.actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            type="button"
                            onClick={() => handleActionClick(act)}
                            className="chat-action-btn"
                          >
                            <span>{act.label}</span>
                            {act.link?.startsWith('http') ? (
                              <ExternalLink size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
                            ) : (
                              <ArrowRight size={13} style={{ flexShrink: 0, opacity: 0.8, transition: 'transform 0.2s' }} />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message Timestamp */}
                  <span
                    className="small mt-1 px-1"
                    style={{
                      fontSize: '0.68rem',
                      color: '#94a3b8',
                      letterSpacing: '0.02em'
                    }}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 shadow-xs"
                style={{
                  width: 28,
                  height: 28,
                  background: 'linear-gradient(135deg, #d4af37 0%, #aa8033 100%)',
                  color: '#ffffff'
                }}
              >
                <Sparkles size={14} />
              </div>
              <div
                className="p-3 bg-white border d-flex align-items-center gap-1"
                style={{
                  borderRadius: '4px 18px 18px 18px',
                  borderColor: 'rgba(226, 232, 240, 0.9)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  height: '38px'
                }}
              >
                <span
                  className="rounded-circle d-inline-block"
                  style={{
                    width: 6,
                    height: 6,
                    background: '#c5a059',
                    animation: 'chatTypingBounce 1.2s infinite ease-in-out'
                  }}
                />
                <span
                  className="rounded-circle d-inline-block"
                  style={{
                    width: 6,
                    height: 6,
                    background: '#c5a059',
                    animation: 'chatTypingBounce 1.2s infinite ease-in-out 0.2s'
                  }}
                />
                <span
                  className="rounded-circle d-inline-block"
                  style={{
                    width: 6,
                    height: 6,
                    background: '#c5a059',
                    animation: 'chatTypingBounce 1.2s infinite ease-in-out 0.4s'
                  }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── 4. Input Bar (Fixed at bottom) ── */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-white border-top d-flex gap-2 align-items-center flex-shrink-0"
          style={{ borderColor: 'rgba(226, 232, 240, 0.8)' }}
        >
          <input
            type="text"
            className="form-control rounded-pill px-3 py-2 border"
            placeholder={isUrdu ? "اپنا سوال یہاں لکھیں..." : "Type your question here..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            style={{
              fontSize: '0.86rem',
              background: '#f8fafc',
              borderColor: '#e2e8f0',
              outline: 'none',
              boxShadow: 'none'
            }}
            onFocus={e => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#c5a059';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(197, 160, 89, 0.15)';
            }}
            onBlur={e => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              width: '42px',
              height: '42px',
              background: input.trim()
                ? 'linear-gradient(135deg, #c5a059 0%, #9e792b 100%)'
                : '#e2e8f0',
              color: '#ffffff',
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: input.trim() ? '0 4px 12px rgba(197, 160, 89, 0.35)' : 'none'
            }}
            onMouseEnter={e => {
              if (input.trim()) e.currentTarget.style.transform = 'scale(1.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Send size={17} style={{ transform: isUrdu ? 'scaleX(-1)' : 'none' }} />
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatAssistant;
