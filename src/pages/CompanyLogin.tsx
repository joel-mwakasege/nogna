import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, FileText, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';

type View = 'login' | 'reset';

export default function CompanyLogin() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { company, settings, slug, loading, notFound } = useTenant();

  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const displayName = settings?.company_name || company?.name || 'Your Workspace';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setSubmitting(true);

    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError.message);
      setSubmitting(false);
      return;
    }

    // Verify the signed-in user belongs to this company
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id, companies(slug)')
        .eq('id', user.id)
        .maybeSingle();

      const userCompanySlug = (profile?.companies as any)?.slug;

      if (!profile?.company_id || userCompanySlug !== slug) {
        await supabase.auth.signOut();
        setError('This account does not belong to this workspace.');
        setSubmitting(false);
        return;
      }
    }

    navigate(`/${slug}/dashboard`, { replace: true });
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setSubmitting(true);

    const redirectUrl = `${window.location.origin}/${slug}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-slate-700" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
        <div className="flex-grow flex items-center justify-center px-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-6">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Workspace not found</h1>
            <p className="text-gray-500 mb-6">
              <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-sm">{slug}</span> does not match any workspace.
            </p>
            <a
              href="/"
              className="text-slate-700 font-medium hover:text-slate-900 transition-colors text-sm"
            >
              Go to homepage
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <div className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Company branding */}
          <div className="text-center mb-8">
            {settings?.logo_url && (settings.header_display_mode === 'logo' || settings.header_display_mode === 'both') ? (
              <img
                src={settings.logo_url}
                alt={displayName}
                className="h-14 w-auto object-contain mx-auto mb-4"
              />
            ) : (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700 rounded-xl mb-4">
                <FileText className="w-8 h-8 text-white" />
              </div>
            )}
            {settings?.header_display_mode !== 'logo' && (
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayName}</h1>
            )}
            <p className="text-gray-500 text-sm">
              {view === 'login' ? 'Sign in to your account' : 'Reset your password'}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            {error && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {view === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => { setView('reset'); setError(null); }}
                      className="text-xs text-slate-600 hover:text-slate-800 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3"
                >
                  <LogIn className="w-5 h-5" />
                  {submitting ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            )}

            {view === 'reset' && (
              <>
                {resetSent ? (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-4">
                      <Mail className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Check your email</h3>
                    <p className="text-sm text-gray-500 mb-6">
                      We sent a password reset link to <strong>{email}</strong>
                    </p>
                    <button
                      onClick={() => { setView('login'); setResetSent(false); setError(null); }}
                      className="text-sm text-slate-700 font-medium hover:text-slate-900 transition-colors"
                    >
                      Back to sign in
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-5">
                    <p className="text-sm text-gray-600">
                      Enter your email and we'll send you a link to reset your password.
                    </p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                          disabled={submitting}
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-3"
                    >
                      {submitting ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setView('login'); setError(null); }}
                      className="w-full text-sm text-slate-600 hover:text-slate-800 transition-colors text-center"
                    >
                      Back to sign in
                    </button>
                  </form>
                )}
              </>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            nogna.app &middot; {displayName}
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
