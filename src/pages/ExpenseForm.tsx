import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Receipt, Save, Upload, X, Download, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import {
  uploadFile,
  deleteFile,
  formatFileSize,
  getFileIcon,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  UploadedFile,
  downloadFile
} from '../lib/file-upload-utils';

interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

interface PaymentCategory {
  id: string;
  name: string;
}

interface Account {
  id: string;
  name: string;
  account_number: string;
  account_type: string;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
}

interface UserProfile {
  id: string;
  email: string;
}

export default function ExpenseForm() {
  const navigate = useNavigate();
  const { id, slug } = useParams<{ id?: string; slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [formData, setFormData] = useState({
    expense_category_id: '',
    payment_category_id: '',
    account_id: '',
    currency_id: '',
    assigned_to_user_id: '',
    amount_excluding_tax: '',
    tax_percentage: '',
    tax_amount: '',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    fetchCategories();
    if (id) {
      fetchExpense();
      fetchAttachments();
    }
  }, [id]);

  useEffect(() => {
    if (formData.currency_id && currencies.length > 0) {
      const currency = currencies.find(c => c.id === formData.currency_id);
      if (currency) {
        setSelectedCurrency(currency);
      }
    }
  }, [formData.currency_id, currencies]);

  useEffect(() => {
    const fetchAccountBalance = async () => {
      if (formData.account_id && selectedCurrency) {
        try {
          const { data, error } = await supabase
            .from('account_balances')
            .select('balance')
            .eq('account_id', formData.account_id)
            .eq('currency', selectedCurrency.code)
            .maybeSingle();

          if (error) throw error;
          setAccountBalance(data?.balance ? parseFloat(data.balance) : 0);
        } catch (error) {
          console.error('Error fetching account balance:', error);
          setAccountBalance(0);
        }
      } else {
        setAccountBalance(0);
      }
    };

    fetchAccountBalance();
  }, [formData.account_id, selectedCurrency]);

  const fetchCategories = async () => {
    try {
      const [categoriesRes, paymentRes, accountsRes, currenciesRes, usersRes] = await Promise.all([
        supabase.from('expense_categories').select('id, name, color').eq('is_active', true).order('name'),
        supabase.from('payment_categories').select('id, name').eq('is_active', true).order('name'),
        supabase.from('accounts').select('id, name, account_number, account_type').eq('is_active', true).is('deleted_at', null).order('name'),
        supabase.from('currencies').select('id, code, name, symbol, decimal_places').order('display_order'),
        supabase.from('user_profiles').select('id, email').eq('is_active', true).order('email'),
      ]);

      if (categoriesRes.data) setExpenseCategories(categoriesRes.data);
      if (paymentRes.data) setPaymentCategories(paymentRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (usersRes.data) setUsers(usersRes.data);
      if (currenciesRes.data) {
        setCurrencies(currenciesRes.data);
        if (currenciesRes.data.length > 0 && !id) {
          const defaultCurrency = currenciesRes.data[0];
          setFormData(prev => ({ ...prev, currency_id: defaultCurrency.id }));
        }
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchExpense = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          expense_category_id: data.expense_category_id,
          payment_category_id: data.payment_category_id,
          account_id: data.account_id || '',
          currency_id: data.currency_id || '',
          assigned_to_user_id: data.assigned_to_user_id || '',
          amount_excluding_tax: data.amount_excluding_tax?.toString() || '',
          tax_percentage: data.tax_percentage?.toString() || '',
          tax_amount: data.tax_amount?.toString() || '0',
          amount: data.amount.toString(),
          description: data.description,
          expense_date: data.expense_date,
          notes: data.notes || '',
        });
        if (data.account_id) {
          const account = accounts.find(a => a.id === data.account_id);
          if (account) setSelectedAccount(account);
        }
      }
    } catch (error) {
      console.error('Error fetching expense:', error);
      setError('Failed to load expense');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttachments = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('expense_attachments')
        .select('*')
        .eq('expense_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setAttachments(data);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError(`File ${file.name} has an unsupported type`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`File ${file.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteAttachment = async (attachment: UploadedFile) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;

    try {
      await deleteFile('expense-attachments', attachment.file_path);

      const { error } = await supabase
        .from('expense_attachments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', attachment.id);

      if (error) throw error;

      setAttachments(prev => prev.filter(a => a.id !== attachment.id));
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      setError(error.message || 'Failed to delete attachment');
    }
  };

  const handleDownloadAttachment = async (attachment: UploadedFile) => {
    try {
      const blob = await downloadFile('expense-attachments', attachment.file_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading attachment:', error);
      setError(error.message || 'Failed to download attachment');
    }
  };

  const handleViewAttachment = async (attachment: UploadedFile) => {
    try {
      const blob = await downloadFile('expense-attachments', attachment.file_path);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error: any) {
      console.error('Error viewing attachment:', error);
      setError(error.message || 'Failed to view attachment');
    }
  };

  const calculateTax = (baseAmount: string, taxPercentage: string) => {
    const base = parseFloat(baseAmount);
    const taxRate = parseFloat(taxPercentage);

    if (isNaN(base) || isNaN(taxRate) || base <= 0 || taxRate < 0) {
      return { taxAmount: 0, totalAmount: base || 0 };
    }

    const taxAmount = (base * taxRate) / 100;
    const totalAmount = base + taxAmount;

    return { taxAmount, totalAmount };
  };

  const handleAmountChange = (value: string, field: 'amount_excluding_tax' | 'tax_percentage') => {
    const newFormData = { ...formData, [field]: value };

    if (field === 'amount_excluding_tax' || field === 'tax_percentage') {
      const { taxAmount, totalAmount } = calculateTax(
        field === 'amount_excluding_tax' ? value : formData.amount_excluding_tax,
        field === 'tax_percentage' ? value : formData.tax_percentage
      );

      newFormData.tax_amount = taxAmount.toFixed(2);
      newFormData.amount = totalAmount.toFixed(2);
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!user) {
        setError('You must be logged in to create an expense');
        setSaving(false);
        return;
      }

      if (!formData.expense_category_id || !formData.payment_category_id || !formData.currency_id) {
        setError('Please select category, payment method, and currency');
        setSaving(false);
        return;
      }

      const amountExcludingTax = parseFloat(formData.amount_excluding_tax);
      const taxAmount = parseFloat(formData.tax_amount) || 0;
      const totalAmount = parseFloat(formData.amount);

      if (isNaN(amountExcludingTax) || amountExcludingTax <= 0) {
        setError('Please enter a valid amount excluding tax');
        setSaving(false);
        return;
      }

      const expenseData = {
        user_id: user.id,
        company_id: userProfile?.company_id || null,
        expense_category_id: formData.expense_category_id,
        payment_category_id: formData.payment_category_id,
        account_id: formData.account_id || null,
        currency_id: formData.currency_id,
        assigned_to_user_id: formData.assigned_to_user_id || null,
        amount_excluding_tax: amountExcludingTax,
        tax_amount: taxAmount,
        tax_percentage: formData.tax_percentage ? parseFloat(formData.tax_percentage) : null,
        amount: totalAmount,
        description: formData.description,
        expense_date: formData.expense_date,
        notes: formData.notes,
      };

      let expenseId = id;

      if (id) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update({ ...expenseData, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (updateError) throw updateError;
      } else {
        const { data: newExpense, error: insertError } = await supabase
          .from('expenses')
          .insert(expenseData)
          .select()
          .single();

        if (insertError) throw insertError;
        expenseId = newExpense.id;
      }

      if (selectedFiles.length > 0 && expenseId) {
        setUploadingFiles(true);
        try {
          for (const file of selectedFiles) {
            const filePath = await uploadFile(file, 'expense-attachments', expenseId);

            const { error: attachmentError } = await supabase
              .from('expense_attachments')
              .insert({
                expense_id: expenseId,
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                file_type: file.type,
                uploaded_by: user.id,
              });

            if (attachmentError) throw attachmentError;
          }
        } catch (uploadError: any) {
          console.error('Error uploading files:', uploadError);
          setError('Expense saved, but some files failed to upload: ' + uploadError.message);
          setUploadingFiles(false);
          return;
        }
        setUploadingFiles(false);
      }

      navigate(p('/expenses'));
    } catch (err: any) {
      console.error('Error saving expense:', err);
      setError(err.message || 'Failed to save expense');
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(p('/expenses'))}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Expenses</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-8">
            <div className="flex items-center gap-3">
              <Receipt className="w-8 h-8 text-white" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {id ? 'Edit Expense' : 'Add New Expense'}
                </h1>
                <p className="text-slate-200 text-sm mt-1">
                  {id ? 'Update expense details' : 'Record a new business expense'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expense Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.expense_category_id}
                  onChange={(e) => setFormData({ ...formData, expense_category_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a category</option>
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.payment_category_id}
                  onChange={(e) => setFormData({ ...formData, payment_category_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select payment method</option>
                  {paymentCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.currency_id}
                  onChange={(e) => setFormData({ ...formData, currency_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select currency</option>
                  {currencies.map((curr) => (
                    <option key={curr.id} value={curr.id}>
                      {curr.code} {curr.symbol ? `(${curr.symbol})` : ''} - {curr.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Account
                </label>
                <select
                  value={formData.account_id}
                  onChange={(e) => {
                    const accountId = e.target.value;
                    setFormData({ ...formData, account_id: accountId });
                    const account = accounts.find(a => a.id === accountId);
                    setSelectedAccount(account || null);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No account (manual tracking)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.account_type})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Select an account to automatically deduct this expense
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to User
                </label>
                <select
                  value={formData.assigned_to_user_id}
                  onChange={(e) => setFormData({ ...formData, assigned_to_user_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Not assigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Assign this expense to a specific user for tracking
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount Excluding Tax <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                    {selectedCurrency?.symbol || '$'}
                  </span>
                  <input
                    type="number"
                    step={selectedCurrency?.decimal_places === 0 ? "1" : "0.01"}
                    min="0"
                    value={formData.amount_excluding_tax}
                    onChange={(e) => handleAmountChange(e.target.value, 'amount_excluding_tax')}
                    className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={selectedCurrency?.decimal_places === 0 ? "0" : "0.00"}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Percentage (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tax_percentage}
                  onChange={(e) => handleAmountChange(e.target.value, 'tax_percentage')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Enter tax rate (e.g., 18 for 18%)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                    {selectedCurrency?.symbol || '$'}
                  </span>
                  <input
                    type="number"
                    step={selectedCurrency?.decimal_places === 0 ? "1" : "0.01"}
                    value={formData.tax_amount}
                    className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                    placeholder={selectedCurrency?.decimal_places === 0 ? "0" : "0.00"}
                    readOnly
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Calculated automatically
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                    {selectedCurrency?.symbol || '$'}
                  </span>
                  <input
                    type="number"
                    step={selectedCurrency?.decimal_places === 0 ? "1" : "0.01"}
                    value={formData.amount}
                    className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg bg-blue-50 text-blue-900 font-semibold"
                    placeholder={selectedCurrency?.decimal_places === 0 ? "0" : "0.00"}
                    readOnly
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Amount + Tax (calculated automatically)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {selectedAccount && formData.amount && parseFloat(formData.amount) > 0 && selectedCurrency && (
              <div className={`p-4 rounded-lg border ${
                accountBalance - parseFloat(formData.amount) < 0
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      Account Balance Impact ({selectedCurrency.code})
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Current Balance: <span className="font-semibold">{selectedCurrency.symbol}{accountBalance.toFixed(selectedCurrency.decimal_places)}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      After Expense: <span className={`font-semibold ${
                        accountBalance - parseFloat(formData.amount) < 0 ? 'text-orange-700' : 'text-green-700'
                      }`}>
                        {selectedCurrency.symbol}{(accountBalance - parseFloat(formData.amount)).toFixed(selectedCurrency.decimal_places)}
                      </span>
                    </p>
                    {accountBalance - parseFloat(formData.amount) < 0 && (
                      <p className="text-sm text-orange-700 font-medium mt-2">
                        This will create a negative balance. The expense will be recorded and tracked until funds are available.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief description of the expense"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any additional details about this expense"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attachments
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Upload receipts, invoices, or other supporting documents (Images, PDF, Word - Max 10MB each)
              </p>

              {id && attachments.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Existing Attachments:</p>
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl">{getFileIcon(attachment.file_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {attachment.file_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(attachment.file_size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewAttachment(attachment)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(attachment)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(attachment)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept={ALLOWED_FILE_TYPES.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Click to upload files
                  </span>
                  <span className="text-xs text-gray-500">
                    or drag and drop
                  </span>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Files to upload:</p>
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl">{getFileIcon(file.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(p('/expenses'))}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || uploadingFiles}>
                <Save className="w-4 h-4" />
                {uploadingFiles ? 'Uploading files...' : saving ? 'Saving...' : id ? 'Update Expense' : 'Create Expense'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
