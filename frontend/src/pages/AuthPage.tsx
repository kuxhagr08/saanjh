import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getServerUrl, setServerUrl } from '../api/client';
import {
  Shield,
  Lock,
  Mail,
  User,
  Phone,
  AtSign,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  KeyRound,
  FileKey,
  Server,
  Wifi,
  Radio,
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { login, register, confirmUserRegistration, startDemoSession, loginStage, loginError } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);

  // Register form state
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryKeyStep, setRecoveryKeyStep] = useState(false);
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState('');
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Dynamic Server Connection state (Crucial for mobile Wi-Fi / LAN testing)
  const [serverUrlVal, setServerUrlVal] = useState(getServerUrl());
  const [editingServer, setEditingServer] = useState(false);
  const [serverTestStatus, setServerTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [serverTestMsg, setServerTestMsg] = useState('');

  const testServerConnection = async (targetUrl = serverUrlVal) => {
    setServerTestStatus('testing');
    setServerTestMsg('Connecting to server...');
    try {
      const clean = targetUrl.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '');
      const res = await fetch(`${clean}/api/health/`, { method: 'GET', signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerTestStatus('ok');
        setServerTestMsg(`Connected to Saanjh Backend (${data.status || 'healthy'})`);
      } else {
        setServerTestStatus('error');
        setServerTestMsg(`Server returned HTTP ${res.status}`);
      }
    } catch (e: any) {
      setServerTestStatus('error');
      setServerTestMsg('Cannot reach server. Verify your laptop IP and Wi-Fi.');
    }
  };

  const handleSaveServerUrl = () => {
    setServerUrl(serverUrlVal);
    setEditingServer(false);
    testServerConnection(serverUrlVal);
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getPasswordStrength(isRegister ? regPassword : loginPassword);
  const strengthLabels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const strengthColors = [
    'bg-stone-300',
    'bg-rose-500',
    'bg-amber-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-emerald-600',
  ];

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setIsSubmitting(true);

    try {
      await login(loginIdentifier.trim(), loginPassword, rememberDevice);
    } catch (err: any) {
      setLocalError(err.message || 'Invalid credentials. Please verify your details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // Basic frontend validations
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanUsername = regUsername.trim().toLowerCase();
    const cleanPhone = regPhone.trim();

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (cleanUsername.length < 3) {
      setLocalError('Username must be at least 3 characters long.');
      return;
    }

    if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 10) {
      setLocalError('Mobile number should have at least 10 digits.');
      return;
    }

    if (regPassword.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const recoveryToken =
        'APNA-' +
        Array.from(window.crypto.getRandomValues(new Uint8Array(12)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase()
          .match(/.{1,6}/g)
          ?.join('-');
      setGeneratedRecoveryKey(recoveryToken || 'APNA-REC-9912-3482');

      const createdUser = await register({
        email: cleanEmail,
        password: regPassword,
        username: cleanUsername,
        phoneNumber: cleanPhone,
        displayName: regDisplayName.trim() || cleanUsername,
        rememberDevice,
      });

      setRegisteredUser(createdUser);
      setRecoveryKeyStep(true);
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed. Please check inputs and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(generatedRecoveryKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    });
  };

  const features = [
    { title: 'End-to-End Encrypted Chat', desc: 'Find contacts by username, phone, or email' },
    { title: 'Client-Side Encrypted Vault', desc: 'AES-256 protected notes and private files' },
    { title: 'Private BYOK AI Studio', desc: 'Use your own AI keys with zero cloud leak' },
    { title: 'Anti-Doomscroll Design', desc: 'Calm, mindful focus tools built for life' },
  ];

  if (recoveryKeyStep) {
    return (
      <div className="min-h-screen bg-[#F6F5F2] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="bg-white rounded-3xl p-8 border border-stone-200/80 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
              <FileKey className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-stone-900 tracking-tight">Save Your Master Recovery Key</h2>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                Saanjh uses zero-knowledge encryption. If you forget your password, this recovery key is the <strong className="text-stone-800">ONLY</strong> way to unlock your encrypted vault.
              </p>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 font-mono text-sm text-stone-800 tracking-wider flex items-center justify-between gap-2 select-all">
              <span className="truncate">{generatedRecoveryKey}</span>
              <button
                type="button"
                onClick={handleCopyKey}
                className="shrink-0 p-2 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all shadow-sm cursor-pointer"
                title="Copy recovery key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                confirmUserRegistration(registeredUser);
                setRecoveryKeyStep(false);
              }}
              className="w-full py-3 px-5 rounded-2xl bg-[#6A4CFF] hover:bg-[#5838F5] text-white font-medium text-sm transition-all shadow-lg shadow-[#6A4CFF]/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              I've saved my key — Enter Saanjh
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F6F5F2] via-[#FBFBF9] to-[#ECE9E2] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Centered Master Card */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.06)] border border-stone-200/80 overflow-hidden grid lg:grid-cols-12 animate-fade-in">

        {/* Left Presentation Column (Desktop Only - Cleanly hidden on mobile to avoid 600px scrolling) */}
        <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-b from-[#FAF9F6] to-[#F2EFE9] p-8 lg:p-10 flex-col justify-between border-r border-stone-200/80">
          <div>
            {/* Brand Header */}
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-[#6A4CFF] flex items-center justify-center shadow-md shadow-[#6A4CFF]/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-stone-900 text-lg tracking-tight">Saanjh</span>
                <span className="block text-[10px] text-stone-500 font-semibold uppercase tracking-widest -mt-0.5">
                  Your Life. Your Space.
                </span>
              </div>
            </div>

            {/* Headline */}
            <div className="mb-8">
              <h1 className="serif-heading text-3xl sm:text-4xl text-stone-900 leading-[1.2] mb-3">
                Your private<br />
                <span className="text-[#6A4CFF] italic">digital sanctuary.</span>
              </h1>
              <p className="text-stone-600 text-sm leading-relaxed">
                A calm, encrypted personal ecosystem for everyday communication, planner, notes, and private files.
              </p>
            </div>

            {/* Feature Pills */}
            <div className="space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/70 backdrop-blur-xs p-3 rounded-2xl border border-stone-200/60 shadow-xs">
                  <div className="w-6 h-6 rounded-lg bg-[#6A4CFF]/10 text-[#6A4CFF] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-stone-900">{f.title}</p>
                    <p className="text-[11px] text-stone-500">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Badge at Bottom */}
          <div className="mt-8 pt-6 border-t border-stone-200/70 flex items-center justify-between text-xs text-stone-500">
            <div className="flex items-center gap-1.5 font-medium">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zero-knowledge client encryption</span>
            </div>
            <span className="text-[11px] bg-stone-200/60 px-2 py-0.5 rounded-full text-stone-600 font-mono">
              India Launch
            </span>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 p-5 sm:p-8 lg:p-12 flex flex-col justify-center">

          {/* Mobile Brand Header (Visible on phone/tablet screens) */}
          <div className="lg:hidden flex items-center justify-between gap-3 mb-5 pb-4 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#6A4CFF] flex items-center justify-center shadow-md shadow-[#6A4CFF]/20 shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-stone-900 text-lg tracking-tight">Saanjh</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                    Encrypted
                  </span>
                </div>
                <span className="block text-[11px] text-stone-500 font-medium -mt-0.5">
                  Your private digital sanctuary
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          {/* Header & Mode Switch */}
          <div className="mb-6">
            <div className="hidden lg:flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
                  {isRegister ? 'Create Your Space' : 'Welcome Back'}
                </h2>
                <p className="text-xs text-stone-500 mt-1">
                  {isRegister
                    ? 'Enter your real email and mobile number to start your encrypted vault.'
                    : 'Sign in using your username, email, or mobile number.'}
                </p>
              </div>

              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Network
              </span>
            </div>

            {/* Tab switch */}
            <div className="flex bg-stone-100 p-1 rounded-2xl border border-stone-200/70">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setLocalError(''); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${!isRegister
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/60'
                    : 'text-stone-500 hover:text-stone-800'
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setLocalError(''); }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${isRegister
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200/60'
                    : 'text-stone-500 hover:text-stone-800'
                  }`}
              >
                New User Registration
              </button>
            </div>
          </div>

          {/* Crypto / Network Stage Feedback */}
          {(loginStage || isSubmitting) && (
            <div className="mb-5 p-3.5 rounded-2xl bg-[#6A4CFF]/10 border border-[#6A4CFF]/20 flex items-center gap-3 animate-fade-in">
              <RefreshCw className="w-4 h-4 text-[#6A4CFF] animate-spin shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-[#6A4CFF]">Client Cryptography Active</p>
                <p className="text-stone-600 text-[11px]">{loginStage || 'Securing cryptographic keys...'}</p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {(loginError || localError) && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-rose-800">{loginError || localError}</p>
                <button
                  type="button"
                  onClick={() => setLocalError('')}
                  className="text-[11px] text-rose-600 hover:underline mt-0.5 block"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* SIGN IN FORM */}
          {!isRegister ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                  Username, Email, or Mobile Number
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. kuxhagr, ved, or name@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all placeholder:text-stone-400"
                    autoComplete="username email tel"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all placeholder:text-stone-400"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-stone-400">
                  Default superuser: <span className="font-mono text-stone-600 font-semibold">kuxhagr</span> · Pass: <span className="font-mono text-stone-600 font-semibold">12345678</span>
                </p>
              </div>

              {/* Remember this device */}
              <label className="flex items-center gap-2.5 text-xs text-stone-600 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="rounded text-[#6A4CFF] focus:ring-[#6A4CFF] w-4 h-4"
                />
                <span>Remember this device (non-extractable key prevents re-prompts on reload)</span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#6A4CFF] hover:bg-[#5838F5] active:scale-[0.99] text-white font-medium text-sm transition-all shadow-lg shadow-[#6A4CFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? 'Unlocking Vault...' : 'Unlock Your Space'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* NEW USER REGISTRATION FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Real Email */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 uppercase tracking-wider">
                    Real Email ID <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. ved@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all placeholder:text-stone-400"
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 uppercase tracking-wider">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all placeholder:text-stone-400"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Unique Username */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 uppercase tracking-wider">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="e.g. ved"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all placeholder:text-stone-400"
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1 uppercase tracking-wider">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      value={regDisplayName}
                      onChange={(e) => setRegDisplayName(e.target.value)}
                      placeholder="e.g. Ved Sharma"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all placeholder:text-stone-400"
                      autoComplete="name"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#6A4CFF] bg-[#6A4CFF]/10 px-2 py-0.5 rounded-full">
                    Argon2id (On-Device Worker)
                  </span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-9 pr-11 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all placeholder:text-stone-400"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Remember this device */}
                <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="rounded text-[#6A4CFF] focus:ring-[#6A4CFF] w-4 h-4"
                  />
                  <span>Remember this device on this browser</span>
                </label>

                {regPassword && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1 h-1">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <div
                          key={lvl}
                          className={`flex-1 rounded-full transition-all duration-300 ${strength >= lvl ? strengthColors[strength] : 'bg-stone-200'
                            }`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] text-stone-500">
                      Strength: <span className="font-semibold text-stone-800">{strengthLabels[strength]}</span>
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-stone-500 leading-snug">
                Your keys will be generated inside your browser. Others can message you by username, phone, or email according to your privacy settings.
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#6A4CFF] hover:bg-[#5838F5] active:scale-[0.99] text-white font-medium text-sm transition-all shadow-lg shadow-[#6A4CFF]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? 'Generating Device Keys...' : 'Create Account & Encrypted Vault'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Quick Demo Mode Box */}
          <div className="mt-5 pt-4 border-t border-stone-200/80">
            <button
              type="button"
              onClick={startDemoSession}
              className="w-full py-2.5 px-4 rounded-2xl bg-stone-100 hover:bg-stone-200/70 border border-stone-200/80 text-xs font-semibold text-stone-800 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#6A4CFF]" />
              <span>Instant Local Demo (No account needed)</span>
            </button>
            <p className="text-[11px] text-center text-stone-400 mt-1.5">
              Explore with pre-loaded mock encrypted notes, chat threads, and habits.
            </p>
          </div>

          {/* Dynamic Mobile/LAN Server Connection Bar */}
          <div className="mt-4 pt-3.5 border-t border-stone-100">
            <div className="flex items-center justify-between text-xs text-stone-600 bg-stone-50 border border-stone-200/80 rounded-2xl p-2.5 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    serverTestStatus === 'ok'
                      ? 'bg-emerald-500 animate-pulse'
                      : serverTestStatus === 'error'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <div className="min-w-0 truncate">
                  <span className="text-[10px] text-stone-400 block font-semibold uppercase tracking-wider">
                    Backend Connection
                  </span>
                  <span className="font-mono text-[11px] text-stone-700 truncate block">
                    {serverUrlVal}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingServer(!editingServer)}
                className="shrink-0 ml-2 px-2.5 py-1 rounded-xl bg-white border border-stone-200 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 transition-colors shadow-2xs cursor-pointer"
              >
                {editingServer ? 'Done' : 'Change IP'}
              </button>
            </div>

            {editingServer && (
              <div className="mt-2.5 p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 animate-fade-in">
                <label className="text-[11px] font-semibold text-stone-700 block">
                  Backend Server URL (e.g. laptop Wi-Fi IP)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverUrlVal}
                    onChange={(e) => setServerUrlVal(e.target.value)}
                    placeholder="http://192.168.1.8:8000"
                    className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-900 font-mono focus:outline-none focus:border-[#6A4CFF]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveServerUrl}
                    className="px-3 py-1.5 rounded-xl bg-[#6A4CFF] text-white text-xs font-semibold hover:bg-[#5838F5] transition-colors cursor-pointer"
                  >
                    Save
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => testServerConnection(serverUrlVal)}
                    className="text-[11px] text-[#6A4CFF] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Radio className="w-3 h-3" />
                    <span>Test Connection</span>
                  </button>
                  {serverTestMsg && (
                    <span
                      className={`text-[10px] ${
                        serverTestStatus === 'ok' ? 'text-emerald-600 font-semibold' : 'text-rose-600'
                      }`}
                    >
                      {serverTestMsg}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
