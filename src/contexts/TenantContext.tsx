import { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
  display_order: number;
}

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
  currencies: Currency[];
  slug: string;
  loading: boolean;
  notFound: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [company, setCompany] = useState<TenantCompany | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
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

  // NEW: Listen for events from Settings to silently refresh data without a loading screen flash
  useEffect(() => {
    const handleSilentRefresh = async () => {
      if (!slug) return;
      
      const { data: companyData } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!companyData) return;

      const { data: currenciesData } = await supabase
        .from('currencies')
        .select('*')
        .eq('company_id', companyData.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (currenciesData) {
        setCurrencies(currenciesData);
      }
    };

    window.addEventListener('currencies-updated', handleSilentRefresh);
    window.addEventListener('company-settings-updated', handleSilentRefresh);

    return () => {
      window.removeEventListener('currencies-updated', handleSilentRefresh);
      window.removeEventListener('company-settings-updated', handleSilentRefresh);
    };
  }, [slug]);

  const loadTenant = async (tenantSlug: string) => {
    setLoading(true);
    setNotFound(false);

    // 1. Fetch Company
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

    // 2. Fetch Settings
    const { data: settingsData } = await supabase
      .from('company_settings')
      .select('company_name, logo_url, header_display_mode')
      .eq('company_id', companyData.id)
      .maybeSingle();

    setSettings(settingsData ?? null);

    // 3. Fetch Active Currencies for this Company
    const { data: currenciesData } = await supabase
      .from('currencies')
      .select('*')
      .eq('company_id', companyData.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    setCurrencies(currenciesData || []);
    setLoading(false);
  };

  return (
    <TenantContext.Provider
      value={{
        company,
        settings,
        currencies,
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
