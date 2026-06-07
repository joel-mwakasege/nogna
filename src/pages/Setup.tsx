import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { Footer } from '../components/Footer';

type PageState = 'loading' | 'available' | 'complete';

export default function Setup() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  async function checkSetupStatus() {
    const { count } = await supabase
      .from('saas_admins')
      .select('*', { count: 'exact', head: true });
    setPageState(count !== null && count > 0 ? 'complete' : 'available');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Sign in to get a session token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) {
      setError(signInError?.message ?? 'Sign in failed. Check your credentials.');
      setSubmitting(false);
      return;
    }

    const token = signInData.session.access_token;
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bootstrap-saas-admin`;

    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      // Sign back out — we don't want them left in a session if setup failed
      await supabase.auth.signOut();
      setError(result.error ?? 'Setup failed. Please try again.');
      setSubmitting(false);
      return;
    }

    // Session is already active; navigate to the SaaS admin panel
    navigate('/saas-admin');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <div className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700 rounded-xl mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">SaaS Admin Setup</h1>
            <p className="text-gray-600">Claim the super-admin seat for this platform</p>
          </div>

          {pageState === 'loading' && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 flex items-center justify-center gap-3 text-gray-500">
              <Loader className="w-5 h-5 animate-spin" />
              <span>Checking setup status...</span>
            </div>
          )}

          {pageState === 'complete' && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Setup Complete</h2>
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                A SaaS admin has already been configured for this platform. No further action is needed here.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-slate-700 font-medium hover:text-slate-900 transition-colors text-sm"
              >
                Go to login
              </Link>
            </div>
          )}

          {pageState === 'available' && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Sign in with an existing account that is not a member of any company. That account will become the platform super-admin.
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      disabled={submitting}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      disabled={submitting}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3"
                >
                  <Shield className="w-5 h-5" />
                  {submitting ? 'Setting up...' : 'Claim Super-Admin'}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link to="/login" className="text-slate-700 font-medium hover:text-slate-900 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
