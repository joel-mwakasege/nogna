import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Building2, Banknote, DollarSign, Tag, Shield, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { useAuth } from '../contexts/AuthContext';

interface SetupWizardProps {
  onClose: () => void;
  companyId: string;
}

interface CompanySettings {
  id?: string;
  company_name: string;
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
}

interface SetupSteps {
  company_info: boolean;
  banking: boolean;
  currencies: boolean;
  categories: boolean;
}

interface Currency {
  id?: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places?: number;
}

interface ExpenseCategory {
  id?: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

interface DepositCategory {
  id?: string;
  name: string;
  description: string;
  is_active: boolean;
}

export default function SetupWizard({ onClose, companyId }: SetupWizardProps) {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<SetupSteps>({
    company_info: false,
    banking: false,
    currencies: false,
    categories: false,
  });

  const [settings, setSettings] = useState<CompanySettings>({
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    phone: '',
    email: '',
    bank_name: '',
    account_number: '',
    routing_number: '',
    account_holder_name: '',
  });

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyDecimals, setNewCurrencyDecimals] = useState(2);

  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [depositCategories, setDepositCategories] = useState<DepositCategory[]>([]);
  const [categoryTab, setCategoryTab] = useState<'expense' | 'deposit'>('expense');
  const [newExpenseCategory, setNewExpenseCategory] = useState({ name: '', description: '', color: '#3B82F6' });
  const [newDepositCategory, setNewDepositCategory] = useState({ name: '', description: '' });

  const steps = [
    {
      id: 'company_info',
      title: 'Company Information',
      icon: Building2,
      description: 'Basic company details for invoices',
    },
    {
      id: 'banking',
      title: 'Banking Details',
      icon: Banknote,
      description: 'Payment information for clients',
    },
    {
      id: 'currencies',
      title: 'Currency Setup',
      icon: DollarSign,
      description: 'Manage currencies for transactions',
    },
    {
      id: 'categories',
      title: 'Transaction Categories',
      icon: Tag,
      description: 'Setup expense and deposit categories',
    },
  ];

  useEffect(() => {
    loadExistingData();
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const loadExistingData = async () => {
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('setup_step_completed')
        .eq('id', companyId)
        .maybeSingle();

      if (company?.setup_step_completed) {
        setCompletedSteps(company.setup_step_completed as SetupSteps);

        const firstIncompleteStep = steps.findIndex(
          (step) => !company.setup_step_completed[step.id]
        );
        if (firstIncompleteStep !== -1) {
          setCurrentStep(firstIncompleteStep);
        }
      }

      const { data: existingSettings } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (existingSettings) {
        setSettings(existingSettings);
      }

      const { data: existingCurrencies } = await supabase
        .from('currencies')
        .select('*')
        .eq('company_id', companyId)
        .order('display_order', { ascending: true });

      if (existingCurrencies && existingCurrencies.length > 0) {
        setCurrencies(existingCurrencies);
      }

      const { data: existingExpenseCategories } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (existingExpenseCategories) {
        setExpenseCategories(existingExpenseCategories);
      }

      const { data: existingDepositCategories } = await supabase
        .from('payment_categories')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (existingDepositCategories) {
        setDepositCategories(existingDepositCategories);
      }
    } catch (error) {
      console.error('Error loading existing data:', error);
    }
  };

  const saveStep = async (stepId: string) => {
    setLoading(true);
    try {
      if (stepId === 'company_info') {
        const { data: existingSettings } = await supabase
          .from('company_settings')
          .select('id')
          .eq('company_id', companyId)
          .maybeSingle();

        if (existingSettings) {
          await supabase
            .from('company_settings')
            .update({
              company_name: settings.company_name,
              address_line1: settings.address_line1,
              address_line2: settings.address_line2,
              city: settings.city,
              state: settings.state,
              zip_code: settings.zip_code,
              country: settings.country,
              phone: settings.phone,
              email: settings.email,
            })
            .eq('id', existingSettings.id);
        } else {
          await supabase
            .from('company_settings')
            .insert({
              user_id: user?.id,
              company_id: companyId,
              company_name: settings.company_name,
              address_line1: settings.address_line1,
              address_line2: settings.address_line2,
              city: settings.city,
              state: settings.state,
              zip_code: settings.zip_code,
              country: settings.country,
              phone: settings.phone,
              email: settings.email,
            });
        }
      }

      if (stepId === 'banking') {
        const { data: existingSettings } = await supabase
          .from('company_settings')
          .select('id')
          .eq('company_id', companyId)
          .maybeSingle();

        if (existingSettings) {
          await supabase
            .from('company_settings')
            .update({
              bank_name: settings.bank_name,
              account_number: settings.account_number,
              routing_number: settings.routing_number,
              account_holder_name: settings.account_holder_name,
            })
            .eq('id', existingSettings.id);
        }
      }

      if (stepId === 'currencies') {
      }

      if (stepId === 'categories') {
      }

      const updatedSteps = { ...completedSteps, [stepId]: true };
      setCompletedSteps(updatedSteps);

      await supabase
        .from('companies')
        .update({ setup_step_completed: updatedSteps })
        .eq('id', companyId);

    } catch (error) {
      console.error('Error saving step:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    await saveStep(steps[currentStep].id);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleSkip = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.id) {
      case 'company_info':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Acme Corporation"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={settings.address_line1}
                  onChange={(e) => setSettings({ ...settings, address_line1: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Main Street"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={settings.address_line2}
                  onChange={(e) => setSettings({ ...settings, address_line2: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Suite 100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={settings.city}
                  onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="New York"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={settings.state}
                  onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="NY"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zip Code</label>
                <input
                  type="text"
                  value={settings.zip_code}
                  onChange={(e) => setSettings({ ...settings, zip_code: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="10001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={settings.country}
                  onChange={(e) => setSettings({ ...settings, country: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="United States"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="info@company.com"
                />
              </div>
            </div>
          </div>
        );

      case 'banking':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              This information will appear on your invoices for client payments
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={settings.bank_name}
                onChange={(e) => setSettings({ ...settings, bank_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Chase Bank"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Account Holder Name
              </label>
              <input
                type="text"
                value={settings.account_holder_name}
                onChange={(e) => setSettings({ ...settings, account_holder_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Acme Corporation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={settings.account_number}
                onChange={(e) => setSettings({ ...settings, account_number: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Routing Number
              </label>
              <input
                type="text"
                value={settings.routing_number}
                onChange={(e) => setSettings({ ...settings, routing_number: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="021000021"
              />
            </div>
          </div>
        );

      case 'currencies':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Manage currencies available for documents and transactions
            </p>

            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-3">Add New Currency</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={newCurrencyCode}
                    onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Symbol</label>
                  <input
                    type="text"
                    value={newCurrencySymbol}
                    onChange={(e) => setNewCurrencySymbol(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="$"
                    maxLength={3}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newCurrencyName}
                    onChange={(e) => setNewCurrencyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="US Dollar"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Decimals</label>
                  <input
                    type="number"
                    value={newCurrencyDecimals}
                    onChange={(e) => setNewCurrencyDecimals(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min={0}
                    max={4}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  if (!newCurrencyCode || !newCurrencyName) return;

                  const newCurrency = {
                    code: newCurrencyCode,
                    name: newCurrencyName,
                    symbol: newCurrencySymbol,
                    decimal_places: newCurrencyDecimals,
                    display_order: currencies.length,
                    user_id: user?.id,
                    company_id: companyId,
                  };

                  const { data, error } = await supabase
                    .from('currencies')
                    .insert(newCurrency)
                    .select()
                    .single();

                  if (!error && data) {
                    setCurrencies([...currencies, data]);
                    setNewCurrencyCode('');
                    setNewCurrencyName('');
                    setNewCurrencySymbol('');
                    setNewCurrencyDecimals(2);
                  }
                }}
                className="mt-3 w-full"
                disabled={!newCurrencyCode || !newCurrencyName}
              >
                Add Currency
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {currencies.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">No currencies added yet</p>
                </div>
              ) : (
                currencies.map((currency) => (
                  <div key={currency.id} className="flex items-center justify-between p-3 border border-slate-300 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                        {currency.symbol || currency.code.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{currency.code}</div>
                        <div className="text-xs text-slate-600">{currency.name}</div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (currency.id) {
                          await supabase.from('currencies').delete().eq('id', currency.id);
                          setCurrencies(currencies.filter(c => c.id !== currency.id));
                        }
                      }}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'categories':
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 mb-4">
              Setup categories for tracking expenses and deposits
            </p>

            <div className="border-b border-slate-200">
              <nav className="-mb-px flex gap-6">
                <button
                  onClick={() => setCategoryTab('expense')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    categoryTab === 'expense'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Expense Categories
                </button>
                <button
                  onClick={() => setCategoryTab('deposit')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    categoryTab === 'deposit'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Deposit Categories
                </button>
              </nav>
            </div>

            {categoryTab === 'expense' ? (
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-3">Add Expense Category</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newExpenseCategory.name}
                      onChange={(e) => setNewExpenseCategory({ ...newExpenseCategory, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Category name (e.g., Office Supplies)"
                    />
                    <textarea
                      value={newExpenseCategory.description}
                      onChange={(e) => setNewExpenseCategory({ ...newExpenseCategory, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Description (optional)"
                      rows={2}
                    />
                    <div className="flex items-center gap-3">
                      <label className="block text-xs font-medium text-slate-700">Color</label>
                      <input
                        type="color"
                        value={newExpenseCategory.color}
                        onChange={(e) => setNewExpenseCategory({ ...newExpenseCategory, color: e.target.value })}
                        className="h-8 w-16 border border-slate-300 rounded cursor-pointer"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!newExpenseCategory.name) return;

                        const { data, error } = await supabase
                          .from('expense_categories')
                          .insert({
                            name: newExpenseCategory.name,
                            description: newExpenseCategory.description,
                            color: newExpenseCategory.color,
                            is_active: true,
                            user_id: user?.id,
                            company_id: companyId,
                          })
                          .select()
                          .single();

                        if (!error && data) {
                          setExpenseCategories([...expenseCategories, data]);
                          setNewExpenseCategory({ name: '', description: '', color: '#3B82F6' });
                        }
                      }}
                      className="w-full"
                      disabled={!newExpenseCategory.name}
                    >
                      Add Expense Category
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {expenseCategories.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                      <Tag className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                      <p className="text-xs">No expense categories added</p>
                    </div>
                  ) : (
                    expenseCategories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-3 border border-slate-300 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: category.color }} />
                          <div>
                            <div className="font-medium text-sm text-slate-900">{category.name}</div>
                            {category.description && (
                              <div className="text-xs text-slate-600">{category.description}</div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (category.id) {
                              await supabase.from('expense_categories').delete().eq('id', category.id);
                              setExpenseCategories(expenseCategories.filter(c => c.id !== category.id));
                            }
                          }}
                          className="text-red-600 hover:text-red-700 p-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-3">Add Deposit Category</h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newDepositCategory.name}
                      onChange={(e) => setNewDepositCategory({ ...newDepositCategory, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Category name (e.g., Client Payment)"
                    />
                    <textarea
                      value={newDepositCategory.description}
                      onChange={(e) => setNewDepositCategory({ ...newDepositCategory, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Description (optional)"
                      rows={2}
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!newDepositCategory.name) return;

                        const { data, error } = await supabase
                          .from('payment_categories')
                          .insert({
                            name: newDepositCategory.name,
                            description: newDepositCategory.description,
                            is_active: true,
                            user_id: user?.id,
                            company_id: companyId,
                          })
                          .select()
                          .single();

                        if (!error && data) {
                          setDepositCategories([...depositCategories, data]);
                          setNewDepositCategory({ name: '', description: '' });
                        }
                      }}
                      className="w-full"
                      disabled={!newDepositCategory.name}
                    >
                      Add Deposit Category
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {depositCategories.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                      <Tag className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                      <p className="text-xs">No deposit categories added</p>
                    </div>
                  ) : (
                    depositCategories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-3 border border-slate-300 rounded-lg">
                        <div>
                          <div className="font-medium text-sm text-slate-900">{category.name}</div>
                          {category.description && (
                            <div className="text-xs text-slate-600">{category.description}</div>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (category.id) {
                              await supabase.from('payment_categories').delete().eq('id', category.id);
                              setDepositCategories(depositCategories.filter(c => c.id !== category.id));
                            }
                          }}
                          className="text-red-600 hover:text-red-700 p-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const totalSteps = steps.length;
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercentage = (completedCount / totalSteps) * 100;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                  {profile?.role === 'owner' ? (
                    <Shield className="w-7 h-7" />
                  ) : profile?.role === 'admin' ? (
                    <Shield className="w-7 h-7" />
                  ) : (
                    <User className="w-7 h-7" />
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-md">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{completedCount}/{totalSteps}</span>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Company Setup</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    profile?.role === 'owner' ? 'bg-blue-100 text-blue-700' :
                    profile?.role === 'admin' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {profile?.role === 'owner' ? 'Owner' : profile?.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                  <span className="text-xs text-slate-500">{progressPercentage.toFixed(0)}% Complete</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = completedSteps[step.id as keyof SetupSteps];
              const isCurrent = index === currentStep;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => setCurrentStep(index)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1 ${
                      isCurrent
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : isCompleted
                        ? 'bg-green-50 text-green-600'
                        : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                    <span className="text-xs hidden sm:inline">{step.title}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-slate-300 mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {steps[currentStep].title}
            </h3>
            <p className="text-slate-600">{steps[currentStep].description}</p>
          </div>

          {renderStepContent()}
        </div>

        <div className="p-6 border-t border-slate-200 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkip}>
              Skip
            </Button>
            <Button onClick={handleNext} disabled={loading}>
              {loading ? (
                'Saving...'
              ) : currentStep === steps.length - 1 ? (
                'Finish'
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
