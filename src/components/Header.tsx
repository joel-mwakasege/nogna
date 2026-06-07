import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Settings, LogOut, User, Video as LucideIcon, Trash2, BarChart3, Building2, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import SetupWizard from './SetupWizard';
import { GlobalSearch } from './GlobalSearch';

interface CompanySettings {
  company_name: string;
  logo_url: string;
  header_display_mode: 'text' | 'logo' | 'both';
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user, signOut, isAdmin } = useAuth();
  const { shadows } = useTheme();
  const [controlOpen, setControlOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [isSaaSAdmin, setIsSaaSAdmin] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [showWizard, setShowWizard] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const p = (path: string) => `/${slug}${path}`;

  const handleSignOut = async () => {
    await signOut();
    navigate(`/${slug}`);
  };

  useEffect(() => {
    fetchCompanySettings();
    checkSaaSAdmin();
    checkUserCompany();
    fetchCompletionPercentage();

    const handleSettingsUpdate = () => {
      fetchCompanySettings();
      fetchCompletionPercentage();
    };

    window.addEventListener('company-settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('company-settings-updated', handleSettingsUpdate);
    };
  }, []);

  const checkSaaSAdmin = async () => {
    try {
      const { data } = await supabase
        .from('saas_admins')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      setIsSaaSAdmin(!!data);
    } catch (error) {
      console.error('Error checking SaaS admin:', error);
    }
  };

  const checkUserCompany = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      setHasCompany(!!data?.company_id);
      setCompanyId(data?.company_id || null);
    } catch (error) {
      console.error('Error checking user company:', error);
    }
  };

  const fetchCompletionPercentage = async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (!profile?.company_id) {
        return;
      }

      const { data: company } = await supabase
        .from('companies')
        .select('profile_completion_percentage, setup_completed')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (company) {
        setCompletionPercentage(company.profile_completion_percentage || 0);
      }
    } catch (error) {
      console.error('Error fetching completion percentage:', error);
    }
  };

  const fetchCompanySettings = async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (!profile?.company_id) {
        return;
      }

      const { data, error } = await supabase
        .from('company_settings')
        .select('company_name, logo_url, header_display_mode')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setCompanySettings(data);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setControlOpen(false);
      }
    }

    if (controlOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [controlOpen]);

  const isActive = (path: string) => {
    if (path === p('/bank')) {
      return location.pathname === path ||
             location.pathname.startsWith(p('/accounts')) ||
             location.pathname.startsWith(p('/expenses')) ||
             location.pathname.startsWith(p('/deposits')) ||
             location.pathname.startsWith(p('/transfers'));
    }
    if (path === p('/customers')) {
      return location.pathname === path ||
             location.pathname.startsWith(p('/customers')) ||
             location.pathname.startsWith(p('/invoices'));
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const getTextShadow = () => {
    if (!shadows.enabled) return 'none';

    const shadowValues = {
      none: 'none',
      subtle: '1px 1px 2px rgba(0, 0, 0, 0.1)',
      medium: '2px 2px 4px rgba(0, 0, 0, 0.3)',
      strong: '3px 3px 6px rgba(0, 0, 0, 0.4)',
    };

    return shadowValues[shadows.intensity];
  };

  const navLinks: Array<{ to: string; label: string; icon?: LucideIcon; adminOnly?: boolean; saasAdminOnly?: boolean; companyOnly?: boolean; separator?: boolean }> = [
    { to: p('/customers'), label: 'Billing' },
    { to: p('/bank'), label: 'Bank' },
    { to: p('/settings'), label: 'Settings' },
    { to: p('/company-settings'), label: 'Company', icon: Building2, companyOnly: true },
    { to: p('/trash'), label: 'Trash', icon: Trash2 },
    { to: '/saas-admin', label: 'SaaS Admin', icon: Shield, saasAdminOnly: true },
  ];

  return (
    <header className="sticky top-0 z-50 themed-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to={p('/dashboard')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {companySettings?.header_display_mode === 'logo' && companySettings.logo_url && (
                <img
                  src={companySettings.logo_url}
                  alt="Company Logo"
                  className="h-8 w-auto object-contain"
                />
              )}
              {companySettings?.header_display_mode === 'both' && companySettings.logo_url && (
                <>
                  <img
                    src={companySettings.logo_url}
                    alt="Company Logo"
                    className="h-8 w-auto object-contain"
                  />
                  <span className="text-xl font-bold tracking-tight themed-text" style={{ textShadow: getTextShadow() }}>
                    {companySettings.company_name || 'Billing System'}
                  </span>
                </>
              )}
              {(companySettings?.header_display_mode === 'text' || !companySettings?.header_display_mode) && (
                <span className="text-xl font-bold tracking-tight themed-text" style={{ textShadow: getTextShadow() }}>
                  {companySettings?.company_name || 'Billing System'}
                </span>
              )}
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <GlobalSearch />

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setControlOpen(!controlOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors themed-accent"
              >
                <Settings className="w-4 h-4" />
                Menu
                <ChevronDown className={`w-4 h-4 transition-transform ${controlOpen ? 'rotate-180' : ''}`} />
              </button>

              {controlOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-2 space-y-1">
                    {navLinks.map((link, index) => {
                      if (link.adminOnly && !isAdmin) return null;
                      if (link.saasAdminOnly && !isSaaSAdmin) return null;
                      if (link.companyOnly && !hasCompany) return null;
                      const Icon = link.icon;
                      return (
                        <div key={link.to}>
                          {link.separator && <div className="h-px bg-gray-200 my-2"></div>}
                          <Link
                            to={link.to}
                            onClick={() => setControlOpen(false)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                              isActive(link.to)
                                ? 'bg-slate-900 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {Icon && <Icon className="w-4 h-4" />}
                            {link.label}
                            {link.adminOnly && (
                              <span className="ml-auto text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold border border-slate-300">
                                ADMIN
                              </span>
                            )}
                            {link.saasAdminOnly && (
                              <span className="ml-auto text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold border border-slate-300">
                                SAAS
                              </span>
                            )}
                          </Link>
                        </div>
                      );
                    })}
                  </div>

                  <div className="h-px bg-gray-200 my-2"></div>

                  <div className="px-2 space-y-1">
                    <button
                      onClick={() => {
                        handleSignOut();
                        setControlOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2.5 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {hasCompany && completionPercentage < 100 ? (
              <button
                onClick={() => setShowWizard(true)}
                className="relative flex items-center justify-center"
                title={`Profile ${completionPercentage}% complete`}
              >
                <svg className="w-10 h-10 transform -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    stroke="#e2e8f0"
                    strokeWidth="3"
                    fill="none"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    stroke={completionPercentage >= 75 ? '#10b981' : completionPercentage >= 50 ? '#22c55e' : completionPercentage >= 25 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${(completionPercentage / 100) * 100.53} 100.53`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <User className="w-4 h-4 themed-text" />
                </div>
                {isAdmin && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 themed-accent border-white">
                    <span className="text-xs font-bold">A</span>
                  </div>
                )}
              </button>
            ) : (
              <div className="relative">
                <div className="w-10 h-10 rounded-full flex items-center justify-center themed-accent">
                  <User className="w-5 h-5" />
                </div>
                {isAdmin && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 themed-accent border-white">
                    <span className="text-xs font-bold">A</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showWizard && companyId && (
        <SetupWizard
          companyId={companyId}
          onClose={() => {
            setShowWizard(false);
            fetchCompletionPercentage();
          }}
        />
      )}
    </header>
  );
}
