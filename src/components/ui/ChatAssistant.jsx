import React, { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

const ChatAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi! I'm your TailorHub assistant. How can I help you today?", isBot: true }
  ]);
  const [input, setInput] = useState("");

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // Add user message
    const newMessages = [...messages, { text: input, isBot: false }];
    setMessages(newMessages);
    setInput("");

    // Simulate bot typing and reply
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        text: "Thanks for reaching out! Our team is currently busy, but we've received your message. You can track your orders or upload a photo to get AI recommendations in the meantime.", 
        isBot: true 
      }]);
    }, 1000);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className={`btn btn-accent rounded-circle shadow-lg d-flex align-items-center justify-content-center anim-fade-up ${isOpen ? 'd-none' : ''}`}
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          width: '60px', 
          height: '60px', 
          zIndex: 1050,
          transition: 'transform 0.3s ease',
          transform: isOpen ? 'scale(0)' : 'scale(1)'
        }}
      >
        <MessageCircle size={28} />
      </button>

      {/* Chat Window */}
      <div 
        className={`th-card-static p-0 shadow-lg d-flex flex-column ${isOpen ? 'show' : ''}`}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '350px',
          height: '500px',
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 100px)',
          zIndex: 1050,
          transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div className="bg-accent text-white p-3 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <MessageCircle size={20} />
            <h6 className="mb-0 fw-bold">TailorHub Support</h6>
          </div>
          <button className="btn btn-link text-white p-0" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-grow-1 p-3 overflow-auto" style={{ background: '#f8f9fa' }}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`d-flex mb-3 ${msg.isBot ? 'justify-content-start' : 'justify-content-end'}`}>
              <div 
                className={`p-2 px-3 rounded-4 ${msg.isBot ? 'bg-white border text-dark' : 'bg-accent text-white'}`}
                style={{ maxWidth: '80%', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 bg-white border-top d-flex gap-2">
          <input 
            type="text" 
            className="form-control form-control-sm rounded-pill px-3 bg-light border-0" 
            placeholder="Type a message..." 
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button type="submit" className="btn btn-accent btn-sm rounded-circle d-flex align-items-center justify-content-center p-2" disabled={!input.trim()}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatAssistant;
