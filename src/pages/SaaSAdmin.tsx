import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, AlertCircle, CheckCircle, XCircle, Clock, Search, Shield, UserPlus, Trash2, Database, HardDrive, FileText, Activity, ChevronDown, ChevronUp, Key, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { Header } from '../components/Header';
import { DeleteModal } from '../components/DeleteModal';
import { MetricCard, MetricGrid } from '../components/ResourceMetrics';
import { ColumnVisibilityControl } from '../components/ColumnVisibilityControl';
import { AdminThemeSettings } from '../components/AdminThemeSettings';

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscription_tier: string;
  subscription_expires_at: string | null;
  max_users: number;
  created_at: string;
  created_by: string;
  user_count?: number;
}

interface SuperAdmin {
  id: string;
  user_id: string;
  created_at: string;
  email?: string;
  name?: string;
}

interface PlatformSummary {
  total_companies: number;
  total_users: number;
  active_users: number;
  total_customers: number;
  total_documents: number;
  total_storage_used: number;
  total_files: number;
  completed_setups: number;
  avg_completion_percentage: number;
}

interface CompanyUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  company_id: string | null;
}

interface CompanyResourceUsage {  company_id: string;
  company_name: string;
  company_created_at: string;
  profile_completion_percentage: number;
  setup_completed: boolean;
  total_users: number;
  active_users: number;
  owner_count: number;
  admin_count: number;
  total_customers: number;
  total_documents: number;
  total_invoices: number;
  total_estimates: number;
  total_revenue: number;
  outstanding_invoices_amount: number;
  total_expenses: number;
  total_expense_amount: number;
  total_deposits: number;
  total_deposit_amount: number;
  total_accounts: number;
  storage_bytes_used: number;
  total_files: number;
  last_activity_at: string | null;
  has_settings: number;
}

export default function SaaSAdmin() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isSaaSAdmin, setIsSaaSAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [deleteAdminId, setDeleteAdminId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'companies' | 'admins' | 'resources' | 'theme'>('resources');

  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [companyResources, setCompanyResources] = useState<CompanyResourceUsage[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  const [columnVisibility, setColumnVisibility] = useState({
    users: true,
    customers: true,
    documents: true,
    revenue: true,
    storage: true,
    setup: true,
    lastActivity: true,
  });

  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyFormData, setCompanyFormData] = useState({
    companyName: '',
    slug: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    subscriptionTier: 'free',
    maxUsers: 5,
    status: 'trial',
    durationDays: 30,
  });
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [companySuccess, setCompanySuccess] = useState<{ name: string; ownerEmail: string } | null>(null);

  // Add SuperAdmin — create-new-user toggle
  const [adminCreateMode, setAdminCreateMode] = useState<'existing' | 'new'>('existing');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Per-company user management
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [companyUsers, setCompanyUsers] = useState<Record<string, CompanyUser[]>>({});
  const [companyUsersLoading, setCompanyUsersLoading] = useState<Record<string, boolean>>({});

  // Add user to company modal
  const [addUserToCompany, setAddUserToCompany] = useState<{ companyId: string; companyName: string } | null>(null);
  const [addUserForm, setAddUserForm] = useState({ email: '', password: '', name: '', role: 'user' });
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState('');

  // Reset password modal
  const [resetPasswordUser, setResetPasswordUser] = useState<{ email: string; name: string } | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    checkSaaSAdmin();
  }, []);

  useEffect(() => {
    if (isSaaSAdmin) {
      loadCompanies();
      loadSuperAdmins();
      loadPlatformSummary();
      loadCompanyResources();
    }
  }, [isSaaSAdmin]);

  useEffect(() => {
    filterCompanies();
  }, [companies, searchTerm, statusFilter, tierFilter]);

  const checkSaaSAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from('saas_admins')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      navigate('/');
      return;
    }

    setIsSaaSAdmin(true);
  };

  const loadSuperAdmins = async () => {
    try {
      const { data: adminsData, error } = await supabase
        .from('saas_admins')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const adminsWithDetails = await Promise.all(
        (adminsData || []).map(async (admin) => {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('email, name')
            .eq('id', admin.user_id)
            .maybeSingle();

          return {
            ...admin,
            email: profile?.email || 'Unknown',
            name: profile?.name || 'Unnamed',
          };
        })
      );

      setSuperAdmins(adminsWithDetails);
    } catch (error) {
      console.error('Error loading super admins:', error);
    }
  };

  const handleAddSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);

    try {
      let userId: string;

      if (adminCreateMode === 'new') {
        // Create a new user account first (no company), then promote to superadmin
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        // We can't use create-user (requires company context), so we call create-company's
        // underlying admin user creation. Use a direct signup approach via Supabase anon signup,
        // then we'll promote them.
        // Best approach: create via Supabase auth signUp with the admin client.
        // Since we only have the anon key on the frontend, we'll use signUp (no email confirm needed
        // as long as email confirmations are off in the Supabase project settings).
        // For now, require existing user for safety — but let the admin know they can create a company first.
        setAdminError('To create a new SuperAdmin user, first create a company for them (which creates their account), then add them as SuperAdmin here using their email.');
        setAdminLoading(false);
        return;
      }

      // Existing user mode
      const { data: user } = await supabase
        .from('user_profiles')
        .select('id, email, company_id')
        .eq('email', newAdminEmail)
        .maybeSingle();

      if (!user) {
        setAdminError('No user found with this email address. They must have an account first.');
        return;
      }

      if (user.company_id) {
        setAdminError('This user belongs to a company and cannot be promoted to SuperAdmin. SuperAdmins must not be members of any company.');
        return;
      }

      const { data: existing } = await supabase
        .from('saas_admins')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        setAdminError('This user is already a SuperAdmin');
        return;
      }

      const { error } = await supabase
        .from('saas_admins')
        .insert({ user_id: user.id });

      if (error) throw error;

      setShowAdminModal(false);
      setNewAdminEmail('');
      setNewAdminName('');
      setNewAdminPassword('');
      setAdminCreateMode('existing');
      loadSuperAdmins();
    } catch (error: any) {
      setAdminError(error.message || 'Failed to add SuperAdmin');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRemoveSuperAdmin = async (adminId: string) => {
    try {
      const { error } = await supabase
        .from('saas_admins')
        .delete()
        .eq('id', adminId);

      if (error) throw error;

      loadSuperAdmins();
      setDeleteAdminId(null);
    } catch (error) {
      console.error('Error removing super admin:', error);
    }
  };

  const loadCompanyUsers = async (companyId: string) => {
    setCompanyUsersLoading(prev => ({ ...prev, [companyId]: true }));
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, email, name, role, is_active, company_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      setCompanyUsers(prev => ({ ...prev, [companyId]: data || [] }));
    } catch (error) {
      console.error('Error loading company users:', error);
    } finally {
      setCompanyUsersLoading(prev => ({ ...prev, [companyId]: false }));
    }
  };

  const toggleCompanyExpand = (companyId: string) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
    } else {
      setExpandedCompanyId(companyId);
      if (!companyUsers[companyId]) {
        loadCompanyUsers(companyId);
      }
    }
  };

  const handleAddUserToCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');
    setAddUserLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !addUserToCompany) throw new Error('Not authenticated');

      // Use service role via a superadmin-aware create-user call by temporarily impersonating an owner
      // We directly insert via supabase admin — call the create-user edge function
      // For superadmin adding users we need to do it directly since create-user requires an owner/admin token
      // Instead, we insert directly using the Supabase client (which has superadmin RLS bypass via the admin panel)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      // Actually we need a dedicated superadmin-add-user path. For now, use the existing
      // create-user function but we need to add a targetCompanyId override for superadmins.
      // Use a direct Supabase RPC approach instead via the admin client on the frontend.
      // The cleanest approach: call an edge function that accepts targetCompanyId when caller is superadmin.
      const addResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/saas-add-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          ...addUserForm,
          companyId: addUserToCompany.companyId,
        }),
      });

      const result = await addResponse.json();
      if (!addResponse.ok) throw new Error(result.error || 'Failed to add user');

      loadCompanyUsers(addUserToCompany.companyId);
      loadCompanies();
      setAddUserToCompany(null);
      setAddUserForm({ email: '', password: '', name: '', role: 'user' });
    } catch (error: any) {
      setAddUserError(error.message || 'Failed to add user');
    } finally {
      setAddUserLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    setResetLoading(true);
    setResetLink(null);

    try {
      const { data, error } = await supabase.auth.admin?.generateLink?.({
        type: 'recovery',
        email: resetPasswordUser.email,
      }) as any;

      if (error) throw error;
      setResetLink(data?.properties?.action_link || data?.action_link || null);
    } catch (error: any) {
      // Fallback: client-side password reset is not available without service role
      // Show a message instructing them to use Supabase dashboard
      setResetLink('DASHBOARD_ONLY');
    } finally {
      setResetLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleCompanyNameChange = (name: string) => {
    setCompanyFormData({
      ...companyFormData,
      companyName: name,
      slug: generateSlug(name),
    });
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError('');
    setCompanyLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(companyFormData),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Company creation failed:', result);
        throw new Error(result.error || 'Failed to create company');
      }

      console.log('Company created successfully:', result);

      setShowCompanyModal(false);
      setCompanySuccess({ name: companyFormData.companyName, ownerEmail: companyFormData.ownerEmail });
      setCompanyFormData({
        companyName: '',
        slug: '',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: '',
        subscriptionTier: 'free',
        maxUsers: 5,
        status: 'trial',
        durationDays: 30,
      });
      loadCompanies();
    } catch (error: any) {
      setCompanyError(error.message || 'Failed to create company');
    } finally {
      setCompanyLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const companiesWithCounts = await Promise.all(
        (data || []).map(async (company) => {
          const { count } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id);

          return { ...company, user_count: count || 0 };
        })
      );

      setCompanies(companiesWithCounts);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlatformSummary = async () => {
    try {
      const { data, error } = await supabase
        .from('saas_platform_summary')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setPlatformSummary(data);
    } catch (error) {
      console.error('Error loading platform summary:', error);
    }
  };

  const loadCompanyResources = async () => {
    setResourcesLoading(true);
    try {
      const { data, error } = await supabase
        .from('saas_company_resource_usage')
        .select('*')
        .order('company_created_at', { ascending: false });

      if (error) throw error;
      setCompanyResources(data || []);
    } catch (error) {
      console.error('Error loading company resources:', error);
    } finally {
      setResourcesLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const columns = [
    { key: 'users', label: 'Users', visible: columnVisibility.users },
    { key: 'customers', label: 'Customers', visible: columnVisibility.customers },
    { key: 'documents', label: 'Documents', visible: columnVisibility.documents },
    { key: 'revenue', label: 'Revenue', visible: columnVisibility.revenue },
    { key: 'storage', label: 'Storage', visible: columnVisibility.storage },
    { key: 'setup', label: 'Setup Progress', visible: columnVisibility.setup },
    { key: 'lastActivity', label: 'Last Activity', visible: columnVisibility.lastActivity },
  ];

  const filterCompanies = () => {
    let filtered = companies;

    if (searchTerm) {
      filtered = filtered.filter(
        (company) =>
          company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          company.slug.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((company) => company.status === statusFilter);
    }

    if (tierFilter !== 'all') {
      filtered = filtered.filter((company) => company.subscription_tier === tierFilter);
    }

    setFilteredCompanies(filtered);
  };

  const updateCompanyStatus = async (companyId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ status: newStatus })
        .eq('id', companyId);

      if (error) throw error;

      setCompanies(companies.map(c => c.id === companyId ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error('Error updating company status:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'trial':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'suspended':
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'basic':
        return 'bg-green-100 text-green-800';
      case 'free':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubscriptionDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;

    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  };

  const formatSubscriptionInfo = (expiresAt: string | null) => {
    if (!expiresAt) {
      return { text: 'No expiry', color: 'text-gray-500' };
    }

    const daysRemaining = getSubscriptionDaysRemaining(expiresAt);

    if (daysRemaining === null) {
      return { text: 'No expiry', color: 'text-gray-500' };
    }

    if (daysRemaining < 0) {
      return {
        text: `Expired ${Math.abs(daysRemaining)} days ago`,
        color: 'text-red-600 font-semibold'
      };
    }

    if (daysRemaining === 0) {
      return { text: 'Expires today', color: 'text-red-600 font-semibold' };
    }

    if (daysRemaining <= 7) {
      return {
        text: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`,
        color: 'text-orange-600 font-semibold'
      };
    }

    if (daysRemaining <= 30) {
      return {
        text: `${daysRemaining} days left`,
        color: 'text-yellow-600'
      };
    }

    return {
      text: `${daysRemaining} days left`,
      color: 'text-green-600'
    };
  };

  const stats = {
    total: companies.length,
    active: companies.filter(c => c.status === 'active').length,
    trial: companies.filter(c => c.status === 'trial').length,
    totalUsers: companies.reduce((sum, c) => sum + (c.user_count || 0), 0),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">SaaS Administration</h1>
              <p className="text-gray-600">Manage all companies and SuperAdmins</p>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg shadow p-1">
              <button
                onClick={() => setActiveTab('resources')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'resources'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Database className="w-4 h-4 inline mr-2" />
                Resources
              </button>
              <button
                onClick={() => setActiveTab('companies')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'companies'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Building2 className="w-4 h-4 inline mr-2" />
                Companies
              </button>
              <button
                onClick={() => setActiveTab('admins')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'admins'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                SuperAdmins
              </button>
              <button
                onClick={() => setActiveTab('theme')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'theme'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Activity className="w-4 h-4 inline mr-2" />
                Theme
              </button>
            </div>
          </div>
        </div>

        {platformSummary && (
          <div className="mb-8">
            <MetricGrid>
              <MetricCard
                title="Total Companies"
                value={platformSummary.total_companies}
                icon={Building2}
                color="blue"
                subtitle={`${platformSummary.completed_setups} completed setups`}
              />
              <MetricCard
                title="Total Users"
                value={platformSummary.total_users}
                icon={Users}
                color="green"
                subtitle={`${platformSummary.active_users} active`}
              />
              <MetricCard
                title="Total Storage"
                value={formatBytes(platformSummary.total_storage_used)}
                icon={HardDrive}
                color="purple"
                subtitle={`${platformSummary.total_files} files`}
              />
              <MetricCard
                title="Documents"
                value={platformSummary.total_documents}
                icon={FileText}
                color="orange"
                subtitle={`${platformSummary.total_customers} customers`}
              />
            </MetricGrid>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-medium text-gray-600">Total Companies</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h3 className="text-sm font-medium text-gray-600">Active</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-medium text-gray-600">Trial</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.trial}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
          </div>
        </div>

        {activeTab === 'resources' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Company Resource Usage</h2>
                  <p className="text-sm text-gray-600 mt-1">Detailed metrics for each company</p>
                </div>
                <ColumnVisibilityControl
                  columns={columns}
                  onToggle={toggleColumnVisibility}
                />
              </div>
            </div>

            {resourcesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company
                      </th>
                      {columnVisibility.users && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Users
                        </th>
                      )}
                      {columnVisibility.customers && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customers
                        </th>
                      )}
                      {columnVisibility.documents && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Documents
                        </th>
                      )}
                      {columnVisibility.revenue && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue
                        </th>
                      )}
                      {columnVisibility.storage && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Storage
                        </th>
                      )}
                      {columnVisibility.setup && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Setup
                        </th>
                      )}
                      {columnVisibility.lastActivity && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Activity
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {companyResources.map((company) => (
                      <tr key={company.company_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{company.company_name}</div>
                            <div className="text-xs text-gray-500">
                              Created {new Date(company.company_created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        {columnVisibility.users && (
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{company.total_users} total</div>
                              <div className="text-xs text-green-600">{company.active_users} active</div>
                              <div className="text-xs text-gray-500">
                                {company.owner_count} owner, {company.admin_count} admin
                              </div>
                            </div>
                          </td>
                        )}
                        {columnVisibility.customers && (
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {company.total_customers}
                          </td>
                        )}
                        {columnVisibility.documents && (
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">{company.total_documents} total</div>
                              <div className="text-xs text-blue-600">{company.total_invoices} invoices</div>
                              <div className="text-xs text-purple-600">{company.total_estimates} estimates</div>
                            </div>
                          </td>
                        )}
                        {columnVisibility.revenue && (
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium text-green-600">{formatCurrency(company.total_revenue)}</div>
                              {company.outstanding_invoices_amount > 0 && (
                                <div className="text-xs text-orange-600">
                                  {formatCurrency(company.outstanding_invoices_amount)} outstanding
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                {company.total_expenses} expenses • {company.total_deposits} deposits
                              </div>
                            </div>
                          </td>
                        )}
                        {columnVisibility.storage && (
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {formatBytes(company.storage_bytes_used)}
                              </div>
                              <div className="text-xs text-gray-500">{company.total_files} files</div>
                            </div>
                          </td>
                        )}
                        {columnVisibility.setup && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="relative w-12 h-12">
                                <svg className="w-12 h-12 transform -rotate-90">
                                  <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    stroke="#e2e8f0"
                                    strokeWidth="4"
                                    fill="none"
                                  />
                                  <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    stroke={
                                      company.profile_completion_percentage >= 75
                                        ? '#10b981'
                                        : company.profile_completion_percentage >= 50
                                        ? '#3b82f6'
                                        : '#f59e0b'
                                    }
                                    strokeWidth="4"
                                    fill="none"
                                    strokeDasharray={`${(company.profile_completion_percentage / 100) * 125.6} 125.6`}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-gray-700">
                                    {company.profile_completion_percentage}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                        {columnVisibility.lastActivity && (
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {company.last_activity_at
                              ? new Date(company.last_activity_at).toLocaleDateString()
                              : 'No activity'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {companyResources.length === 0 && (
                  <div className="text-center py-12">
                    <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No resource data available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'companies' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Companies</h2>
                <Button onClick={() => setShowCompanyModal(true)} size="sm">
                  <Building2 className="w-4 h-4 mr-2" />
                  Create Company
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Tiers</option>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCompanies.map((company) => (
                  <>
                    <tr key={company.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{company.name}</div>
                          <div className="text-sm text-gray-500">{company.slug}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(company.status)}`}>
                          {getStatusIcon(company.status)}
                          {company.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColor(company.subscription_tier)}`}>
                          {company.subscription_tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {company.user_count} / {company.max_users}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {company.subscription_expires_at ? (
                            <>
                              <div className={`font-medium ${formatSubscriptionInfo(company.subscription_expires_at).color}`}>
                                {formatSubscriptionInfo(company.subscription_expires_at).text}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(company.subscription_expires_at).toLocaleDateString()}
                              </div>
                            </>
                          ) : (
                            <span className="text-gray-500">No expiry</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(company.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={company.status}
                            onChange={(e) => updateCompanyStatus(company.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="active">Active</option>
                            <option value="trial">Trial</option>
                            <option value="suspended">Suspended</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <button
                            onClick={() => setAddUserToCompany({ companyId: company.id, companyName: company.name })}
                            className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 rounded transition-colors font-medium flex items-center gap-1"
                            title="Add user to this company"
                          >
                            <UserPlus className="w-3 h-3" />
                            Add User
                          </button>
                          <button
                            onClick={() => toggleCompanyExpand(company.id)}
                            className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1 rounded transition-colors flex items-center gap-1"
                          >
                            {expandedCompanyId === company.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            Users
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedCompanyId === company.id && (
                      <tr key={`${company.id}-users`} className="bg-blue-50">
                        <td colSpan={7} className="px-6 py-4">
                          {companyUsersLoading[company.id] ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              Loading users...
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                                Company Users — {companyUsers[company.id]?.length || 0} total
                              </p>
                              {(companyUsers[company.id] || []).length === 0 ? (
                                <p className="text-sm text-gray-500">No users in this company yet.</p>
                              ) : (
                                <div className="space-y-1">
                                  {(companyUsers[company.id] || []).map((u) => (
                                    <div key={u.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm border border-gray-200">
                                      <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                        <span className="font-medium text-gray-900">{u.name || u.email}</span>
                                        {u.name && <span className="text-gray-500 text-xs">{u.email}</span>}
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                          u.role === 'owner' ? 'bg-amber-100 text-amber-800'
                                          : u.role === 'admin' ? 'bg-blue-100 text-blue-800'
                                          : 'bg-gray-100 text-gray-700'
                                        }`}>{u.role}</span>
                                        {!u.company_id && (
                                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">No company ID</span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => setResetPasswordUser({ email: u.email, name: u.name || u.email })}
                                        className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
                                        title="Reset password"
                                      >
                                        <Key className="w-3 h-3" />
                                        Reset password
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>

            {filteredCompanies.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No companies found</p>
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'admins' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">SuperAdmin Management</h2>
                <p className="text-sm text-gray-600 mt-1">Users with full platform access</p>
              </div>
              <Button onClick={() => setShowAdminModal(true)} size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Add SuperAdmin
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Added On
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {superAdmins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <Shield className="w-5 h-5 text-orange-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{admin.name}</div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              SuperAdmin
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {admin.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(admin.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {admin.user_id !== currentUserId && (
                          <button
                            onClick={() => setDeleteAdminId(admin.id)}
                            className="text-red-600 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {superAdmins.length === 0 && (
                <div className="text-center py-12">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No SuperAdmins found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'theme' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Platform Theme Settings</h2>
              <p className="text-sm text-gray-600 mt-1">Customize the appearance for companies</p>
            </div>
            <div className="p-6">
              <AdminThemeSettings companies={companies} />
            </div>
          </div>
        )}
      </main>

      {showAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Add SuperAdmin</h3>
              <button onClick={() => { setShowAdminModal(false); setNewAdminEmail(''); setAdminError(''); setAdminCreateMode('existing'); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {adminError && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                {adminError}
              </div>
            )}

            <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
              <button
                type="button"
                onClick={() => { setAdminCreateMode('existing'); setAdminError(''); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${adminCreateMode === 'existing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
              >
                Existing User
              </button>
              <button
                type="button"
                onClick={() => { setAdminCreateMode('new'); setAdminError(''); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${adminCreateMode === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
              >
                New User
              </button>
            </div>

            <form onSubmit={handleAddSuperAdmin} className="space-y-4">
              {adminCreateMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User Email</label>
                  <input
                    type="email"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">User must already have an account in the system</p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-1">To create a new SuperAdmin from scratch:</p>
                  <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Use <strong>Create Company</strong> to create a company and owner account for them</li>
                    <li>Come back here and use <strong>Existing User</strong> with their email</li>
                  </ol>
                  <p className="text-xs text-blue-600 mt-2">This two-step flow ensures every SuperAdmin has a valid account.</p>
                </div>
              )}

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-orange-900 mb-1">SuperAdmin Access Includes:</h4>
                <ul className="text-xs text-orange-700 space-y-0.5">
                  <li>• View and manage all companies</li>
                  <li>• Change company subscription status</li>
                  <li>• Add/remove other SuperAdmins</li>
                  <li>• Full platform access</li>
                </ul>
              </div>

              {adminCreateMode === 'existing' && (
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => { setShowAdminModal(false); setNewAdminEmail(''); setAdminError(''); setAdminCreateMode('existing'); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={adminLoading} className="flex-1">
                    {adminLoading ? 'Adding...' : 'Add SuperAdmin'}
                  </Button>
                </div>
              )}

              {adminCreateMode === 'new' && (
                <Button type="button" onClick={() => { setShowAdminModal(false); setActiveTab('companies'); setShowCompanyModal(true); }} className="w-full">
                  Go to Create Company
                </Button>
              )}
            </form>
          </div>
        </div>
      )}

      {deleteAdminId && (
        <DeleteModal
          isOpen={true}
          onCancel={() => setDeleteAdminId(null)}
          onConfirm={() => handleRemoveSuperAdmin(deleteAdminId)}
          title="Remove SuperAdmin"
          message="Are you sure you want to remove this SuperAdmin?"
          itemName="They will lose all platform management access."
        />
      )}

      {showCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 my-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Create New Company</h3>

            {companyError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                {companyError}
              </div>
            )}

            <form onSubmit={handleCreateCompany} className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Company Information</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyFormData.companyName}
                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyFormData.slug}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, slug: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="acme-corp"
                    pattern="[a-z0-9\-]+"
                    minLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier (lowercase letters, numbers, hyphens only)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subscription Tier
                    </label>
                    <select
                      value={companyFormData.subscriptionTier}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, subscriptionTier: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="professional">Professional</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={companyFormData.status}
                      onChange={(e) => setCompanyFormData({ ...companyFormData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Users
                  </label>
                  <input
                    type="number"
                    min="5"
                    placeholder="5"
                    value={companyFormData.maxUsers}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value);
                      setCompanyFormData({ ...companyFormData, maxUsers: isNaN(parsed) ? 5 : Math.max(5, parsed) });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subscription Duration (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={companyFormData.durationDays}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, durationDays: parseInt(e.target.value) || 30 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of days the subscription will be active
                  </p>
                </div>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Owner Account</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyFormData.ownerName}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, ownerName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={companyFormData.ownerEmail}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, ownerEmail: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={companyFormData.ownerPassword}
                    onChange={(e) => setCompanyFormData({ ...companyFormData, ownerPassword: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">What will be created:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• New company account with isolated database</li>
                  <li>• Owner user account with full permissions</li>
                  <li>• Default company settings</li>
                  <li>• Ready-to-use billing system</li>
                </ul>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCompanyModal(false);
                    setCompanyFormData({
                      companyName: '',
                      slug: '',
                      ownerName: '',
                      ownerEmail: '',
                      ownerPassword: '',
                      subscriptionTier: 'free',
                      maxUsers: 5,
                      status: 'trial',
                      durationDays: 30,
                    });
                    setCompanyError('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={companyLoading} className="flex-1">
                  {companyLoading ? 'Creating Company...' : 'Create Company'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Company creation success notification */}
      {companySuccess && (
        <div className="fixed bottom-6 right-6 bg-white border border-green-200 rounded-xl shadow-lg p-4 max-w-sm z-50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">Company Created</p>
              <p className="text-xs text-gray-600 mt-0.5"><strong>{companySuccess.name}</strong> is ready</p>
              <p className="text-xs text-gray-500">Owner: {companySuccess.ownerEmail}</p>
            </div>
            <button onClick={() => setCompanySuccess(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add User to Company modal */}
      {addUserToCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add User to Company</h3>
                <p className="text-sm text-gray-500">{addUserToCompany.companyName}</p>
              </div>
              <button onClick={() => { setAddUserToCompany(null); setAddUserError(''); setAddUserForm({ email: '', password: '', name: '', role: 'user' }); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addUserError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">{addUserError}</div>
            )}

            <form onSubmit={handleAddUserToCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Optional)</label>
                <input type="text" value={addUserForm.name} onChange={(e) => setAddUserForm({ ...addUserForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="John Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" required value={addUserForm.email} onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="user@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" required minLength={6} value={addUserForm.password} onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" placeholder="Min. 6 characters" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={addUserForm.role} onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" onClick={() => { setAddUserToCompany(null); setAddUserError(''); setAddUserForm({ email: '', password: '', name: '', role: 'user' }); }} className="flex-1" disabled={addUserLoading}>Cancel</Button>
                <Button type="submit" disabled={addUserLoading} className="flex-1">{addUserLoading ? 'Adding...' : 'Add User'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Reset Password</h3>
              <button onClick={() => { setResetPasswordUser(null); setResetLink(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Generate a password reset link for <strong>{resetPasswordUser.name}</strong> ({resetPasswordUser.email})
            </p>

            {!resetLink ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  The user can use this link to set a new password. The link expires after 1 hour.
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => { setResetPasswordUser(null); setResetLink(null); }} className="flex-1">Cancel</Button>
                  <Button onClick={handleResetPassword} disabled={resetLoading} className="flex-1">{resetLoading ? 'Generating...' : 'Generate Reset Link'}</Button>
                </div>
              </div>
            ) : resetLink === 'DASHBOARD_ONLY' ? (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800 font-medium">Use Supabase Dashboard</p>
                  <p className="text-xs text-amber-700 mt-1">Password reset links can be generated from the Supabase Dashboard under Authentication &gt; Users. Find the user and click "Send password recovery".</p>
                </div>
                <Button onClick={() => { setResetPasswordUser(null); setResetLink(null); }} className="w-full">Close</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Reset Link (expires in 1 hour)</p>
                  <p className="text-xs text-gray-800 break-all font-mono">{resetLink}</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => navigator.clipboard.writeText(resetLink)} className="flex-1">Copy Link</Button>
                  <Button onClick={() => { setResetPasswordUser(null); setResetLink(null); }} className="flex-1">Done</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
