import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

interface SlugRouteProps {
  children: React.ReactNode;
}

export function SlugRoute({ children }: SlugRouteProps) {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const { company, loading: tenantLoading, notFound } = useTenant();
  const [companySlug, setCompanySlug] = useState<string | null | undefined>(undefined);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfileLoading(false);
      return;
    }
    supabase
      .from('user_profiles')
      .select('company_id, companies(slug)')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCompanySlug((data?.companies as any)?.slug ?? null);
        setProfileLoading(false);
      });
  }, [user]);

  if (authLoading || tenantLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-slate-700" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/${slug}`} replace />;
  }

  if (notFound) {
    return <Navigate to="/" replace />;
  }

  if (companySlug !== slug) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
            <span className="text-2xl">&#128683;</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-6">
            Your account does not belong to the <strong>{company?.name}</strong> workspace.
          </p>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.href = `/${slug}`)}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
