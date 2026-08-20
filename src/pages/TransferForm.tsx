import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';
import { useCurrencyFormatter } from '../lib/currency-utils'; // Inject the dynamic currency hook

type Account = Database['public']['Tables']['accounts']['Row'];

interface AccountBalance {
  currency: string;
  balance: number;
}

export default function TransferForm() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { userProfile, companyId } = useAuth();
  
  // Bring in the dynamic active currencies and the symbol formatter from global state
  const { activeCurrencies, getSymbol } = useCurrencyFormatter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountBalances, setAccountBalances] = useState<Record<string, AccountBalance[]>>({});

  useEffect(() => {
    loadAccounts();
  }, []);

  // Safely set the default currency once activeCurrencies load
  useEffect(() => {
    if (activeCurrencies && activeCurrencies.length > 0 && !currency) {
      setCurrency(activeCurrencies[0].code);
    }
  }, [activeCurrencies, currency]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');

      if (error) throw error;

      setAccounts(data || []);

      const balancesMap: Record<string, AccountBalance[]> = {};
      for (const account of data || []) {
        const { data: balances } = await supabase
          .from('account_balances')
          .select('currency, balance')
          .eq('account_id', account.id);

        balancesMap[account.id] = (balances || []).map(b => ({
          currency: b.currency,
          balance: Number(b.balance)
        }));
      }

      setAccountBalances(balancesMap);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const getAccountBalance = (accountId: string, curr: string): number => {
    const balances = accountBalances[accountId] || [];
    const balance = balances.find(b => b.currency === curr);
    return balance ? balance.balance : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromAccountId || !toAccountId) {
      alert('Please select both source and destination accounts');
      return;
    }

    if (fromAccountId === toAccountId) {
      alert('Source and destination accounts must be different');
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const fromBalance = getAccountBalance(fromAccountId, currency);
    if (transferAmount > fromBalance) {
      alert(`Insufficient funds. Available balance: ${getSymbol(currency)}${fromBalance.toFixed(2)}`);
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('account_transfers').insert([
        {
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: transferAmount,
          currency,
          transfer_date: transferDate,
          description,
          notes: notes || null,
          created_by: userData.user?.id,
          company_id: companyId,
        },
      ]);

      if (error) throw error;

      navigate(p('/accounts'));
    } catch (error) {
      console.error('Error creating transfer:', error);
      alert('Failed to create transfer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fromAccount = accounts.find(a => a.id === fromAccountId);
  const toAccount = accounts.find(a => a.id === toAccountId);
  const fromBalance = fromAccountId ? getAccountBalance(fromAccountId, currency) : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(p('/accounts'))}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Accounts</span>
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="w-8 h-8 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">New Transfer</h1>
                <p className="text-blue-100 text-sm">Transfer funds between accounts</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Account *
                </label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select source account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {fromAccount && accountBalances[fromAccount.id] && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Balances: </span>
                    {accountBalances[fromAccount.id].map((bal, idx) => (
                      <span key={bal.currency}>
                        {idx > 0 && ', '}
                        {getSymbol(bal.currency)}{bal.balance.toFixed(2)} {bal.currency}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Account *
                </label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select destination account</option>
                  {accounts
                    .filter((account) => account.id !== fromAccountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
                {toAccount && accountBalances[toAccount.id] && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">Balances: </span>
                    {accountBalances[toAccount.id].map((bal, idx) => (
                      <span key={bal.currency}>
                        {idx > 0 && ', '}
                        {getSymbol(bal.currency)}{bal.balance.toFixed(2)} {bal.currency}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {fromAccountId && toAccountId && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency *
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select currency</option>
                      {activeCurrencies.map((curr) => (
                        <option key={curr.code} value={curr.code}>
                          {curr.code} - {curr.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    {fromAccountId && (
                      <p className="mt-2 text-sm text-gray-600">
                        Available: {getSymbol(currency)}{fromBalance.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Monthly allocation, Funds rebalancing"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Additional notes or remarks"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate(p('/accounts'))}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Processing...' : 'Create Transfer'}
                  </Button>
                </div>
              </>
            )}

            {!fromAccountId || !toAccountId ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Select both source and destination accounts to continue.
                </p>
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
