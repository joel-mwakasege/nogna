import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Wallet, Plus, CreditCard as Edit2, Trash2, Filter, X, Calendar, User, Tag, Paperclip, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { DeleteModal } from '../components/DeleteModal';
import { useAuth } from '../contexts/AuthContext';

interface Deposit {
  id: string;
  payment_category_id: string;
  account_id: string | null;
  currency_id: string;
  assigned_user_id: string | null;
  customer_id: string | null;
  amount_excluding_tax: number;
  tax_amount: number;
  tax_percentage: number | null;
  amount: number;
  description: string;
  deposit_date: string;
  receipt_url: string;
  notes: string;
  created_at: string;
  payment_categories: { name: string };
  assigned_user: { email: string } | null;
  accounts: { name: string; account_number: string } | null;
  customers: { name: string; email: string } | null;
  currencies: { code: string; symbol: string; decimal_places: number };
}

interface PaymentCategory {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
}

export default function DepositList() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { isAdmin, companyId } = useAuth();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDeposits, setSelectedDeposits] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; depositId: string | null }>({
    isOpen: false,
    depositId: null,
  });
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ isOpen: boolean; isDeleting: boolean }>({
    isOpen: false,
    isDeleting: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnOptions, setShowColumnOptions] = useState(false);
  const columnOptionsRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [filters, setFilters] = useState({
    category: '',
    assignedUserId: '',
    customerId: '',
    startDate: '',
    endDate: '',
  });
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    description: true,
    category: true,
    account: true,
    customer: true,
    assignedTo: true,
    amount: true,
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnOptionsRef.current && !columnOptionsRef.current.contains(event.target as Node)) {
        setShowColumnOptions(false);
      }
    };

    if (showColumnOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnOptions]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentRes, usersRes, customersRes] = await Promise.all([
        supabase.from('payment_categories').select('id, name').eq('is_active', true).order('name'),
        supabase.from('user_profiles').select('id, email').eq('is_active', true).order('email'),
        supabase.from('customers').select('id, name, email').is('deleted_at', null).order('name'),
      ]);

      if (paymentRes.data) setPaymentCategories(paymentRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (customersRes.data) setCustomers(customersRes.data);

      let query = supabase
        .from('deposits')
        .select(`
          *,
          payment_categories(name),
          assigned_user:user_profiles!deposits_assigned_user_id_fkey(email),
          accounts(name, account_number),
          customers(name, email),
          currencies(code, symbol, decimal_places)
        `)
        .is('deleted_at', null)
        .order('deposit_date', { ascending: false });

      if (filters.category) {
        query = query.eq('payment_category_id', filters.category);
      }
      if (filters.assignedUserId) {
        query = query.eq('assigned_user_id', filters.assignedUserId);
      }
      if (filters.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters.startDate) {
        query = query.gte('deposit_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('deposit_date', filters.endDate);
      }

      const { data, error } = await query;

      if (!error && data) {
        setDeposits(data as Deposit[]);

        const depositIds = data.map((deposit: Deposit) => deposit.id);
        if (depositIds.length > 0) {
          const { data: attachmentsData } = await supabase
            .from('deposit_attachments')
            .select('deposit_id')
            .in('deposit_id', depositIds)
            .is('deleted_at', null);

          if (attachmentsData) {
            const counts: Record<string, number> = {};
            attachmentsData.forEach((att: { deposit_id: string }) => {
              counts[att.deposit_id] = (counts[att.deposit_id] || 0) + 1;
            });
            setAttachmentCounts(counts);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.depositId) return;

    try {
      const { error } = await supabase
        .from('deposits')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteModal.depositId);

      if (!error) {
        await fetchData();
        setDeleteModal({ isOpen: false, depositId: null });
      }
    } catch (error) {
      console.error('Error deleting deposit:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedDeposits.size === deposits.length) {
      setSelectedDeposits(new Set());
    } else {
      setSelectedDeposits(new Set(deposits.map(dep => dep.id)));
    }
  };

  const handleSelectDeposit = (depositId: string) => {
    const newSelected = new Set(selectedDeposits);
    if (newSelected.has(depositId)) {
      newSelected.delete(depositId);
    } else {
      newSelected.add(depositId);
    }
    setSelectedDeposits(newSelected);
  };

  const handleBulkDeleteClick = () => {
    setBulkDeleteModal({ isOpen: true, isDeleting: false });
  };

  const handleConfirmBulkDelete = async () => {
    setBulkDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      const { error } = await supabase
        .from('deposits')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(selectedDeposits));

      if (error) throw error;

      setSelectedDeposits(new Set());
      setBulkDeleteModal({ isOpen: false, isDeleting: false });
      await fetchData();
    } catch (error) {
      console.error('Error deleting deposits:', error);
      setBulkDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      assignedUserId: '',
      customerId: '',
      startDate: '',
      endDate: '',
    });
    setSelectedDeposits(new Set());
  };

  const totalsByCurrency = deposits.reduce((totals, deposit) => {
    const currency = deposit.currencies || { code: 'USD', symbol: '$', decimal_places: 2 };
    const currencyCode = currency.code;

    if (!totals[currencyCode]) {
      totals[currencyCode] = {
        code: currencyCode,
        symbol: currency.symbol,
        decimal_places: currency.decimal_places,
        total: 0
      };
    }

    totals[currencyCode].total += parseFloat(deposit.amount.toString());
    return totals;
  }, {} as Record<string, { code: string; symbol: string; decimal_places: number; total: number }>);

  const currencyTotals = Object.values(totalsByCurrency);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-green-600" />
              <h1 className="text-3xl font-bold text-gray-900">Deposits</h1>
            </div>
            {isAdmin && (
              <Button onClick={() => navigate(p('/deposits/create'))}>
                <Plus className="w-4 h-4" />
                Add Deposit
              </Button>
            )}
          </div>
          <p className="text-gray-600">Track and manage income and deposits</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Total Deposits</h3>
              {currencyTotals.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {currencyTotals.map((currency) => (
                    <div key={currency.code} className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-500">{currency.code}</span>
                      <p className="text-2xl font-bold text-green-600">
                        {currency.symbol}{currency.total.toLocaleString('en-US', {
                          minimumFractionDigits: currency.decimal_places,
                          maximumFractionDigits: currency.decimal_places
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-400">No deposits</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={columnOptionsRef}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowColumnOptions(!showColumnOptions)}
                >
                  <Settings className="w-4 h-4" />
                  Columns
                </Button>
                {showColumnOptions && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <div className="p-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Show Columns</h4>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.date}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, date: e.target.checked })}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Date</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.description}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, description: e.target.checked })}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Description</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.category}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, category: e.target.checked })}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Category</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.account}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, account: e.target.checked })}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Account</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.customer}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, customer: e.target.checked })}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Customer</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.assignedTo}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, assignedTo: e.target.checked })}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Assigned To</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.amount}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, amount: e.target.checked })}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">Amount</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Categories</option>
                    {paymentCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select
                    value={filters.customerId}
                    onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Customers</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                  <select
                    value={filters.assignedUserId}
                    onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">All Users</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4" />
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </div>

        {selectedDeposits.size > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-red-900">
              {selectedDeposits.size} deposit{selectedDeposits.size > 1 ? 's' : ''} selected
            </span>
            <Button
              onClick={handleBulkDeleteClick}
              variant="danger"
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isAdmin && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedDeposits.size === deposits.length && deposits.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                    </th>
                  )}
                  {visibleColumns.date && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  )}
                  {visibleColumns.description && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                  )}
                  {visibleColumns.category && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                  )}
                  {visibleColumns.account && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account
                    </th>
                  )}
                  {visibleColumns.customer && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                  )}
                  {visibleColumns.assignedTo && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                  )}
                  {visibleColumns.amount && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  )}
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deposits.map((deposit) => {
                  const currency = deposit.currencies || { symbol: '$', decimal_places: 2, code: 'USD' };
                  return (
                    <tr key={deposit.id} className="hover:bg-gray-50">
                      {isAdmin && (
                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedDeposits.has(deposit.id)}
                            onChange={() => handleSelectDeposit(deposit.id)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(deposit.deposit_date).toLocaleDateString()}
                          </div>
                        </td>
                      )}
                      {visibleColumns.description && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-gray-900">{deposit.description}</div>
                            {attachmentCounts[deposit.id] > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Paperclip className="w-3 h-3" />
                                {attachmentCounts[deposit.id]}
                              </span>
                            )}
                          </div>
                          {deposit.notes && (
                            <div className="text-xs text-gray-500 mt-1">{deposit.notes}</div>
                          )}
                        </td>
                      )}
                      {visibleColumns.category && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-900">{deposit.payment_categories.name}</span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.account && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {deposit.accounts ? (
                            <div className="text-sm text-gray-900">{deposit.accounts.name}</div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No account</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.customer && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {deposit.customers ? (
                            <div className="text-sm text-gray-900">
                              {deposit.customers.name}
                              {deposit.customers.email && (
                                <div className="text-xs text-gray-500 mt-1">{deposit.customers.email}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No customer</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.assignedTo && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {deposit.assigned_user ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {deposit.assigned_user.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not assigned</span>
                          )}
                        </td>
                      )}
                      {visibleColumns.amount && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-sm font-semibold text-green-600">
                                {currency.symbol}{parseFloat(deposit.amount.toString()).toLocaleString('en-US', {
                                  minimumFractionDigits: currency.decimal_places,
                                  maximumFractionDigits: currency.decimal_places,
                                })}
                              </div>
                              {deposit.tax_amount > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Base: {currency.symbol}{parseFloat(deposit.amount_excluding_tax.toString()).toLocaleString('en-US', {
                                    minimumFractionDigits: currency.decimal_places,
                                    maximumFractionDigits: currency.decimal_places,
                                  })} + Tax: {currency.symbol}{parseFloat(deposit.tax_amount.toString()).toLocaleString('en-US', {
                                    minimumFractionDigits: currency.decimal_places,
                                    maximumFractionDigits: currency.decimal_places,
                                  })}
                                  {deposit.tax_percentage && ` (${deposit.tax_percentage}%)`}
                                </div>
                              )}
                            </div>
                            {!visibleColumns.description && attachmentCounts[deposit.id] > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <Paperclip className="w-3 h-3" />
                                {attachmentCounts[deposit.id]}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(p(`/deposits/edit/${deposit.id}`))}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, depositId: deposit.id })}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {deposits.length === 0 && (
            <div className="text-center py-12">
              <Wallet className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No deposits found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new deposit.</p>
              {isAdmin && (
                <div className="mt-6">
                  <Button onClick={() => navigate(p('/deposits/create'))}>
                    <Plus className="w-4 h-4" />
                    Add Deposit
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, depositId: null })}
        onConfirm={handleDelete}
        title="Delete Deposit"
        message="Are you sure you want to delete this deposit?"
        itemName=""
        isLoading={false}
      />

      <DeleteModal
        isOpen={bulkDeleteModal.isOpen}
        title="Delete Multiple Deposits"
        message={`Are you sure you want to delete ${selectedDeposits.size} deposit${selectedDeposits.size > 1 ? 's' : ''}?`}
        itemName="This action cannot be undone."
        isLoading={bulkDeleteModal.isDeleting}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteModal({ isOpen: false, isDeleting: false })}
      />
    </div>
  );
}
