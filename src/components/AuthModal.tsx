import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  X,
  CheckCircle2,
  Heart
} from 'lucide-react';
import { authApi } from '../services/api';
import { UserProfile } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim()) {
          throw new Error('Please enter your email address.');
        }
        const res = await authApi.login(email.trim(), password || 'default_pass_2026');
        onAuthSuccess(res.user);
        onClose();
      } else {
        if (!name.trim()) {
          throw new Error('Please enter your name.');
        }
        if (!email.trim() || !email.includes('@')) {
          throw new Error('Please enter a valid email address.');
        }
        const res = await authApi.register({
          name: name.trim(),
          email: email.trim(),
          password: password || 'default_pass_2026',
          role: 'USER'
        });
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
    >
      <div
        id="auth-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-200 text-[#1F2421]"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 border-b border-gray-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#15803D]">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <h2 id="auth-modal-title" className="text-base font-bold text-gray-900 leading-tight">
              {mode === 'login' ? 'Patient Account Sign In' : 'Create New Patient Account'}
            </h2>
            <p className="text-xs text-gray-500">
              {mode === 'login'
                ? 'Sign in to access your personal health telemetry'
                : 'Register a private account for health screenings'}
            </p>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="mt-4 flex rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
              mode === 'login' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
              mode === 'register' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Register New
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-gray-700">Full Name</label>
              <div className="relative mt-1">
                <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Maya Patel"
                  className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700">Email Address</label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="e.g. user@swasthai.com"
                className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700">Password</label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803D] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#166534] transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Account' : 'Create Account & Continue'}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
