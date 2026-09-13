import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 border-0 bg-transparent"
      style={{ color: 'var(--th-primary)', lineHeight: 1, cursor: 'pointer' }}
      aria-label="Toggle theme"
    >
      {theme === 'light-theme' ? <Moon size={20} color="currentColor" /> : <Sun size={20} color="currentColor" />}
    </button>
  );
};

export default ThemeToggle;
