import { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface TenantCompany {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscription_tier: string;
}

interface TenantSettings {
  company_name: string | null;
  logo_url: string | null;
  header_display_mode: 'text' | 'logo' | 'both' | null;
}

interface TenantContextType {
  company: TenantCompany | null;
  settings: TenantSettings | null;
  slug: string;
  loading: boolean;
  notFound: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [company, setCompany] = useState<TenantCompany | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    loadTenant(slug);
  }, [slug]);

  const loadTenant = async (tenantSlug: string) => {
    setLoading(true);
    setNotFound(false);

    const { data: companyData, error } = await supabase
      .from('companies')
      .select('id, name, slug, status, subscription_tier')
      .eq('slug', tenantSlug)
      .maybeSingle();

    if (error || !companyData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setCompany(companyData);

    const { data: settingsData } = await supabase
      .from('company_settings')
      .select('company_name, logo_url, header_display_mode')
      .eq('company_id', companyData.id)
      .maybeSingle();

    setSettings(settingsData ?? null);
    setLoading(false);
  };

  return (
    <TenantContext.Provider
      value={{
        company,
        settings,
        slug: slug ?? '',
        loading,
        notFound,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
