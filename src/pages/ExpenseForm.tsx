import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Receipt, Save, Upload, X, Download, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useCurrencyFormatter } from '../lib/currency-utils'; // Added our new hook!
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
  
  // Bring in the dynamic active currencies
  const { activeCurrencies } = useCurrencyFormatter();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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

  // Set the default currency safely once activeCurrencies load (if this is a new expense)
  useEffect(() => {
    if (activeCurrencies && activeCurrencies.length > 0 && !formData.currency_id && !id) {
      setFormData(prev => ({ ...prev, currency_id: activeCurrencies[0].id }));
    }
  }, [activeCurrencies, formData.currency_id, id]);

  useEffect(() => {
    if (formData.currency_id && activeCurrencies.length > 0) {
      const currency = activeCurrencies.find(c => c.id === formData.currency_id);
      if (currency) {
        // We cast as unknown as Currency to ensure TS knows about decimal_places
        setSelectedCurrency(currency as unknown as Currency);
      }
    }
  }, [formData.currency_id, activeCurrencies]);

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
      const [categoriesRes, paymentRes, accountsRes, usersRes] = await Promise.all([
        supabase.from('expense_categories').select('id, name, color').eq('is_active', true).order('name'),
        supabase.from('payment_categories').select('id, name').eq('is_active', true).order('name'),
        supabase.from('accounts').select('id, name, account_number, account_type').eq('is_active', true).is('deleted_at', null).order('name'),
        supabase.from('user_profiles').select('id, email').eq('is_active', true).order('email'),
      ]);

      if (categoriesRes.data) setExpenseCategories(categoriesRes.data);
      if (paymentRes.data) setPaymentCategories(paymentRes.data);
      if (accountsRes.data) setAccounts(accountsRes.data);
      if (usersRes.data) setUsers(usersRes.data);
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
    } catch (err: any
