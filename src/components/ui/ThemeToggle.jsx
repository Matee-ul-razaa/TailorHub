import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-link nav-link p-2 d-flex align-items-center justify-content-center rounded-circle"
      style={{ width: '40px', height: '40px', color: 'inherit', border: 'none', background: 'transparent' }}
      aria-label="Toggle theme"
    >
      {theme === 'light-theme' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};

export default ThemeToggle;
