import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    React.createElement('div', { className: "d-flex flex-column align-items-center justify-content-center min-vh-100 px-3", style: { background: 'var(--th-body-bg)' } },
      React.createElement('div', { className: "text-center anim-scale-in", style: { maxWidth: 480 } },
        React.createElement('div', { className: "font-playfair fw-bold mb-4", style: { fontSize: '8rem', lineHeight: 1, color: 'rgba(230,126,34,0.15)' } }, "404"),
        React.createElement('h1', { className: "font-playfair fw-bold fs-3 mb-3" }, "Page Not Found"),
        React.createElement('p', { className: "text-muted mb-5" }, "The page you're looking for doesn't exist or has been moved."),
        React.createElement('div', { className: "d-flex flex-column flex-sm-row align-items-center justify-content-center gap-3" },
          React.createElement(Link, { to: "/", className: "btn btn-accent px-4 py-2" }, "Go to Home"),
          React.createElement(Link, { to: "/catalog", className: "btn btn-outline-secondary px-4 py-2" }, "Browse Catalog"),
        )
      )
    )
  );
};

export default NotFound;
