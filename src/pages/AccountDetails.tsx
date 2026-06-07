import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Filter, ArrowRightLeft, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { getCurrencySymbol } from '../lib/currency-utils';
import { DeleteModal } from '../components/DeleteModal';
import { useAuth } from '../contexts/AuthContext';

interface Account {
  id: string;
  name: string;
  account_number: string;
  account_type: string;
  currency: string;
  is_active: boolean;
}

interface AccountBalance {
  currency: string;
  balance: number;
  symbol: string;
}

interface Transaction {
  id: string;
  type: 'payment' | 'expense' | 'deposit' | 'transfer_in' | 'transfer_out';
  date: string;
  description: string;
  amount: number;
  currency: string;
  category?: string;
  document_number?: string;
  client_name?: string;
  related_account?: string;
}

export default function AccountDetails() {
  const { id, slug } = useParams<{ id: string; slug: string }>();
  const navigate = useNavigate();
  const p = (path: string) => `/${slug}${path}`;
  const { companyId } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'payment' | 'expense' | 'deposit' | 'transfer'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadAccountDetails();
    }
  }, [id]);

  const loadAccountDetails = async () => {
    try {
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (accountError) throw accountError;
      if (!accountData) {
        navigate(p('/accounts'));
        return;
      }

      setAccount(accountData);

      const { data: balances } = await supabase
        .from('account_balances')
        .select('currency, balance')
        .eq('account_id', id)
        .order('currency');

      const accountBalances: AccountBalance[] = (balances || []).map(b => ({
        currency: b.currency,
        balance: Number(b.balance),
        symbol: getCurrencySymbol(b.currency)
      }));

      setAccountBalances(accountBalances);

      const [{ data: payments }, { data: expenses }, { data: deposits }, { data: transfersOut }, { data: transfersIn }] = await Promise.all([
        supabase
          .from('payments')
          .select(`
            id,
            amount,
            currency,
            payment_date,
            notes,
            documents (
              document_number,
              deleted_at,
              customers (name)
            )
          `)
          .eq('account_id', id)
          .is('deleted_at', null)
          .order('payment_date', { ascending: false }),
        supabase
          .from('expenses')
          .select(`
            id,
            amount,
            expense_date,
            description,
            notes,
            expense_categories (name),
            currencies (code)
          `)
          .eq('account_id', id)
          .is('deleted_at', null)
          .order('expense_date', { ascending: false }),
        supabase
          .from('deposits')
          .select(`
            id,
            amount,
            deposit_date,
            description,
            notes,
            currencies (code)
          `)
          .eq('account_id', id)
          .is('deleted_at', null)
          .order('deposit_date', { ascending: false }),
        supabase
          .from('account_transfers')
          .select(`
            id,
            amount,
            currency,
            transfer_date,
            description,
            notes,
            to_account_id,
            accounts!account_transfers_to_account_id_fkey (name)
          `)
          .eq('from_account_id', id)
          .is('deleted_at', null)
          .order('transfer_date', { ascending: false }),
        supabase
          .from('account_transfers')
          .select(`
            id,
            amount,
            currency,
            transfer_date,
            description,
            notes,
            from_account_id,
            accounts!account_transfers_from_account_id_fkey (name)
          `)
          .eq('to_account_id', id)
          .is('deleted_at', null)
          .order('transfer_date', { ascending: false }),
      ]);

      const paymentTransactions: Transaction[] = (payments || [])
        .filter((payment: any) => !payment.documents?.deleted_at)
        .map((payment: any) => ({
          id: payment.id,
          type: 'payment' as const,
          date: payment.payment_date,
          description: payment.notes || 'Payment received',
          amount: payment.amount,
          currency: payment.currency,
          document_number: payment.documents?.document_number,
          client_name: payment.documents?.customers?.name,
        }));

      const expenseTransactions: Transaction[] = (expenses || []).map((expense: any) => ({
        id: expense.id,
        type: 'expense' as const,
        date: expense.expense_date,
        description: expense.description,
        amount: expense.amount,
        currency: expense.currencies?.code || 'USD',
        category: expense.expense_categories?.name,
      }));

      const depositTransactions: Transaction[] = (deposits || []).map((deposit: any) => ({
        id: deposit.id,
        type: 'deposit' as const,
        date: deposit.deposit_date,
        description: deposit.description || 'Deposit',
        amount: deposit.amount,
        currency: deposit.currencies?.code || 'USD',
      }));

      const transferOutTransactions: Transaction[] = (transfersOut || []).map((transfer: any) => ({
        id: transfer.id,
        type: 'transfer_out' as const,
        date: transfer.transfer_date,
        description: transfer.description,
        amount: transfer.amount,
        currency: transfer.currency,
        related_account: transfer.accounts?.name,
      }));

      const transferInTransactions: Transaction[] = (transfersIn || []).map((transfer: any) => ({
        id: transfer.id,
        type: 'transfer_in' as const,
        date: transfer.transfer_date,
        description: transfer.description,
        amount: transfer.amount,
        currency: transfer.currency,
        related_account: transfer.accounts?.name,
      }));

      const allTransactions = [
        ...paymentTransactions,
        ...expenseTransactions,
        ...depositTransactions,
        ...transferOutTransactions,
        ...transferInTransactions
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error loading account details:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    let typeMatch = false;
    if (filter === 'all') {
      typeMatch = true;
    } else if (filter === 'transfer') {
      typeMatch = t.type === 'transfer_in' || t.type === 'transfer_out';
    } else {
      typeMatch = t.type === filter;
    }
    const currencyMatch = currencyFilter === 'all' ? true : t.currency === currencyFilter;
    return typeMatch && currencyMatch;
  });

  const availableCurrencies = Array.from(new Set(transactions.map(t => t.currency)));

  const getTotalsByCurrency = () => {
    const totals: Record<string, { received: number; expenses: number }> = {};

    const relevantTransactions = currencyFilter === 'all'
      ? transactions
      : transactions.filter(t => t.currency === currencyFilter);

    relevantTransactions.forEach(t => {
      if (!totals[t.currency]) {
        totals[t.currency] = { received: 0, expenses: 0 };
      }

      if (t.type === 'payment' || t.type === 'deposit' || t.type === 'transfer_in') {
        totals[t.currency].received += t.amount;
      } else {
        totals[t.currency].expenses += t.amount;
      }
    });

    return totals;
  };

  const currencyTotals = getTotalsByCurrency();

  const handleDelete = async () => {
    if (!id) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      navigate(p('/accounts'));
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading account details...</p>
      </div>
    );
  }

  if (!account) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(p('/accounts'))}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Accounts</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{account.name}</h1>
                    <div className="flex flex-wrap gap-4 text-slate-200 text-sm">
                      <span className="capitalize">{account.account_type.replace('_', ' ')}</span>
                      {account.account_number && <span>Account: {account.account_number}</span>}
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        account.is_active ? 'bg-green-500/20 text-green-200' : 'bg-gray-500/20 text-gray-200'
                      }`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => navigate(p('/transfers/new'))}
                      variant="secondary"
                      className="whitespace-nowrap flex-1 sm:flex-none"
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Transfer
                    </Button>
                    <Button
                      onClick={() => setShowDeleteModal(true)}
                      variant="secondary"
                      className="whitespace-nowrap bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-slate-300 text-sm mb-2">Current Balances</p>
                {accountBalances.length === 0 ? (
                  <p className="text-slate-400 text-lg">No transactions yet</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {accountBalances.map((bal) => (
                      <div key={bal.currency} className="flex items-center justify-end gap-2">
                        <span className="text-slate-300 text-sm">{bal.currency}:</span>
                        <span className={`text-2xl font-bold ${
                          bal.balance < 0 ? 'text-red-300' : 'text-white'
                        }`}>
                          {bal.symbol}{bal.balance.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Transaction Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(currencyTotals).map(([currency, totals]) => {
                const symbol = getCurrencySymbol(currency);
                const netAmount = totals.received - totals.expenses;
                return (
                  <div key={currency} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500 uppercase">{currency}</span>
                      <div className={`text-xl font-bold ${netAmount >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        {symbol}{netAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowDownLeft className="w-4 h-4 text-green-600" />
                          <span className="text-gray-600">Received:</span>
                        </div>
                        <span className="font-semibold text-green-600">
                          {symbol}{totals.received.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="w-4 h-4 text-red-600" />
                          <span className="text-gray-600">Expenses:</span>
                        </div>
                        <span className="font-semibold text-red-600">
                          {symbol}{totals.expenses.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filter === 'all' ? 'primary' : 'secondary'}
                    onClick={() => setFilter('all')}
                    className="text-sm"
                  >
                    All
                  </Button>
                  <Button
                    variant={filter === 'payment' ? 'primary' : 'secondary'}
                    onClick={() => setFilter('payment')}
                    className="text-sm"
                  >
                    Payments
                  </Button>
                  <Button
                    variant={filter === 'deposit' ? 'primary' : 'secondary'}
                    onClick={() => setFilter('deposit')}
                    className="text-sm"
                  >
                    Deposits
                  </Button>
                  <Button
                    variant={filter === 'expense' ? 'primary' : 'secondary'}
                    onClick={() => setFilter('expense')}
                    className="text-sm"
                  >
                    Expenses
                  </Button>
                  <Button
                    variant={filter === 'transfer' ? 'primary' : 'secondary'}
                    onClick={() => setFilter('transfer')}
                    className="text-sm"
                  >
                    Transfers
                  </Button>
                </div>
              </div>
              {availableCurrencies.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">Currency:</span>
                  <Button
                    variant={currencyFilter === 'all' ? 'primary' : 'secondary'}
                    onClick={() => setCurrencyFilter('all')}
                    className="text-sm"
                  >
                    All
                  </Button>
                  {availableCurrencies.map((currency) => (
                    <Button
                      key={currency}
                      variant={currencyFilter === currency ? 'primary' : 'secondary'}
                      onClick={() => setCurrencyFilter(currency)}
                      className="text-sm"
                    >
                      {currency}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No transactions found for this account
              </div>
            ) : (
              filteredTransactions.map((transaction) => (
                <div
                  key={`${transaction.type}-${transaction.id}`}
                  className="p-4 sm:p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      transaction.type === 'payment' || transaction.type === 'deposit' || transaction.type === 'transfer_in'
                        ? 'bg-green-100'
                        : transaction.type === 'transfer_out'
                        ? 'bg-blue-100'
                        : 'bg-red-100'
                    }`}>
                      {transaction.type === 'payment' || transaction.type === 'deposit' || transaction.type === 'transfer_in' ? (
                        <ArrowDownLeft className={`w-5 h-5 ${
                          transaction.type === 'transfer_in' ? 'text-blue-700' : 'text-green-700'
                        }`} />
                      ) : transaction.type === 'transfer_out' ? (
                        <ArrowRightLeft className="w-5 h-5 text-blue-700" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-red-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {transaction.description}
                          </h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            <span>{new Date(transaction.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}</span>
                            {transaction.category && (
                              <span className="text-gray-500">• {transaction.category}</span>
                            )}
                            {transaction.document_number && (
                              <span className="text-gray-500">• Invoice {transaction.document_number}</span>
                            )}
                            {transaction.client_name && (
                              <span className="text-gray-500">• {transaction.client_name}</span>
                            )}
                            {transaction.related_account && (
                              <span className="text-gray-500">• {
                                transaction.type === 'transfer_out' ? `To: ${transaction.related_account}` : `From: ${transaction.related_account}`
                              }</span>
                            )}
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className={`text-xl font-bold ${
                            transaction.type === 'payment' || transaction.type === 'deposit' || transaction.type === 'transfer_in'
                              ? 'text-green-700'
                              : transaction.type === 'transfer_out'
                              ? 'text-blue-700'
                              : 'text-red-700'
                          }`}>
                            {transaction.type === 'payment' || transaction.type === 'deposit' || transaction.type === 'transfer_in' ? '+' : '-'}
                            {getCurrencySymbol(transaction.currency)}{transaction.amount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} {transaction.currency}
                          </p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.type === 'payment'
                              ? 'bg-green-100 text-green-800'
                              : transaction.type === 'deposit'
                              ? 'bg-green-100 text-green-800'
                              : transaction.type === 'transfer_in'
                              ? 'bg-blue-100 text-blue-800'
                              : transaction.type === 'transfer_out'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.type === 'payment' && 'Payment'}
                            {transaction.type === 'deposit' && 'Deposit'}
                            {transaction.type === 'expense' && 'Expense'}
                            {transaction.type === 'transfer_in' && 'Transfer In'}
                            {transaction.type === 'transfer_out' && 'Transfer Out'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Account"
          message={`Are you sure you want to delete "${account.name}"? This will move the account to trash where it can be permanently deleted or restored later.`}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
}
