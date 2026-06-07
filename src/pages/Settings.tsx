import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Save, Plus, Trash2, Upload, X, User, Lock, Mail, Receipt, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import ExpenseSettings from '../components/ExpenseSettings';

interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string;
  letterhead_url: string;
  header_display_mode: 'text' | 'logo' | 'both';
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  email: string;
  bank_name: string;
  account_number: string;
  routing_number: string;
  account_holder_name: string;
  document_numbering_mode: 'auto' | 'manual';
  document_number_prefix: string;
  document_number_counter: number;
  footer_content: string;
  default_terms: string;
}

interface CompanyCustomField {
  id: string;
  company_settings_id: string;
  field_label: string;
  field_value: string;
  display_order: number;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_active: boolean;
  display_order: number;
}

interface DefaultClientField {
  id: string;
  field_label: string;
  field_value: string;
  display_order: number;
}

export default function Settings() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { user, companyId: contextCompanyId, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [customFields, setCustomFields] = useState<CompanyCustomField[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingAccount, setUpdatingAccount] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'company' | 'expenses' | 'defaults' | 'theme'>('user');

  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');

  const [defaultClientFields, setDefaultClientFields] = useState<DefaultClientField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [companyFetched, setCompanyFetched] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (contextCompanyId) {
      setUserCompanyId(contextCompanyId);
      setCompanyFetched(true);
      fetchSettings(contextCompanyId);
      fetchCurrencies(contextCompanyId);
      fetchDefaultClientFields(contextCompanyId);
    } else if (contextCompanyId === null && user) {
      // User loaded but has no company (e.g., superadmin)
      setCompanyFetched(true);
      setLoading(false);
    }
  }, [contextCompanyId, user, authLoading]);

  const fetchSettings = async (companyId?: string) => {
    const targetCompanyId = companyId || userCompanyId;
    if (!targetCompanyId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', targetCompanyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        await fetchCustomFields(data.id);
      } else {
        const { data: newData, error: insertError } = await supabase
          .from('company_settings')
          .insert({
            user_id: user.id,
            company_id: targetCompanyId,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newData);
        await fetchCustomFields(newData.id);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      showMessage('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async (companySettingsId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_custom_fields')
        .select('*')
        .eq('company_settings_id', companySettingsId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCustomFields(data || []);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    }
  };

  const fetchDefaultClientFields = async (companyId?: string) => {
    const targetCompanyId = companyId || userCompanyId;
    if (!user?.id || !targetCompanyId) return;

    try {
      const { data, error } = await supabase
        .from('default_client_fields')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setDefaultClientFields(data || []);
    } catch (error) {
      console.error('Error fetching default client fields:', error);
    }
  };

  const handleAddDefaultClientField = async () => {
    if (!user?.id || !newFieldLabel.trim()) return;

    try {
      const { error } = await supabase
        .from('default_client_fields')
        .insert({
          field_label: newFieldLabel,
          field_value: newFieldValue,
          display_order: defaultClientFields.length,
          user_id: user.id,
        });

      if (error) throw error;

      setNewFieldLabel('');
      setNewFieldValue('');
      fetchDefaultClientFields();
      setMessage({ type: 'success', text: 'Default field added successfully!' });
    } catch (error) {
      console.error('Error adding default field:', error);
      setMessage({ type: 'error', text: 'Failed to add default field' });
    }
  };

  const handleDeleteDefaultClientField = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('default_client_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;

      fetchDefaultClientFields();
      setMessage({ type: 'success', text: 'Default field deleted successfully!' });
    } catch (error) {
      console.error('Error deleting default field:', error);
      setMessage({ type: 'error', text: 'Failed to delete default field' });
    }
  };

  const updateDefaultClientFieldLocally = (fieldId: string, updates: Partial<DefaultClientField>) => {
    setDefaultClientFields(fields =>
      fields.map(field =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    );
  };

  const handleUpdateDefaultClientField = async (fieldId: string, updates: Partial<DefaultClientField>) => {
    try {
      const { error } = await supabase
        .from('default_client_fields')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', fieldId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Default field updated successfully!' });
    } catch (error) {
      console.error('Error updating default field:', error);
      setMessage({ type: 'error', text: 'Failed to update default field' });
      fetchDefaultClientFields();
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: settings.company_name,
          logo_url: settings.logo_url,
          letterhead_url: settings.letterhead_url,
          header_display_mode: settings.header_display_mode,
          address_line1: settings.address_line1,
          address_line2: settings.address_line2,
          city: settings.city,
          state: settings.state,
          zip_code: settings.zip_code,
          country: settings.country,
          phone: settings.phone,
          email: settings.email,
          bank_name: settings.bank_name,
          account_number: settings.account_number,
          routing_number: settings.routing_number,
          account_holder_name: settings.account_holder_name,
          document_numbering_mode: settings.document_numbering_mode,
          document_number_prefix: settings.document_number_prefix,
          document_number_counter: settings.document_number_counter,
          footer_content: settings.footer_content,
          default_terms: settings.default_terms,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;

      window.dispatchEvent(new Event('company-settings-updated'));
      showMessage('success', 'Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const updateField = (field: keyof CompanySettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const addCustomField = async () => {
    if (!settings) return;

    try {
      const newField = {
        company_settings_id: settings.id,
        field_label: 'Custom Field',
        field_value: '',
        display_order: customFields.length,
      };

      const { data, error } = await supabase
        .from('company_custom_fields')
        .insert(newField)
        .select()
        .single();

      if (error) throw error;

      setCustomFields([...customFields, data]);
    } catch (error) {
      console.error('Error adding custom field:', error);
      showMessage('error', 'Failed to add custom field');
    }
  };

  const updateCustomFieldLocally = (id: string, updates: Partial<CompanyCustomField>) => {
    setCustomFields(
      customFields.map((field) => (field.id === id ? { ...field, ...updates } : field))
    );
  };

  const updateCustomFieldInDB = async (id: string, updates: Partial<CompanyCustomField>) => {
    try {
      const { error } = await supabase
        .from('company_custom_fields')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating custom field:', error);
      showMessage('error', 'Failed to update custom field');
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !settings) return;

    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${settings.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      if (settings.logo_url && settings.logo_url.includes('supabase')) {
        try {
          const oldFileName = settings.logo_url.split('/').pop();
          if (oldFileName) {
            await supabase.storage
              .from('company-logos')
              .remove([oldFileName]);
          }
        } catch (err) {
          console.log('Could not remove old logo:', err);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('company_settings')
        .update({ logo_url: publicUrl })
        .eq('id', settings.id);

      if (updateError) throw updateError;

      setSettings({ ...settings, logo_url: publicUrl });
      window.dispatchEvent(new Event('company-settings-updated'));
      showMessage('success', 'Logo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      showMessage('error', 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!settings || !settings.logo_url) return;

    try {
      if (settings.logo_url.includes('supabase')) {
        try {
          const fileName = settings.logo_url.split('/').pop();
          if (fileName) {
            await supabase.storage
              .from('company-logos')
              .remove([fileName]);
          }
        } catch (err) {
          console.log('Could not remove logo from storage:', err);
        }
      }

      const { error } = await supabase
        .from('company_settings')
        .update({ logo_url: '' })
        .eq('id', settings.id);

      if (error) throw error;

      setSettings({ ...settings, logo_url: '' });
      window.dispatchEvent(new Event('company-settings-updated'));
      showMessage('success', 'Logo removed successfully!');
    } catch (error) {
      console.error('Error removing logo:', error);
      showMessage('error', 'Failed to remove logo');
    }
  };

  const handleLetterheadUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !settings) return;

    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Please upload an image file');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `letterhead-${settings.id}-${Date.now()}.${fileExt}`;

      if (settings.letterhead_url && settings.letterhead_url.includes('supabase')) {
        try {
          const oldFileName = settings.letterhead_url.split('/').pop();
          if (oldFileName) {
            await supabase.storage.from('company-logos').remove([oldFileName]);
          }
        } catch (err) {
          console.log('Could not remove old letterhead:', err);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('company_settings')
        .update({ letterhead_url: publicUrl })
        .eq('id', settings.id);

      if (updateError) throw updateError;

      setSettings({ ...settings, letterhead_url: publicUrl });
      showMessage('success', 'Letterhead uploaded successfully!');
    } catch (error) {
      console.error('Error uploading letterhead:', error);
      showMessage('error', 'Failed to upload letterhead');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLetterhead = async () => {
    if (!settings || !settings.letterhead_url) return;

    try {
      if (settings.letterhead_url.includes('supabase')) {
        try {
          const fileName = settings.letterhead_url.split('/').pop();
          if (fileName) {
            await supabase.storage.from('company-logos').remove([fileName]);
          }
        } catch (err) {
          console.log('Could not remove letterhead from storage:', err);
        }
      }

      const { error } = await supabase
        .from('company_settings')
        .update({ letterhead_url: '' })
        .eq('id', settings.id);

      if (error) throw error;

      setSettings({ ...settings, letterhead_url: '' });
      showMessage('success', 'Letterhead removed successfully!');
    } catch (error) {
      console.error('Error removing letterhead:', error);
      showMessage('error', 'Failed to remove letterhead');
    }
  };

  const deleteCustomField = async (id: string) => {
    try {
      const { error } = await supabase
        .from('company_custom_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCustomFields(customFields.filter((field) => field.id !== id));
      showMessage('success', 'Custom field deleted');
    } catch (error) {
      console.error('Error deleting custom field:', error);
      showMessage('error', 'Failed to delete custom field');
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail) {
      showMessage('error', 'Please enter a new email address');
      return;
    }

    setUpdatingAccount(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      showMessage('success', 'Email updated successfully! Please check your new email for confirmation.');
      setNewEmail('');
    } catch (error) {
      console.error('Error updating email:', error);
      showMessage('error', 'Failed to update email');
    } finally {
      setUpdatingAccount(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters long');
      return;
    }

    setUpdatingAccount(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      showMessage('success', 'Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      showMessage('error', 'Failed to update password');
    } finally {
      setUpdatingAccount(false);
    }
  };

  const fetchCurrencies = async (companyId?: string) => {
    const targetCompanyId = companyId || userCompanyId;
    if (!targetCompanyId) return;

    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        if (!user) return;

        const defaultCurrencies = [
          { code: 'USD', name: 'US Dollar', symbol: '$', display_order: 0, company_id: targetCompanyId },
          { code: 'EUR', name: 'Euro', symbol: '€', display_order: 1, company_id: targetCompanyId },
          { code: 'GBP', name: 'British Pound', symbol: '£', display_order: 2, company_id: targetCompanyId },
        ];

        const { data: insertedCurrencies, error: insertError } = await supabase
          .from('currencies')
          .insert(defaultCurrencies)
          .select();

        if (insertError) throw insertError;
        setCurrencies(insertedCurrencies || []);
      } else {
        setCurrencies(data);
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  };

  const addCurrency = async () => {
    if (!newCurrencyCode || !newCurrencyName) {
      showMessage('error', 'Please enter currency code and name');
      return;
    }

    if (!user) {
      showMessage('error', 'You must be logged in to add currencies');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('currencies')
        .insert({
          code: newCurrencyCode.toUpperCase(),
          name: newCurrencyName,
          symbol: newCurrencySymbol,
          display_order: currencies.length,
          company_id: userCompanyId,
        })
        .select()
        .single();

      if (error) throw error;

      setCurrencies([...currencies, data]);
      setNewCurrencyCode('');
      setNewCurrencyName('');
      setNewCurrencySymbol('');
      showMessage('success', 'Currency added successfully!');
    } catch (error) {
      console.error('Error adding currency:', error);
      showMessage('error', 'Failed to add currency');
    }
  };

  const deleteCurrency = async (id: string) => {
    try {
      const { error } = await supabase
        .from('currencies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCurrencies(currencies.filter((currency) => currency.id !== id));
      showMessage('success', 'Currency deleted successfully!');
    } catch (error) {
      console.error('Error deleting currency:', error);
      showMessage('error', 'Failed to delete currency');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(p('/dashboard'))}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-8">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-slate-200 text-sm mt-1">
                  Manage your account and company information
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200">
            <nav className="flex gap-1 px-6">
              <button
                onClick={() => setActiveTab('user')}
                className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'user'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <User className="w-4 h-4" />
                User Account
              </button>
              {userCompanyId && (
                <>
                  <button
                    onClick={() => setActiveTab('company')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'company'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    Company Information
                  </button>
                  <button
                    onClick={() => setActiveTab('expenses')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'expenses'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    Transactions
                  </button>
                  <button
                    onClick={() => setActiveTab('defaults')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'defaults'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <SettingsIcon className="w-4 h-4" />
                    Defaults
                  </button>
                </>
              )}
            </nav>
          </div>

          <div className="p-6">
            {message && (
              <div
                className={`p-4 rounded-lg mb-6 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            {activeTab === 'user' && (
              <section className="space-y-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    <h3 className="font-medium text-gray-900">Current Email</h3>
                  </div>
                  <p className="text-gray-700 font-medium">{user?.email}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Account created: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Update Email Address</h3>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter new email address"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Button
                      onClick={handleUpdateEmail}
                      disabled={updatingAccount || !newEmail}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updatingAccount ? 'Updating...' : 'Update Email'}
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Lock className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Change Password</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 6 characters)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <Button
                      onClick={handleUpdatePassword}
                      disabled={updatingAccount || !currentPassword || !newPassword || !confirmPassword}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {updatingAccount ? 'Updating...' : 'Change Password'}
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'company' && !settings && (
              <div className="text-center py-12">
                <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg font-medium">No company associated</p>
                <p className="text-gray-500 text-sm mt-2">
                  SuperAdmins don't have an associated company. Use the SaaS Admin panel to manage companies.
                </p>
              </div>
            )}

            {activeTab === 'company' && settings && (
              <div className="space-y-8">
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={settings.company_name}
                    onChange={(e) => updateField('company_name', e.target.value)}
                    placeholder="Your Company Name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Logo
                  </label>
                  {settings.logo_url ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <img
                          src={settings.logo_url}
                          alt="Company Logo"
                          className="h-16 w-auto object-contain"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-gray-600">Current logo</p>
                        </div>
                        <button
                          onClick={handleRemoveLogo}
                          className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                        >
                          <X className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                      <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-slate-500 cursor-pointer transition-colors">
                        <Upload className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">
                          {uploading ? 'Uploading...' : 'Replace Logo'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-slate-500 cursor-pointer transition-colors">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">
                          {uploading ? 'Uploading...' : 'Upload Company Logo'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG, or SVG</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Invoice Letterhead
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Upload a custom letterhead image that will appear at the top of exported invoices and documents. Recommended: wide banner format (e.g. 1200x300px).
                  </p>
                  {settings.letterhead_url ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                        <img
                          src={settings.letterhead_url}
                          alt="Invoice Letterhead"
                          className="w-full h-auto max-h-40 object-contain"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-slate-500 cursor-pointer transition-colors flex-1">
                          <Upload className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-600">
                            {uploading ? 'Uploading...' : 'Replace Letterhead'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLetterheadUpload}
                            disabled={uploading}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={handleRemoveLetterhead}
                          className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium border border-red-200"
                        >
                          <X className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-slate-500 cursor-pointer transition-colors">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">
                          {uploading ? 'Uploading...' : 'Upload Invoice Letterhead'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG — wide banner format recommended</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLetterheadUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Header Display
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => updateField('header_display_mode', 'text')}
                      className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                        settings.header_display_mode === 'text'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Text Only
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('header_display_mode', 'logo')}
                      className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                        settings.header_display_mode === 'logo'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Logo Only
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('header_display_mode', 'both')}
                      className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                        settings.header_display_mode === 'both'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Logo & Text
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Choose how your company branding appears in the header
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="contact@company.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Address</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    value={settings.address_line1}
                    onChange={(e) => updateField('address_line1', e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={settings.address_line2}
                    onChange={(e) => updateField('address_line2', e.target.value)}
                    placeholder="Suite 100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                    <input
                      type="text"
                      value={settings.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="New York"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                    <input
                      type="text"
                      value={settings.state}
                      onChange={(e) => updateField('state', e.target.value)}
                      placeholder="NY"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      value={settings.zip_code}
                      onChange={(e) => updateField('zip_code', e.target.value)}
                      placeholder="10001"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    value={settings.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    placeholder="United States"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Banking Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={settings.bank_name}
                    onChange={(e) => updateField('bank_name', e.target.value)}
                    placeholder="First National Bank"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={settings.account_holder_name}
                    onChange={(e) => updateField('account_holder_name', e.target.value)}
                    placeholder="Your Company Name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={settings.account_number}
                    onChange={(e) => updateField('account_number', e.target.value)}
                    placeholder="123456789"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Routing Number
                  </label>
                  <input
                    type="text"
                    value={settings.routing_number}
                    onChange={(e) => updateField('routing_number', e.target.value)}
                    placeholder="021000021"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Numbering</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numbering Mode
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateField('document_numbering_mode', 'manual')}
                      className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                        settings.document_numbering_mode === 'manual'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Manual Entry
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('document_numbering_mode', 'auto')}
                      className={`px-4 py-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                        settings.document_numbering_mode === 'auto'
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      Auto-Generated
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {settings.document_numbering_mode === 'manual'
                      ? 'You will manually enter document numbers when creating new documents'
                      : 'Document numbers will be automatically generated using the prefix and counter below'}
                  </p>
                </div>

                {settings.document_numbering_mode === 'auto' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Number Prefix
                      </label>
                      <input
                        type="text"
                        value={settings.document_number_prefix}
                        onChange={(e) => updateField('document_number_prefix', e.target.value)}
                        placeholder="DOC-"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Example: With prefix "INV-2025-" and counter 1, the document number will be "INV-2025-1"
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Next Document Number
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={settings.document_number_counter}
                        onChange={(e) => updateField('document_number_counter', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Current next document number: <span className="font-medium">{settings.document_number_prefix}{settings.document_number_counter}</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Custom Fields</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Add custom fields to include additional information in your documents
                  </p>
                </div>
                <button
                  onClick={addCustomField}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Field
                </button>
              </div>

              {customFields.length > 0 ? (
                <div className="space-y-3">
                  {customFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Field Label
                          </label>
                          <input
                            type="text"
                            value={field.field_label}
                            onChange={(e) =>
                              updateCustomFieldLocally(field.id, { field_label: e.target.value })
                            }
                            onBlur={(e) =>
                              updateCustomFieldInDB(field.id, { field_label: e.target.value })
                            }
                            placeholder="e.g., Website, Tax ID, Registration Number"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Field Value
                          </label>
                          <input
                            type="text"
                            value={field.field_value}
                            onChange={(e) =>
                              updateCustomFieldLocally(field.id, { field_value: e.target.value })
                            }
                            onBlur={(e) =>
                              updateCustomFieldInDB(field.id, { field_value: e.target.value })
                            }
                            placeholder="Enter value"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => deleteCustomField(field.id)}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors mt-5"
                        title="Delete field"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500">
                    No custom fields added yet. Click "Add Field" to create one.
                  </p>
                </div>
              )}
            </section>

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Company Settings'}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'expenses' && <ExpenseSettings />}

            {activeTab === 'defaults' && (
              <div className="space-y-8">
                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 uppercase tracking-wide">Client Details</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Configure default custom fields that will appear when creating new invoices and quotes.
                    These fields help you collect consistent client information.
                  </p>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-gray-50">
                      <h3 className="font-medium text-gray-900 mb-4">Add New Default Field</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Field Label <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            placeholder="e.g., Contact Person, PO Number, Location"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Value (Optional)
                          </label>
                          <input
                            type="text"
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                            placeholder="e.g., N/A, TBD"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button
                          onClick={handleAddDefaultClientField}
                          disabled={!newFieldLabel.trim()}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Field
                        </Button>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-200">
                      {defaultClientFields.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <SettingsIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="font-medium">No default fields configured</p>
                          <p className="text-sm mt-1">Add fields above to get started</p>
                        </div>
                      ) : (
                        defaultClientFields.map((field, index) => (
                          <div key={field.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Field Label</label>
                                  <input
                                    type="text"
                                    value={field.field_label}
                                    onChange={(e) => updateDefaultClientFieldLocally(field.id, { field_label: e.target.value })}
                                    onBlur={(e) => handleUpdateDefaultClientField(field.id, { field_label: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">Default Value</label>
                                  <input
                                    type="text"
                                    value={field.field_value}
                                    onChange={(e) => updateDefaultClientFieldLocally(field.id, { field_value: e.target.value })}
                                    onBlur={(e) => handleUpdateDefaultClientField(field.id, { field_value: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 font-medium min-w-[60px]">
                                  Order: {index + 1}
                                </span>
                                <button
                                  onClick={() => handleDeleteDefaultClientField(field.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete field"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <SettingsIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="text-sm text-blue-900">
                        <p className="font-medium mb-1">How it works:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800">
                          <li>These fields will automatically appear when creating new invoices or quotes</li>
                          <li>You can edit field labels and default values at any time</li>
                          <li>Changes here will only affect new documents, not existing ones</li>
                          <li>Fields appear in the Client Details section in the order shown</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 uppercase tracking-wide">Currency Management</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Manage currencies available for documents and transactions throughout your application.
                  </p>

                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-gray-50">
                      <h3 className="font-medium text-gray-900 mb-4">Add New Currency</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Currency Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newCurrencyCode}
                            onChange={(e) => setNewCurrencyCode(e.target.value)}
                            placeholder="USD"
                            maxLength={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Currency Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newCurrencyName}
                            onChange={(e) => setNewCurrencyName(e.target.value)}
                            placeholder="US Dollar"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Symbol (Optional)
                          </label>
                          <input
                            type="text"
                            value={newCurrencySymbol}
                            onChange={(e) => setNewCurrencySymbol(e.target.value)}
                            placeholder="$"
                            maxLength={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button
                          onClick={addCurrency}
                          disabled={!newCurrencyCode || !newCurrencyName}
                          className="flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Currency
                        </Button>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-200">
                      {currencies.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                          <SettingsIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="font-medium">No currencies configured</p>
                          <p className="text-sm mt-1">Add currencies above to get started</p>
                        </div>
                      ) : (
                        currencies.map((currency) => (
                          <div key={currency.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-base shadow-sm">
                                  {currency.symbol || currency.code.substring(0, 2)}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-base">{currency.code}</p>
                                  <p className="text-sm text-gray-600">{currency.name}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => deleteCurrency(currency.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete currency"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <SettingsIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="text-sm text-blue-900">
                        <p className="font-medium mb-1">How it works:</p>
                        <ul className="list-disc list-inside space-y-1 text-blue-800">
                          <li>Currencies configured here are available when creating invoices and quotes</li>
                          <li>Each document can use a different currency based on your client's needs</li>
                          <li>Add commonly used currencies like USD, EUR, GBP, or local currencies</li>
                          <li>The currency symbol appears on all financial documents and reports</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </section>

                {settings && (
                  <>
                  <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 uppercase tracking-wide">Footer Management</h2>
                    <p className="text-sm text-gray-600 mb-6">
                      Configure a footer that will appear consistently at the bottom of all pages in your application.
                    </p>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Footer Content
                          </label>
                          <textarea
                            value={settings.footer_content || ''}
                            onChange={(e) => updateField('footer_content', e.target.value)}
                            placeholder="e.g., © 2024 Your Company Name. All rights reserved. | Contact: info@example.com | Phone: +1-234-567-8900"
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            This footer will appear on all pages. You can include copyright information, contact details, or any other relevant information.
                          </p>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200">
                          <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Footer'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          <SettingsIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-sm text-blue-900">
                          <p className="font-medium mb-1">How it works:</p>
                          <ul className="list-disc list-inside space-y-1 text-blue-800">
                            <li>The footer appears at the bottom of every page in your application</li>
                            <li>Changes to the footer are applied immediately across all pages</li>
                            <li>Use this space for copyright notices, contact information, or legal disclaimers</li>
                            <li>Leave blank if you don't want a footer to appear</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 uppercase tracking-wide">Terms Management</h2>
                    <p className="text-sm text-gray-600 mb-6">
                      Set the default terms text that will be pre-filled on every new document you create. You can still edit terms on individual documents.
                    </p>

                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Terms
                          </label>
                          <textarea
                            value={settings.default_terms || ''}
                            onChange={(e) => updateField('default_terms', e.target.value)}
                            placeholder="e.g., Payment is due within 30 days. Late payments may incur a 2% monthly fee."
                            rows={5}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            This text will automatically appear in the Terms field of every new document. Leave blank for no default terms.
                          </p>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-200">
                          <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Terms'}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          <SettingsIcon className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="text-sm text-amber-900">
                          <p className="font-medium mb-1">How it works:</p>
                          <ul className="list-disc list-inside space-y-1 text-amber-800">
                            <li>The default terms are applied only to newly created documents</li>
                            <li>Existing documents are not affected</li>
                            <li>You can override the terms on any individual document</li>
                            <li>Leave blank if you prefer to write terms manually each time</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </section>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
