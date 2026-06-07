import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { settings, company, loading: tenantLoading } = useTenant();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const displayName = settings?.company_name || company?.name || 'Your Workspace';

  useEffect(() => {
    // Supabase sends the recovery token in the URL hash — the client SDK
    // picks it up automatically via onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setTimeout(() => navigate(`/${slug}`, { replace: true }), 3000);
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-slate-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <div className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {settings?.logo_url && (settings.header_display_mode === 'logo' || settings.header_display_mode === 'both') ? (
              <img src={settings.logo_url} alt={displayName} className="h-14 w-auto object-contain mx-auto mb-4" />
            ) : (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700 rounded-xl mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
            )}
            {settings?.header_display_mode !== 'logo' && (
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{displayName}</h1>
            )}
            <p className="text-gray-500 text-sm">Set a new password</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            {done ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-full mb-4">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Password updated</h3>
                <p className="text-sm text-gray-500">Redirecting you to sign in...</p>
              </div>
            ) : !sessionReady ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-4">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Invalid or expired link</h3>
                <p className="text-sm text-gray-500 mb-6">
                  This password reset link is no longer valid. Please request a new one.
                </p>
                <button
                  onClick={() => navigate(`/${slug}`, { replace: true })}
                  className="text-sm text-slate-700 font-medium hover:text-slate-900 transition-colors"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your new password"
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
                  {submitting ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
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
