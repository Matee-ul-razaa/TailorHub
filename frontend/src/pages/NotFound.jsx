import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

import { useLanguage } from "@/context/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t, isUrdu } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    React.createElement('div', { className: "d-flex flex-column align-items-center justify-content-center min-vh-100 px-3", style: { background: 'var(--th-body-bg)' }, dir: isUrdu ? 'rtl' : 'ltr' },
      React.createElement('div', { className: "text-center anim-scale-in", style: { maxWidth: 480 } },
        React.createElement('div', { className: "font-playfair fw-bold mb-4", style: { fontSize: '8rem', lineHeight: 1, color: 'rgba(230,126,34,0.15)' } }, "404"),
        React.createElement('h1', { className: "font-playfair fw-bold fs-3 mb-3" }, t('notfound.title')),
        React.createElement('p', { className: "text-muted mb-5" }, t('notfound.desc')),
        React.createElement('div', { className: "d-flex flex-column flex-sm-row align-items-center justify-content-center gap-3" },
          React.createElement(Button, { asChild: true },
            React.createElement(Link, { to: "/" }, t('notfound.home'))
          ),
          React.createElement(Button, { variant: "outline", asChild: true },
            React.createElement(Link, { to: "/catalog" }, t('notfound.catalog'))
          ),
        )
      )
    )
  );
};

export default NotFound;
