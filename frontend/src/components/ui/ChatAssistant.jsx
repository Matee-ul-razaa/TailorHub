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
      { label: "💬 WhatsApp Alteration Help", link: "https://wa.me/923157855767?text=Hi%20TailorHub%2C%20I%20need%20assistance%20with%20alteration" }
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
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open TailorHub AI Assistant"
        className="rounded-circle shadow-lg d-flex align-items-center justify-content-center position-fixed"
        style={{
          bottom: '24px',
          right: '24px',
          width: '62px',
          height: '62px',
          zIndex: 1050,
          background: 'linear-gradient(135deg, #c5a059 0%, #aa8033 100%)',
          color: '#fff',
          border: '2px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 8px 28px rgba(197, 160, 89, 0.45)',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isOpen ? 'scale(0)' : 'scale(1)',
          pointerEvents: isOpen ? 'none' : 'auto'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = isOpen ? 'scale(0)' : 'scale(1)'; }}
      >
        <MessageCircle size={28} strokeWidth={2.3} />
        {/* Unread indicator */}
        {hasUnread && (
          <span
            className="position-absolute top-0 start-100 translate-middle p-2 bg-danger border border-light rounded-circle"
            style={{ width: 14, height: 14 }}
          />
        )}
      </button>

      {/* Chat Window */}
      <div 
        className="shadow-2xl d-flex flex-column position-fixed"
        dir={isUrdu ? 'rtl' : 'ltr'}
        style={{
          bottom: '24px',
          right: '24px',
          width: '380px',
          height: '560px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 48px)',
          zIndex: 1060,
          borderRadius: '20px',
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(25px) scale(0.9)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          overflow: 'hidden',
          background: '#ffffff',
          border: '1px solid rgba(197, 160, 89, 0.35)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Header */}
        <div 
          className="p-3 text-white d-flex align-items-center justify-content-between"
          style={{ background: 'linear-gradient(135deg, #c5a059 0%, #8e6c27 100%)' }}
        >
          <div className="d-flex align-items-center gap-2">
            <div className="rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ background: 'rgba(255,255,255,0.2)', width: 36, height: 36 }}>
              <Scissors size={18} className="text-white" />
            </div>
            <div>
              <h6 className="mb-0 fw-bold" style={{ fontSize: '0.95rem' }}>
                {isUrdu ? 'ٹیلر ہب اسسٹنٹ' : 'TailorHub Assistant'}
              </h6>
              <div className="d-flex align-items-center gap-1 small" style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                <span className="rounded-circle bg-success d-inline-block" style={{ width: 7, height: 7 }} />
                <span>{isUrdu ? 'آن لائن • فوری جواب' : 'Online • Instant Support'}</span>
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="btn btn-sm btn-link text-white p-1 text-decoration-none"
              onClick={handleClearHistory}
              title={isUrdu ? 'ہسٹری صاف کریں' : 'Clear Chat'}
              style={{ opacity: 0.8 }}
            >
              <Trash2 size={16} />
            </button>
            <button 
              type="button" 
              className="btn btn-sm btn-link text-white p-1 text-decoration-none" 
              onClick={() => setIsOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick FAQ Chips Bar */}
        <div 
          className="px-3 py-2 border-bottom d-flex gap-2 overflow-auto"
          style={{ background: '#fcfaf5', scrollbarWidth: 'none' }}
        >
          {quickQuestions.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => processQuery(q.query)}
              className="btn btn-sm rounded-pill flex-shrink-0 text-nowrap py-1 px-3"
              style={{
                fontSize: '0.75rem',
                border: '1px solid rgba(197, 160, 89, 0.4)',
                background: '#ffffff',
                color: '#8e6c27',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#c5a059';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#8e6c27';
              }}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Messages Scroll Area */}
        <div 
          className="flex-grow-1 p-3 overflow-auto d-flex flex-column gap-3" 
          style={{ background: '#f8f9fa' }}
        >
          {messages.map((msg, idx) => (
            <div key={idx} className={`d-flex flex-column ${msg.isBot ? 'align-items-start' : 'align-items-end'}`}>
              <div 
                className={`p-3 rounded-4 position-relative ${
                  msg.isBot 
                    ? 'bg-white border text-dark shadow-xs' 
                    : 'text-white shadow-sm'
                }`}
                style={{
                  maxWidth: '85%',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                  background: msg.isBot ? '#ffffff' : 'linear-gradient(135deg, #c5a059 0%, #aa8033 100%)',
                  borderColor: msg.isBot ? 'rgba(0,0,0,0.08)' : 'transparent',
                  borderBottomLeftRadius: msg.isBot ? '4px' : '16px',
                  borderBottomRightRadius: msg.isBot ? '16px' : '4px',
                  whiteSpace: 'pre-line'
                }}
              >
                {msg.text}

                {/* Render interactive action buttons if present */}
                {msg.isBot && msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 pt-2 border-top d-flex flex-wrap gap-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                    {msg.actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => handleActionClick(act)}
                        className="btn btn-sm rounded-pill d-inline-flex align-items-center gap-1 px-3 py-1"
                        style={{
                          fontSize: '0.78rem',
                          background: 'rgba(197, 160, 89, 0.12)',
                          color: '#9d7c36',
                          border: '1px solid rgba(197, 160, 89, 0.35)',
                          fontWeight: 600,
                        }}
                      >
                        <span>{act.label}</span>
                        {act.link?.startsWith('http') ? <ExternalLink size={12} /> : <ArrowRight size={12} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="small text-muted mt-1 px-1" style={{ fontSize: '0.68rem', opacity: 0.7 }}>
                {msg.time}
              </span>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="d-flex align-items-center gap-2 p-2 px-3 rounded-4 bg-white border" style={{ width: 'fit-content', borderColor: 'rgba(0,0,0,0.08)' }}>
              <Scissors size={14} className="text-accent anim-spin" />
              <div className="d-flex gap-1">
                <span className="bg-secondary rounded-circle" style={{ width: 6, height: 6, animation: 'pulse 1s infinite' }} />
                <span className="bg-secondary rounded-circle" style={{ width: 6, height: 6, animation: 'pulse 1s infinite 0.2s' }} />
                <span className="bg-secondary rounded-circle" style={{ width: 6, height: 6, animation: 'pulse 1s infinite 0.4s' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 bg-white border-top d-flex gap-2 align-items-center">
          <input 
            type="text" 
            className="form-control rounded-pill px-3 py-2 bg-light border-0" 
            placeholder={isUrdu ? "اپنا سوال یہاں لکھیں..." : "Type your question here..."} 
            value={input}
            onChange={e => setInput(e.target.value)}
            style={{ fontSize: '0.85rem' }}
          />
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="btn rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              width: '40px',
              height: '40px',
              background: input.trim() ? 'linear-gradient(135deg, #c5a059 0%, #aa8033 100%)' : '#e5e7eb',
              color: '#ffffff',
              border: 'none',
              cursor: input.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s ease'
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatAssistant;
