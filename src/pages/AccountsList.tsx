import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { getCurrencySymbol } from '../lib/currency-utils';
import { Plus, X, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Account = Database['public']['Tables']['accounts']['Row'];
type AccountInsert = Database['public']['Tables']['accounts']['Insert'];

interface AccountBalance {
  currency: string;
  balance: number;
  symbol: string;
}

interface AccountWithBalances extends Account {
  balances: AccountBalance[];
}

interface Currency {
  id: string;
  code: string;
  name: string;
}

export function AccountsList() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { userProfile, companyId } = useAuth();
  const [accounts, setAccounts] = useState<AccountWithBalances[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<AccountInsert>({
    name: '',
    account_type: 'bank_account',
    account_number: '',
    currency: 'USD',
    is_active: true,
  });

  useEffect(() => {
    loadAccounts();
    loadCurrencies();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;

      const accountsWithBalances = await Promise.all(
        (data || []).map(async (account) => {
          const { data: balances } = await supabase
            .from('account_balances')
            .select('currency, balance')
            .eq('account_id', account.id)
            .order('currency');

          const accountBalances: AccountBalance[] = (balances || []).map(b => ({
            currency: b.currency,
            balance: Number(b.balance),
            symbol: getCurrencySymbol(b.currency)
          }));

          return {
            ...account,
            balances: accountBalances,
          };
        })
      );

      setAccounts(accountsWithBalances);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrencies = async () => {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      setCurrencies(data || []);
    } catch (error) {
      console.error('Error loading currencies:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userProfile?.company_id) {
      alert('Unable to create account: Company information not found.');
      return;
    }

    try {
      if (editingAccount) {
        const { error } = await supabase
          .from('accounts')
          .update(formData)
          .eq('id', editingAccount.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('accounts').insert([{
          ...formData,
          company_id: userProfile.company_id
        }]);

        if (error) throw error;
      }

      loadAccounts();
      closeModal();
    } catch (error) {
      console.error('Error saving account:', error);
      alert('Failed to save account. Please try again.');
    }
  };

  const openModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name,
        account_type: account.account_type,
        account_number: account.account_number,
        currency: account.currency,
        is_active: account.is_active,
      });
    } else {
      setEditingAccount(null);
      setFormData({
        name: '',
        account_type: 'bank_account',
        account_number: '',
        currency: currencies.length > 0 ? currencies[0].code : 'USD',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const toggleActive = async (account: Account) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id);

      if (error) throw error;
      loadAccounts();
    } catch (error) {
      console.error('Error toggling account status:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm sm:text-base">Loading accounts...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wide mb-2">PAYMENT MANAGEMENT</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">Accounts</h1>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button onClick={() => navigate(p('/transfers/new'))} variant="secondary" className="flex-1 sm:flex-initial">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfer
            </Button>
            <Button onClick={() => openModal()} className="flex-1 sm:flex-initial">
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="bg-white rounded-xl p-8 sm:p-12 text-center">
            <p className="text-gray-500 text-sm sm:text-base mb-4">No accounts yet</p>
            <Button onClick={() => openModal()} className="w-full sm:w-auto">Add Your First Account</Button>
          </div>
        ) : (
          <>
            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Account Name
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Type
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">
                        Account Number
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Balances
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {accounts.map((account) => (
                      <tr
                        key={account.id}
                        onClick={() => navigate(p(`/accounts/${account.id}`))}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 lg:px-6 py-4 text-sm font-medium text-gray-900">{account.name}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 capitalize">
                          {account.account_type.replace('_', ' ')}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 hidden md:table-cell">
                          {account.account_number || '-'}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm">
                          {account.balances.length === 0 ? (
                            <span className="text-gray-400">No transactions</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {account.balances.map((bal) => (
                                <span
                                  key={bal.currency}
                                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                                    bal.balance < 0
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {bal.symbol}{bal.balance.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} {bal.currency}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm hidden md:table-cell">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              account.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm">
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openModal(account)}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleActive(account)}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              {account.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sm:hidden space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  onClick={() => navigate(p(`/accounts/${account.id}`))}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-blue-500 cursor-pointer transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className="font-bold text-lg mb-1">{account.name}</p>
                      <p className="text-sm text-gray-600 capitalize mb-1">
                        {account.account_type.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {account.account_number ? `Account: ${account.account_number}` : 'No account number'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        account.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-gray-200 space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Balances</p>
                      {account.balances.length === 0 ? (
                        <p className="text-sm text-gray-400">No transactions</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {account.balances.map((bal) => (
                            <span
                              key={bal.currency}
                              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${
                                bal.balance < 0
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {bal.symbol}{bal.balance.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} {bal.currency}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openModal(account)}
                        className="px-3 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(account)}
                        className="px-3 py-1.5 text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                      >
                        {account.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold">
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Business Account"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type *
                  </label>
                  <select
                    value={formData.account_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        account_type: e.target.value as AccountInsert['account_type'],
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    required
                  >
                    <option value="bank_account">Bank Account</option>
                    <option value="paypal">PayPal</option>
                    <option value="stripe">Stripe</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency *
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        currency: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    required
                  >
                    {currencies.length === 0 ? (
                      <option value="">No currencies available</option>
                    ) : (
                      currencies.map((currency) => (
                        <option key={currency.id} value={currency.code}>
                          {currency.code} - {currency.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={formData.account_number || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, account_number: e.target.value })
                  }
                  placeholder="Last 4 digits or identifier"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 text-black focus:ring-black border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Account is active
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="secondary" onClick={closeModal} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingAccount ? 'Update Account' : 'Add Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
