import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Building2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InvitationDetails {
  email: string;
  role: string;
  company_name: string;
  expires_at: string;
}

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'invalid';

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('company_invitations')
        .select('email, role, expires_at, accepted_at, companies(name)')
        .eq('token', token)
        .maybeSingle();

      if (error || !data) {
        setPageState('invalid');
        setErrorMessage('This invitation link is invalid or has been removed.');
        return;
      }

      if (data.accepted_at) {
        setPageState('invalid');
        setErrorMessage('This invitation has already been accepted.');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setPageState('invalid');
        setErrorMessage('This invitation has expired. Please ask your administrator to send a new one.');
        return;
      }

      const companyData = data.companies as { name: string } | null;
      setInvitation({
        email: data.email,
        role: data.role,
        company_name: companyData?.name || 'Unknown Company',
        expires_at: data.expires_at,
      });
      setPageState('ready');
    } catch {
      setPageState('invalid');
      setErrorMessage('An error occurred while loading this invitation.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    setPageState('submitting');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ token, password, name: name || undefined }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.error || 'Failed to accept invitation');
        setPageState('error');
        return;
      }

      setPageState('success');

      // Sign in with the new credentials after a brief pause
      setTimeout(async () => {
        if (invitation?.email) {
          const { error, data } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password,
          });
          if (!error && data.user) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('company_id, companies(slug)')
              .eq('id', data.user.id)
              .maybeSingle();
            const companySlug = (profile?.companies as any)?.slug;
            navigate(companySlug ? `/${companySlug}/dashboard` : '/');
          } else {
            navigate('/');
          }
        }
      }, 2000);
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
      setPageState('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Team Invitation</h1>
        </div>

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your invitation...</p>
          </div>
        )}

        {/* Invalid / Expired */}
        {pageState === 'invalid' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Invitation Not Valid</h2>
            <p className="text-gray-500 text-sm mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
            >
              Go to login
            </button>
          </div>
        )}

        {/* Error after submit */}
        {pageState === 'error' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-500 text-sm mb-6">{errorMessage}</p>
            <button
              onClick={() => setPageState('ready')}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Success */}
        {pageState === 'success' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Welcome aboard!</h2>
            <p className="text-gray-500 text-sm">
              Your account has been created. Signing you in now...
            </p>
            <div className="mt-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          </div>
        )}

        {/* Ready — show form */}
        {(pageState === 'ready' || pageState === 'submitting') && invitation && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Invitation banner */}
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-4">
              <p className="text-sm text-blue-800">
                You have been invited to join <strong>{invitation.company_name}</strong> as a{' '}
                <strong className="capitalize">{invitation.role}</strong>.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Invitation for: <span className="font-medium">{invitation.email}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="John Smith"
                  disabled={pageState === 'submitting'}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Set Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Min. 6 characters"
                    required
                    disabled={pageState === 'submitting'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Repeat your password"
                    required
                    disabled={pageState === 'submitting'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {validationError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{validationError}</p>
              )}

              <button
                type="submit"
                disabled={pageState === 'submitting'}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors text-sm mt-2"
              >
                {pageState === 'submitting' ? 'Creating your account...' : 'Accept Invitation & Create Account'}
              </button>

              <p className="text-center text-xs text-gray-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign in
                </button>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
