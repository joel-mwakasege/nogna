import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Receipt, Plus, CreditCard as Edit2, Trash2, Filter, X, Download, Calendar, User, Tag, CreditCard, Paperclip, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { DeleteModal } from '../components/DeleteModal';
import { useAuth } from '../contexts/AuthContext';

interface Expense {
  id: string;
  user_id: string;
  expense_category_id: string;
  payment_category_id: string;
  account_id: string | null;
  currency_id: string;
  assigned_to_user_id: string | null;
  amount_excluding_tax: number;
  tax_amount: number;
  tax_percentage: number | null;
  amount: number;
  description: string;
  expense_date: string;
  receipt_url: string;
  notes: string;
  created_at: string;
  expense_categories: { name: string; color: string };
  payment_categories: { name: string };
  user_profiles: { email: string };
  assigned_user: { email: string } | null;
  accounts: { name: string; account_number: string } | null;
  currencies: { code: string; symbol: string; name: string };
}

interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

interface PaymentCategory {
  id: string;
  name: string;
}

export default function ExpenseList() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { user, isAdmin, companyId } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; expenseId: string | null }>({
    isOpen: false,
    expenseId: null,
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
    paymentMethod: '',
    userId: '',
    assignedUserId: '',
    startDate: '',
    endDate: '',
  });
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    description: true,
    category: true,
    payment: true,
    account: true,
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
      const [categoriesRes, paymentRes, usersRes] = await Promise.all([
        supabase.from('expense_categories').select('id, name, color').eq('is_active', true).order('name'),
        supabase.from('payment_categories').select('id, name').eq('is_active', true).order('name'),
        supabase.from('user_profiles').select('id, email').eq('is_active', true).order('email'),
      ]);

      if (categoriesRes.data) setExpenseCategories(categoriesRes.data);
      if (paymentRes.data) setPaymentCategories(paymentRes.data);
      if (usersRes.data) setUsers(usersRes.data);

      let query = supabase
        .from('expenses')
        .select(`
          *,
          expense_categories(name, color),
          payment_categories(name),
          user_profiles!expenses_user_id_fkey(email),
          assigned_user:user_profiles!expenses_assigned_to_user_id_fkey(email),
          accounts(name, account_number),
          currencies(code, symbol, name)
        `)
        .is('deleted_at', null)
        .order('expense_date', { ascending: false });

      if (filters.category) {
        query = query.eq('expense_category_id', filters.category);
      }
      if (filters.paymentMethod) {
        query = query.eq('payment_category_id', filters.paymentMethod);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.assignedUserId) {
        query = query.eq('assigned_to_user_id', filters.assignedUserId);
      }
      if (filters.startDate) {
        query = query.gte('expense_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('expense_date', filters.endDate);
      }

      const { data, error } = await query;

      if (!error && data) {
        setExpenses(data as Expense[]);

        const expenseIds = data.map((expense: Expense) => expense.id);
        if (expenseIds.length > 0) {
          const { data: attachmentsData } = await supabase
            .from('expense_attachments')
            .select('expense_id')
            .in('expense_id', expenseIds)
            .is('deleted_at', null);

          if (attachmentsData) {
            const counts: Record<string, number> = {};
            attachmentsData.forEach((att: { expense_id: string }) => {
              counts[att.expense_id] = (counts[att.expense_id] || 0) + 1;
            });
            setAttachmentCounts(counts);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.expenseId) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteModal.expenseId);

      if (!error) {
        await fetchData();
        setDeleteModal({ isOpen: false, expenseId: null });
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedExpenses.size === expenses.length) {
      setSelectedExpenses(new Set());
    } else {
      setSelectedExpenses(new Set(expenses.map(exp => exp.id)));
    }
  };

  const handleSelectExpense = (expenseId: string) => {
    const newSelected = new Set(selectedExpenses);
    if (newSelected.has(expenseId)) {
      newSelected.delete(expenseId);
    } else {
      newSelected.add(expenseId);
    }
    setSelectedExpenses(newSelected);
  };

  const handleBulkDeleteClick = () => {
    setBulkDeleteModal({ isOpen: true, isDeleting: false });
  };

  const handleConfirmBulkDelete = async () => {
    setBulkDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      const { error } = await supabase
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(selectedExpenses));

      if (error) throw error;

      setSelectedExpenses(new Set());
      setBulkDeleteModal({ isOpen: false, isDeleting: false });
      await fetchData();
    } catch (error) {
      console.error('Error deleting expenses:', error);
      setBulkDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      paymentMethod: '',
      userId: '',
      assignedUserId: '',
      startDate: '',
      endDate: '',
    });
    setSelectedExpenses(new Set());
  };

  const totalsByCurrency = expenses.reduce((totals, expense) => {
    const currencyCode = expense.currencies?.code || 'USD';
    const currencySymbol = expense.currencies?.symbol || '$';

    if (!totals[currencyCode]) {
      totals[currencyCode] = {
        code: currencyCode,
        symbol: currencySymbol,
        total: 0
      };
    }

    totals[currencyCode].total += parseFloat(expense.amount.toString());
    return totals;
  }, {} as Record<string, { code: string; symbol: string; total: number }>);

  const currencyTotals = Object.values(totalsByCurrency);

  const canEditExpense = (expense: Expense) => {
    return isAdmin || expense.user_id === user?.id;
  };

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
              <Receipt className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
            </div>
            <Button onClick={() => navigate(p('/expenses/create'))}>
              <Plus className="w-4 h-4" />
              Add Expense
            </Button>
          </div>
          <p className="text-gray-600">Track and manage company expenses</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Total Expenses</h3>
              {currencyTotals.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {currencyTotals.map((currency) => (
                    <div key={currency.code} className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-500">{currency.code}</span>
                      <p className="text-2xl font-bold text-blue-600">
                        {currency.symbol}{currency.total.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-400">No expenses</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative" ref={columnOptionsRef}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowColumnOptions(!showColumnOptions)}
                  className="w-full sm:w-auto"
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
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Date</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.description}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, description: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Description</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.category}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, category: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Category</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.payment}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, payment: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Payment</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.account}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, account: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Account</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.assignedTo}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, assignedTo: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">Assigned To</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={visibleColumns.amount}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, amount: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Categories</option>
                    {expenseCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={filters.paymentMethod}
                    onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Payment Methods</option>
                    {paymentCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                  <select
                    value={filters.assignedUserId}
                    onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {selectedExpenses.size > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-red-900">
              {selectedExpenses.size} expense{selectedExpenses.size > 1 ? 's' : ''} selected
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
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      checked={selectedExpenses.size === expenses.length && expenses.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
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
                  {visibleColumns.payment && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                  )}
                  {visibleColumns.account && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedExpenses.has(expense.id)}
                        onChange={() => handleSelectExpense(expense.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    {visibleColumns.date && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(expense.expense_date).toLocaleDateString()}
                        </div>
                      </td>
                    )}
                    {visibleColumns.description && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-gray-900">{expense.description}</div>
                          {attachmentCounts[expense.id] > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Paperclip className="w-3 h-3" />
                              {attachmentCounts[expense.id]}
                            </span>
                          )}
                        </div>
                        {expense.notes && (
                          <div className="text-xs text-gray-500 mt-1">{expense.notes}</div>
                        )}
                      </td>
                    )}
                    {visibleColumns.category && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: expense.expense_categories.color }}
                          />
                          <span className="text-sm text-gray-900">{expense.expense_categories.name}</span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.payment && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{expense.payment_categories.name}</span>
                        </div>
                      </td>
                    )}
                    {visibleColumns.account && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expense.accounts ? (
                          <div className="text-sm text-gray-900">{expense.accounts.name}</div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No account</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.assignedTo && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expense.assigned_user ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-gray-900">
                                {expense.assigned_user.email}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 ml-6">
                              Created by: {expense.user_profiles.email}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {expense.user_profiles.email}
                            </span>
                          </div>
                        )}
                      </td>
                    )}
                    {visibleColumns.amount && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {expense.currencies?.symbol || '$'}{parseFloat(expense.amount.toString()).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            {expense.tax_amount > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Base: {expense.currencies?.symbol || '$'}{parseFloat(expense.amount_excluding_tax.toString()).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })} + Tax: {expense.currencies?.symbol || '$'}{parseFloat(expense.tax_amount.toString()).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                                {expense.tax_percentage && ` (${expense.tax_percentage}%)`}
                              </div>
                            )}
                          </div>
                          {!visibleColumns.description && attachmentCounts[expense.id] > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Paperclip className="w-3 h-3" />
                              {attachmentCounts[expense.id]}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {canEditExpense(expense) && (
                          <>
                            <button
                              onClick={() => navigate(p(`/expenses/edit/${expense.id}`))}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteModal({ isOpen: true, expenseId: expense.id })}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {expenses.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No expenses found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new expense.</p>
              <div className="mt-6">
                <Button onClick={() => navigate(p('/expenses/create'))}>
                  <Plus className="w-4 h-4" />
                  Add Expense
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, expenseId: null })}
        onConfirm={handleDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense?"
        itemName=""
        isLoading={false}
      />

      <DeleteModal
        isOpen={bulkDeleteModal.isOpen}
        title="Delete Multiple Expenses"
        message={`Are you sure you want to delete ${selectedExpenses.size} expense${selectedExpenses.size > 1 ? 's' : ''}?`}
        itemName="This action cannot be undone."
        isLoading={bulkDeleteModal.isDeleting}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteModal({ isOpen: false, isDeleting: false })}
      />
    </div>
  );
}
