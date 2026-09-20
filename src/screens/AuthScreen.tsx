import React, { useState } from 'react';
import {
  Heart,
  Lock,
  Mail,
  User,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { authApi } from '../services/api';
import { UserProfile } from '../types';

interface AuthScreenProps {
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountExistsNotice, setAccountExistsNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAccountExistsNotice(false);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim()) {
          throw new Error('Please enter your email address.');
        }
        if (!password) {
          throw new Error('Please enter your password.');
        }
        const res = await authApi.login(email.trim(), password);
        onAuthSuccess(res.user);
      } else {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (!email.trim() || !email.includes('@')) {
          throw new Error('Please enter a valid email address.');
        }
        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const res = await authApi.register({
          name: name.trim(),
          email: email.trim(),
          password,
          role: 'USER'
        });
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      if (err.code === 'ACCOUNT_EXISTS' || (err.message && err.message.includes('already exists'))) {
        setAccountExistsNotice(true);
        setErrorMessage('An account with this email already exists.');
      } else {
        setErrorMessage(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMessage(null);
    setAccountExistsNotice(false);
    setIsLoading(true);

    try {
      const res = await authApi.login('demo@swasthai.com', 'demo123');
      onAuthSuccess(res.user);
    } catch (err: any) {
      // Fallback try registering demo account if first boot
      try {
        const res = await authApi.register({
          name: 'Demo Test Patient',
          email: 'demo@swasthai.com',
          password: 'demo123',
          role: 'USER'
        });
        onAuthSuccess(res.user);
      } catch (regErr: any) {
        setErrorMessage('Could not initialize demo account. Please register a new account.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchToLoginWithEmail = () => {
    setMode('login');
    setAccountExistsNotice(false);
    setErrorMessage(null);
    setPassword('');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#FAF9F6] p-4 text-[#1F2421]">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-[#E8F5E9] text-[#15803D] shadow-sm mb-1">
            <Heart className="h-8 w-8 animate-pulse" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center justify-center gap-2">
            SwasthSense <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-bold border border-green-200">v2.0</span>
          </h1>
          <p className="text-xs text-[#15803D] font-bold max-w-xs mx-auto">
            Your Smart Health Checking Assistant
          </p>
        </div>

        {/* Card Container */}
        <div className="rounded-3xl bg-white p-6 shadow-xl border border-gray-200/80">
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-2xl bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setAccountExistsNotice(false);
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                mode === 'login'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setAccountExistsNotice(false);
              }}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                mode === 'register'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Account Exists UX Alert */}
          {accountExistsNotice && (
            <div className="mb-5 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Account Already Exists</span>
              </div>
              <p>An account with email <strong className="font-semibold">{email}</strong> has already been registered.</p>
              <button
                type="button"
                onClick={switchToLoginWithEmail}
                className="inline-flex items-center gap-1.5 font-bold text-[#15803D] hover:underline pt-1"
              >
                <span>Log in to this account instead</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && !accountExistsNotice && (
            <div className="mb-5 flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Maya Patel"
                    className="w-full rounded-2xl border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. user@swasthai.com"
                  className="w-full rounded-2xl border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 6 characters' : 'Enter your password'}
                  className="w-full rounded-2xl border border-gray-300 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-2xl border border-gray-300 py-2.5 pl-10 pr-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#15803D] focus:ring-2 focus:ring-green-100"
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15803D] py-3 text-xs font-bold text-white shadow-md hover:bg-[#166534] transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Processing Authentication...</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Sign In to Account' : 'Create Account & Continue'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Button */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 py-2.5 text-xs font-bold text-gray-700 transition-all"
            >
              <Activity className="h-3.5 w-3.5 text-[#15803D]" />
              <span>Explore Demo Account (Instant Login)</span>
            </button>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="text-center text-xs text-gray-500 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-gray-600 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-[#15803D]" />
            <span>Encrypted local session storage & complete data isolation</span>
          </div>
          <p className="text-[11px]">Non-diagnostic screening tool. Always consult a medical professional.</p>
        </div>
      </div>
    </div>
  );
};
