import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AIMeasurements from './AIMeasurements';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import React from 'react';

// Mocks
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/components/layout/Layout', () => ({
  default: ({ children }) => React.createElement('div', { 'data-testid': 'layout' }, children),
}));

vi.mock('lucide-react', () => ({
  Scissors: () => React.createElement('span', null, '✂️'),
  User: () => React.createElement('span', null, '👤'),
  Loader2: () => React.createElement('span', null, '⏳'),
  Camera: () => React.createElement('span', null, '📷'),
  Upload: () => React.createElement('span', null, '⬆️'),
  Sparkles: () => React.createElement('span', null, '✨'),
  AlertTriangle: () => React.createElement('span', null, '⚠️'),
  CheckCircle2: () => React.createElement('span', null, '✅'),
  ArrowRight: () => React.createElement('span', null, '➡️'),
  RotateCcw: () => React.createElement('span', null, '🔄'),
  Ruler: () => React.createElement('span', null, '📏'),
  X: () => React.createElement('span', null, '❌'),
  Info: () => React.createElement('span', null, 'ℹ️'),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
  getAuthToken: vi.fn().mockReturnValue('test-token'),
  clearAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
}));

const MockAIMeasurements = () => {
  return React.createElement(
    BrowserRouter,
    null,
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(
        AuthProvider,
        null,
        React.createElement(AIMeasurements, null)
      )
    )
  );
};

describe('AIMeasurements page', () => {
  beforeEach(() => {
    localStorage.setItem('tailorhub-language', 'en');
    vi.clearAllMocks();
  });

  it('renders the layout, header and instructions', () => {
    render(React.createElement(MockAIMeasurements));
    
    // Check layout renders
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    
    // Check main title is rendered
    expect(screen.getByText(/AI Body Measurement/i)).toBeInTheDocument();
    
    // Check verification banner is visible
    expect(screen.getByText(/AI Estimated — Verify Before Saving/i)).toBeInTheDocument();
    
    // Check photo upload slots exist
    expect(screen.getByText(/Upload front view/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload side view/i)).toBeInTheDocument();
  });

  it('renders optional calibration inputs', () => {
    render(React.createElement(MockAIMeasurements));
    
    expect(screen.getByText(/Optional — Improve Accuracy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Gender/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Height/i)).toBeInTheDocument();
  });

  it('renders instructions on how it works', () => {
    render(React.createElement(MockAIMeasurements));
    
    expect(screen.getByText(/How It Works/i)).toBeInTheDocument();
    expect(screen.getByText(/Take Two Photos/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Review & Save/i)).toBeInTheDocument();
  });
});
