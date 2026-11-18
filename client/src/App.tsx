import React, { useState, useEffect } from 'react';
import { apiClient, ApiErrorResponse } from './services/apiClient';
import { UserProfileResponse } from '@studyflow/shared/types';
import { Sparkles, GraduationCap, Clock, BookOpen, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('University of Birmingham');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    try {
      setLoading(true);
      const profile = await apiClient.getCurrentUser();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (authMode === 'register') {
        const res = await apiClient.register({
          email,
          password,
          full_name: fullName,
          university,
        });
        setUser(res.user);
        setSuccessMsg('Account registered successfully!');
      } else {
        const res = await apiClient.login({ email, password });
        setUser(res.user);
        setSuccessMsg('Welcome back!');
      }
    } catch (err: unknown) {
      if (err instanceof ApiErrorResponse) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Authentication failed. Please check your credentials.');
      }
    }
  }

  async function handleLogout() {
    try {
      await apiClient.logout();
      setUser(null);
      setSuccessMsg('Logged out successfully.');
    } catch (err: unknown) {
      console.error('Logout error:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium text-sm">Initializing StudyFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">StudyFlow</h1>
            <p className="text-xs text-slate-500 font-medium">Academic Planning & AI Execution</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center space-x-4">
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              {user.subscription_tier} Tier
            </span>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
              <p className="text-xs text-slate-500">{user.university || 'Student'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {!user ? (
          /* Authentication Screen */
          <div className="max-w-md mx-auto mt-12 bg-white rounded-xl shadow-sm border border-slate-200 p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {authMode === 'login' ? 'Welcome Back' : 'Create an Account'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {authMode === 'login'
                  ? 'Sign in to access your modules, timetable, and study plan'
                  : 'Get started with intelligent academic scheduling'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Johnson"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      University
                    </label>
                    <input
                      type="text"
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      placeholder="e.g. University of Birmingham"
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.ac.uk"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-sm"
              >
                {authMode === 'login' ? 'Sign In' : 'Register Account'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-slate-500">
              {authMode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMsg(null);
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Register here
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMsg(null);
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Logged In Dashboard Overview (Stage 1 Foundation View) */
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-blue-600">
                  Stage 1 Verified & Active
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">
                  Hello, {user.full_name} 👋
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Database connected via SQLite WAL mode with full user isolation and cookie JWT security.
                </p>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  API REST Envelope Verified
                </span>
              </div>
            </div>

            {/* Profile & Study Parameters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3 text-slate-700 mb-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-sm">Study Window</h3>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {user.preferred_study_start} – {user.preferred_study_end}
                </p>
                <p className="text-xs text-slate-500 mt-1">Configured daily study hours</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3 text-slate-700 mb-3">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-sm">Daily Study Cap</h3>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {user.daily_study_cap_mins} mins
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {(user.daily_study_cap_mins / 60).toFixed(1)} hours maximum work per day
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center space-x-3 text-slate-700 mb-3">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-sm">Monthly AI Quota</h3>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {user.ai_breakdown_count_month ?? 0} / {user.subscription_tier === 'PRO' ? '∞' : '3'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Assignment breakdowns used this month</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
