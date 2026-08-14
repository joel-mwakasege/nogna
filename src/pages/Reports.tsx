import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Calendar,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  PieChart,
  FileSpreadsheet,
  FileDown,
  LayoutDashboard,
  Coins
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { formatCurrency } from '../lib/currency-utils';
import html2pdf from 'html2pdf.js';

interface RevenueByPeriod {
  year: number;
  month: number;
  currency: string;
  document_count: number;
  total_revenue: number;
}

interface ProfitAndLoss {
  year: number;
  month: number;
  currency: string;
  invoice_revenue: number;
  deposit_revenue: number;
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  expenses_by_category: Array<{ category: string; amount: number }> | null;
}

interface CustomerRevenue {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  currency: string | null;
  total_invoices: number;
  paid_invoices: number;
  outstanding_invoices: number;
  total_paid: number;
  total_outstanding: number;
  last_invoice_date: string | null;
}

interface OutstandingInvoice {
  document_id: string;
  document_number: string;
  customer_name: string;
  customer_email: string;
  currency: string;
  issue_date: string;
  status: string;
  days_outstanding: number;
  amount_due: number;
  amount_paid: number;
  balance_due: number;
}

interface DocumentTotal {
  document_id: string;
  document_number: string;
  document_type: string;
  customer_name: string;
  currency: string;
  issue_date: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  tax_percent: number;
  project_events?: string;
  location?: string;
  paid?: number;
  balance?: number;
  payment_history?: Array<{ date: string; amount: number }>;
}

interface PaymentLogEntry {
  id: string;
  payment_date: string;
  amount: number;
  currency: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  document_number: string;
  customer_name: string;
  account_name: string;
}

interface ExpenseCategoryItem {
  id: string;
  name: string;
  classification: 'cogs' | 'operating' | 'admin';
  color?: string;
}

interface CompanySettings {
  company_name: string | null;
  logo_url: string | null;
  letterhead_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  currency?: string | null;
}

interface CurrencyFinancialStatement {
  currency: string;
  totalSalesRevenue: number;
  totalCollected: number;
  totalUnpaid: number;
  cogsBreakdown: Record<string, number>;
  totalCOGS: number;
  grossProfit: number;
  operatingBreakdown: Record<string, number>;
  totalOperating: number;
  adminBreakdown: Record<string, number>;
  totalAdmin: number;
  totalExpenses: number;
  profitBeforeTax: number;
}

interface VisibleSections {
  profitLoss: boolean;
  revenueByPeriod: boolean;
  customerRevenue: boolean;
  outstandingInvoices: boolean;
  invoiceList: boolean;
  paymentsLog: boolean;
}

interface VisibleColumns {
  invoiceList: {
    invoiceDate: boolean;
    client: boolean;
    project: boolean;
    location: boolean;
    invoiceNumber: boolean;
    taxRate: boolean;
    totalAmount: boolean;
    paid: boolean;
    balance: boolean;
    status: boolean;
    paymentDates: boolean;
  };
  paymentsLog: {
    paymentDate: boolean;
    invoiceNumber: boolean;
    client: boolean;
    account: boolean;
    paymentMethod: boolean;
    reference: boolean;
    notes: boolean;
    amount: boolean;
  };
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  return `${day}-${month}`;
};

const mapStatus = (status: string) => {
  switch (status) {
    case 'paid':
      return 'f/p';
    case 'partially_paid':
      return 'h/p';
    case 'unpaid':
      return 'unpaid';
    default:
      return status;
  }
};

const DEFAULT_VISIBLE_SECTIONS: VisibleSections = {
  profitLoss: true,
  revenueByPeriod: true,
  customerRevenue: true,
  outstandingInvoices: true,
  invoiceList: true,
  paymentsLog: true,
};

const DEFAULT_VISIBLE_COLUMNS: VisibleColumns = {
  invoiceList: {
    invoiceDate: true,
    client: true,
    project: true,
    location: true,
    invoiceNumber: true,
    taxRate: true,
    totalAmount: true,
    paid: true,
    balance: true,
    status: true,
    paymentDates: true,
  },
  paymentsLog: {
    paymentDate: true,
    invoiceNumber: true,
    client: true,
    account: true,
    paymentMethod: true,
    reference: true,
    notes: true,
    amount: true,
  },
};

export default function Reports() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { isAdmin, companyId } = useAuth();

  const [activeReportTab, setActiveReportTab] = useState<'statement' | 'overview'>('statement');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // Date filters
  const [tempDateFrom, setTempDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [tempDateTo, setTempDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [tempSelectedCurrency, setTempSelectedCurrency] = useState('all');

  const [dateFrom, setDateFrom] = useState(tempDateFrom);
  const [dateTo, setDateTo] = useState(tempDateTo);
  const [selectedCurrency, setSelectedCurrency] = useState(tempSelectedCurrency);
  const [currencies, setCurrencies] = useState<Array<{ code: string; symbol: string }>>([]);

  // Data collections
  const [revenueData, setRevenueData] = useState<RevenueByPeriod[]>([]);
  const [customerData, setCustomerData] = useState<CustomerRevenue[]>([]);
  const [outstandingData, setOutstandingData] = useState<OutstandingInvoice[]>([]);
  const [documentData, setDocumentData] = useState<DocumentTotal[]>([]);
  const [profitLossData, setProfitLossData] = useState<ProfitAndLoss[]>([]);
  const [paymentsLogData, setPaymentsLogData] = useState<PaymentLogEntry[]>([]);
  const [categoriesList, setCategoriesList] = useState<ExpenseCategoryItem[]>([]);
  const [expensesData, setExpensesData] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  // Active statement currency pill tab
  const [activeStatementCurrency, setActiveStatementCurrency] = useState<string>('');

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profitloss: true,
    documents: true,
  });

  const [visibleSections, setVisibleSections] = useState<VisibleSections>(() => {
    try {
      const stored = localStorage.getItem('nogna_report_visible_sections');
      return stored ? JSON.parse(stored) : DEFAULT_VISIBLE_SECTIONS;
    } catch {
      return DEFAULT_VISIBLE_SECTIONS;
    }
  });

  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>(() => {
    try {
      const stored = localStorage.getItem('nogna_report_visible_columns');
      return stored ? JSON.parse(stored) : DEFAULT_VISIBLE_COLUMNS;
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });

  const [showConfigPanel, setShowConfigPanel] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate(p('/dashboard'));
      return;
    }
    fetchCurrencies();
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin && companyId) {
      setInitialLoading(true);
      fetchAllReportData(dateFrom, dateTo, selectedCurrency).finally(() => {
        setInitialLoading(false);
      });
    }
  }, [isAdmin, companyId]);

  const fetchCurrencies = async () => {
    const { data } = await supabase
      .from('currencies')
      .select('code, symbol')
      .order('code');

    if (data && data.length > 0) {
      setCurrencies(data);
    }
  };

  const fetchAllReportData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    setLoading(true);
    try {
      await Promise.all([
        fetchCompanySettings(),
        fetchRevenueData(from, to, currency),
        fetchCustomerData(from, to, currency),
        fetchOutstandingData(from, to, currency),
        fetchDocumentData(from, to, currency),
        fetchProfitLossData(from, to, currency),
        fetchPaymentsLog(from, to, currency),
        fetchExpensesData(from, to, currency)
      ]);
    } catch (err) {
      console.error("fetchAllReportData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanySettings = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('company_settings')
      .select('company_name, logo_url, letterhead_url, address_line1, address_line2, city, phone, email, currency')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) setCompanySettings(data);
  };

  const handleApplyFilters = () => {
    setDateFrom(tempDateFrom);
    setDateTo(tempDateTo);
    setSelectedCurrency(tempSelectedCurrency);
    fetchAllReportData(tempDateFrom, tempDateTo, tempSelectedCurrency);
  };

  const handleRefresh = () => {
    fetchAllReportData(dateFrom, dateTo, selectedCurrency);
  };

  const fetchExpensesData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;

    const { data: catData } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('company_id', companyId);

    if (catData) setCategoriesList(catData as ExpenseCategoryItem[]);

    let query = supabase
      .from('expenses')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (from) query = query.gte('expense_date', from);
    if (to) query = query.lte('expense_date', to);

    const { data: expData, error: expError } = await query;
    if (!expError && expData) {
      const filtered = currency !== 'all'
        ? expData.filter((e: any) => e.currency === currency)
        : expData;
      setExpensesData(filtered);
    }
  };

  const fetchRevenueData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const fromYear = fromDate.getFullYear();
    const fromMonth = fromDate.getMonth() + 1;
    const toYear = toDate.getFullYear();
    const toMonth = toDate.getMonth() + 1;

    let query = supabase
      .from('revenue_by_period_view')
      .select('*')
      .eq('company_id', companyId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      const filtered = (data as any[]).filter(item => {
        const itemYear = Number(item.year);
        const itemMonth = Number(item.month);
        const afterStart = itemYear > fromYear || (itemYear === fromYear && itemMonth >= fromMonth);
        const beforeEnd = itemYear < toYear || (itemYear === toYear && itemMonth <= toMonth);
        return afterStart && beforeEnd;
      });
      setRevenueData(filtered);
    }
  };

  const fetchCustomerData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    const { data: customers } = await supabase
      .from('customers')
      .select('id, email, created_at')
      .eq('company_id', companyId)
      .is('deleted_at', null);

    const emailMap: Record<string, string> = {};
    if (customers) {
      (customers as any[]).forEach(c => {
        emailMap[c.id] = c.email || '';
      });
    }

    let query = supabase
      .from('document_totals_view')
      .select('*')
      .eq('document_type', 'invoice')
      .eq('company_id', companyId)
      .gte('issue_date', from)
      .lte('issue_date', to);

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data: invoices, error: invError } = await query;
    if (invError || !invoices) {
      setCustomerData([]);
      return;
    }

    const invoiceIds = (invoices as any[]).map(d => d.document_id);
    const paymentsMap: Record<string, number> = {};

    if (invoiceIds.length > 0) {
      const { data: payments } = await supabase
        .from('payments')
        .select('document_id, amount')
        .in('document_id', invoiceIds)
        .eq('company_id', companyId)
        .is('deleted_at', null);

      if (payments) {
        (payments as any[]).forEach(p => {
          paymentsMap[p.document_id] = (paymentsMap[p.document_id] || 0) + Number(p.amount);
        });
      }
    }

    const grouped: Record<string, CustomerRevenue> = {};
    (invoices as any[]).forEach(inv => {
      const key = `${inv.customer_id}-${inv.currency}`;
      const totalAmount = Number(inv.total_amount) || 0;
      const paidAmount = paymentsMap[inv.document_id] || 0;
      const outstandingAmount = Math.max(0, totalAmount - paidAmount);
      const isPaid = inv.status === 'paid' || outstandingAmount <= 0;

      if (!grouped[key]) {
        grouped[key] = {
          customer_id: inv.customer_id,
          customer_name: inv.customer_name,
          customer_email: emailMap[inv.customer_id] || '',
          currency: inv.currency,
          total_invoices: 0,
          paid_invoices: 0,
          outstanding_invoices: 0,
          total_paid: 0,
          total_outstanding: 0,
          last_invoice_date: null
        };
      }

      const group = grouped[key];
      group.total_invoices += 1;
      if (isPaid) group.paid_invoices += 1;
      else group.outstanding_invoices += 1;
      group.total_paid += paidAmount;
      group.total_outstanding += outstandingAmount;
      if (!group.last_invoice_date || inv.issue_date > group.last_invoice_date) {
        group.last_invoice_date = inv.issue_date;
      }
    });

    setCustomerData(Object.values(grouped).sort((a, b) => b.total_paid - a.total_paid));
  };

  const fetchOutstandingData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    let query = supabase
      .from('outstanding_invoices_view')
      .select('*')
      .eq('company_id', companyId)
      .gte('issue_date', from)
      .lte('issue_date', to);

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      setOutstandingData(data as any[]);
    }
  };

  const fetchDocumentData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    let query = supabase
      .from('document_totals_view')
      .select('*')
      .eq('document_type', 'invoice')
      .eq('company_id', companyId)
      .gte('issue_date', from)
      .lte('issue_date', to)
      .order('issue_date', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      const documentIds = (data as any[]).map(d => d.document_id);
      const customFieldsMap: Record<string, { project?: string; location?: string }> = {};
      const paymentsMap: Record<string, number> = {};
      const paymentsListMap: Record<string, Array<{ date: string; amount: number }>> = {};

      if (documentIds.length > 0) {
        const { data: customFields } = await supabase
          .from('client_custom_fields')
          .select('document_id, field_label, field_value')
          .in('document_id', documentIds);

        if (customFields) {
          (customFields as any[]).forEach(field => {
            const label = field.field_label.trim().toLowerCase();
            const docId = field.document_id;
            if (!customFieldsMap[docId]) customFieldsMap[docId] = {};
            if (['project/events', 'project/event', 'project', 'event'].includes(label)) {
              customFieldsMap[docId].project = field.field_value || '';
            } else if (label === 'location') {
              customFieldsMap[docId].location = field.field_value || '';
            }
          });
        }

        const { data: payments } = await supabase
          .from('payments')
          .select('document_id, amount, payment_date')
          .in('document_id', documentIds)
          .is('deleted_at', null);

        if (payments) {
          (payments as any[]).forEach(payment => {
            const docId = payment.document_id;
            paymentsMap[docId] = (paymentsMap[docId] || 0) + Number(payment.amount);
            if (!paymentsListMap[docId]) paymentsListMap[docId] = [];
            paymentsListMap[docId].push({
              date: payment.payment_date,
              amount: Number(payment.amount)
            });
          });
        }
      }

      const enrichedData = (data as any[]).map(doc => {
        const docId = doc.document_id;
        const project = customFieldsMap[docId]?.project || '';
        const location = customFieldsMap[docId]?.location || '';
        const paid = paymentsMap[docId] || 0;
        const balance = doc.total_amount - paid;
        return {
          ...doc,
          project_events: project,
          location: location,
          paid: paid,
          balance: balance,
          payment_history: paymentsListMap[docId] || []
        } as DocumentTotal;
      });

      setDocumentData(enrichedData);
    }
  };

  const fetchPaymentsLog = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    let query = supabase
      .from('payments')
      .select(`
        id,
        amount,
        currency,
        payment_date,
        payment_method,
        reference_number,
        notes,
        documents (
          document_number,
          customers (
            name
          )
        ),
        accounts (
          name
        )
      `)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .gte('payment_date', from)
      .lte('payment_date', to)
      .order('payment_date', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      const formatted: PaymentLogEntry[] = (data as any[]).map(p => ({
        id: p.id,
        payment_date: p.payment_date,
        amount: Number(p.amount),
        currency: p.currency,
        payment_method: p.payment_method,
        reference_number: p.reference_number,
        notes: p.notes,
        document_number: p.documents?.document_number || '—',
        customer_name: p.documents?.customers?.name || '—',
        account_name: p.accounts?.name || '—'
      }));
      setPaymentsLogData(formatted);
    }
  };

  const fetchProfitLossData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const fromYear = fromDate.getFullYear();
    const fromMonth = fromDate.getMonth() + 1;
    const toYear = toDate.getFullYear();
    const toMonth = toDate.getMonth() + 1;

    let query = supabase
      .from('profit_and_loss_by_period_view')
      .select('*')
      .eq('company_id', companyId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      const filtered = (data as any[]).filter(item => {
        const itemYear = Number(item.year);
        const itemMonth = Number(item.month);
        const afterStart = itemYear > fromYear || (itemYear === fromYear && itemMonth >= fromMonth);
        const beforeEnd = itemYear < toYear || (itemYear === toYear && itemMonth <= toMonth);
        return afterStart && beforeEnd;
      });
      setProfitLossData(filtered);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Distinct currencies discovered in data
  const activeCurrenciesInPeriod = useMemo(() => {
    const currSet = new Set<string>();
    documentData.forEach(d => { if (d.currency) currSet.add(d.currency); });
    expensesData.forEach(e => { if (e.currency) currSet.add(e.currency); });

    if (currSet.size === 0) {
      currSet.add(companySettings?.currency || 'TZS');
    }
    return Array.from(currSet).sort();
  }, [documentData, expensesData, companySettings]);

  // Ensure active statement currency is set
  useEffect(() => {
    if (activeCurrenciesInPeriod.length > 0) {
      if (!activeStatementCurrency || !activeCurrenciesInPeriod.includes(activeStatementCurrency)) {
        setActiveStatementCurrency(activeCurrenciesInPeriod[0]);
      }
    }
  }, [activeCurrenciesInPeriod, activeStatementCurrency]);

  // Multi-Currency P&L Map
  const financialsByCurrency = useMemo(() => {
    const catIdMap = new Map<string, ExpenseCategoryItem>();
    const catNameMap = new Map<string, ExpenseCategoryItem>();

    categoriesList.forEach(c => {
      if (c.id) catIdMap.set(c.id, c);
      if (c.name) catNameMap.set(c.name.trim().toLowerCase(), c);
    });

    const result: Record<string, CurrencyFinancialStatement> = {};

    activeCurrenciesInPeriod.forEach(curr => {
      const docsInCurr = documentData.filter(d => (d.currency || activeCurrenciesInPeriod[0]) === curr);
      const expInCurr = expensesData.filter(e => (e.currency || activeCurrenciesInPeriod[0]) === curr);

      const totalSalesRevenue = docsInCurr.reduce((sum, d) => sum + (d.total_amount || 0), 0);
      const totalCollected = docsInCurr.reduce((sum, d) => sum + (d.paid || 0), 0);
      const totalUnpaid = docsInCurr.reduce((sum, d) => sum + (d.balance || 0), 0);

      const cogsBreakdown: Record<string, number> = {};
      const operatingBreakdown: Record<string, number> = {};
      const adminBreakdown: Record<string, number> = {};

      let totalCOGS = 0;
      let totalOperating = 0;
      let totalAdmin = 0;

      expInCurr.forEach((exp: any) => {
        let resolvedCategoryName = 'Other';
        let classification: 'cogs' | 'operating' | 'admin' = 'operating';

        if (exp.category_id && catIdMap.has(exp.category_id)) {
          const catObj = catIdMap.get(exp.category_id)!;
          resolvedCategoryName = catObj.name;
          classification = catObj.classification || 'operating';
        } else if (exp.category) {
          const catObj = catNameMap.get(exp.category.trim().toLowerCase());
          resolvedCategoryName = exp.category.trim();
          classification = catObj?.classification || 'operating';
        } else if (exp.description) {
          resolvedCategoryName = exp.description.trim();
        }

        const amt = Number(exp.amount) || 0;

        if (classification === 'cogs') {
          cogsBreakdown[resolvedCategoryName] = (cogsBreakdown[resolvedCategoryName] || 0) + amt;
          totalCOGS += amt;
        } else if (classification === 'admin') {
          adminBreakdown[resolvedCategoryName] = (adminBreakdown[resolvedCategoryName] || 0) + amt;
          totalAdmin += amt;
        } else {
          operatingBreakdown[resolvedCategoryName] = (operatingBreakdown[resolvedCategoryName] || 0) + amt;
          totalOperating += amt;
        }
      });

      const grossProfit = totalSalesRevenue - totalCOGS;
      const totalExpenses = totalOperating + totalAdmin;
      const profitBeforeTax = grossProfit - totalExpenses;

      result[curr] = {
        currency: curr,
        totalSalesRevenue,
        totalCollected,
        totalUnpaid,
        cogsBreakdown,
        totalCOGS,
        grossProfit,
        operatingBreakdown,
        totalOperating,
        adminBreakdown,
        totalAdmin,
        totalExpenses,
        profitBeforeTax,
      };
    });

    return result;
  }, [activeCurrenciesInPeriod, documentData, expensesData, categoriesList]);

  // Current active statement financials
  const currentStatement = useMemo(() => {
    return financialsByCurrency[activeStatementCurrency] || {
      currency: activeStatementCurrency || 'TZS',
      totalSalesRevenue: 0,
      totalCollected: 0,
      totalUnpaid: 0,
      cogsBreakdown: {},
      totalCOGS: 0,
      grossProfit: 0,
      operatingBreakdown: {},
      totalOperating: 0,
      adminBreakdown: {},
      totalAdmin: 0,
      totalExpenses: 0,
      profitBeforeTax: 0,
    };
  }, [financialsByCurrency, activeStatementCurrency]);

  // Dynamic Daily Expenses Matrix
  const dynamicExpenseMatrix = useMemo(() => {
    const catIdMap = new Map<string, string>();
    categoriesList.forEach(c => catIdMap.set(c.id, c.name));

    const datesMap: Record<string, Record<string, number>> = {};
    const categoryTotals: Record<string, number> = {};
    const distinctCategoriesSet = new Set<string>();

    categoriesList.forEach(c => distinctCategoriesSet.add(c.name));

    const expFiltered = activeStatementCurrency
      ? expensesData.filter((e: any) => (e.currency || activeCurrenciesInPeriod[0]) === activeStatementCurrency)
      : expensesData;

    expFiltered.forEach((exp: any) => {
      const d = exp.expense_date || exp.date || (exp.created_at ? exp.created_at.split('T')[0] : '');
      if (!d) return;

      let catName = 'Other';
      if (exp.category_id && catIdMap.has(exp.category_id)) {
        catName = catIdMap.get(exp.category_id)!;
      } else if (exp.category) {
        catName = exp.category.trim();
      }

      const amt = Number(exp.amount) || 0;
      distinctCategoriesSet.add(catName);

      if (!datesMap[d]) datesMap[d] = {};
      datesMap[d][catName] = (datesMap[d][catName] || 0) + amt;
      categoryTotals[catName] = (categoryTotals[catName] || 0) + amt;
    });

    const activeCategories = Array.from(distinctCategoriesSet).sort();
    const sortedDates = Object.keys(datesMap).sort();
    const grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

    return {
      activeCategories,
      sortedDates,
      datesMap,
      categoryTotals,
      grandTotal
    };
  }, [expensesData, categoriesList, activeStatementCurrency, activeCurrenciesInPeriod]);

  // Invoices grouped by currency
  const invoiceTotalsByCurrency = useMemo(() => {
    return documentData.reduce((acc, doc) => {
      const curr = doc.currency || activeCurrenciesInPeriod[0] || 'TZS';
      if (!acc[curr]) acc[curr] = { total: 0, paid: 0, balance: 0 };
      acc[curr].total += doc.total_amount || 0;
      acc[curr].paid += doc.paid || 0;
      acc[curr].balance += doc.balance || 0;
      return acc;
    }, {} as Record<string, { total: number; paid: number; balance: number }>);
  }, [documentData, activeCurrenciesInPeriod]);

  const exportFullStatementCSV = () => {
    const lines: string[] = [];
    const pushLine = (...cols: any[]) => lines.push(cols.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));

    pushLine(companySettings?.company_name || 'KILIMANJARO AUDIO VISUAL SERVICE');
    pushLine('SIMPLE FINANCIAL STATEMENT', `${dateFrom} to ${dateTo}`);
    pushLine('');

    activeCurrenciesInPeriod.forEach(curr => {
      const stat = financialsByCurrency[curr];
      if (!stat) return;

      pushLine(`PROFIT AND LOSS STATEMENT (${curr})`);
      pushLine('REVENUE');
      pushLine('Sale revenue', stat.totalSalesRevenue);
      pushLine('Total Revenue', '', stat.totalSalesRevenue);
      pushLine('');

      pushLine('COST OF GOODS SOLD (COGS)');
      Object.entries(stat.cogsBreakdown).forEach(([k, v]) => pushLine(k, v));
      pushLine('Total COGS', '', stat.totalCOGS);
      pushLine('');

      pushLine('GROSS PROFIT');
      pushLine('Total Revenue', '', stat.totalSalesRevenue);
      pushLine('Less: Total COGS', '', stat.totalCOGS);
      pushLine('GROSS PROFIT', '', stat.grossProfit);
      pushLine('');

      pushLine('OPERATING EXPENSES');
      Object.entries(stat.operatingBreakdown).forEach(([k, v]) => pushLine(k, v));
      pushLine('Total Operating Expenses', '', stat.totalOperating);
      pushLine('');

      pushLine('ADMINISTRATIVE & TAX EXPENSES');
      Object.entries(stat.adminBreakdown).forEach(([k, v]) => pushLine(k, v));
      pushLine('Total Administrative Expenses', '', stat.totalAdmin);
      pushLine('Total Operating & Admin Expenses', '', stat.totalExpenses);
      pushLine('');

      pushLine('PROFIT BEFORE TAX', '', stat.profitBeforeTax);
      pushLine('');

      pushLine('SALES SUMMARY', 'Amount');
      pushLine('Total Sales', stat.totalSalesRevenue);
      pushLine('Paid', stat.totalCollected);
      pushLine('Unpaid', stat.totalUnpaid);
      pushLine('');
      pushLine('');
    });

    pushLine('INVOICES MAIN');
    pushLine('Invoice date', 'Currency', 'Company/client', 'Project/Events', 'Location', 'Invoice number', 'Tax rate(VAT)', 'Total Amount', 'Paid', 'Balance', 'Status');
    documentData.forEach(inv => {
      pushLine(
        formatDate(inv.issue_date),
        inv.currency,
        inv.customer_name,
        inv.project_events,
        inv.location,
        inv.document_number,
        `${(inv.tax_percent || 0).toFixed(2)}%`,
        inv.total_amount,
        inv.paid,
        inv.balance,
        mapStatus(inv.status)
      );
    });
    pushLine('');

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Financial_Statement_${dateFrom}_to_${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportStatementPDF = async () => {
    const element = document.getElementById('financial-statement-doc');
    if (!element) return;

    try {
      const opt = {
        margin: [0, 0, 5, 0],
        filename: `Financial_Statement_${activeStatementCurrency}_${dateFrom}_to_${dateTo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4', compress: true },
        pagebreak: { mode: ['css', 'legacy'] }
      };
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const exportInvoicesToCSV = (data: DocumentTotal[]) => {
    if (data.length === 0) return;
    const headers = ['Invoice date', 'Currency', 'Company/client', 'Project/Events', 'Location', 'Invoice number', 'Tax rate(VAT)', 'Total Amount', 'Paid', 'Balance', 'Status'];
    const rows = data.map(item => [
      formatDate(item.issue_date),
      item.currency,
      `"${item.customer_name}"`,
      `"${item.project_events || ''}"`,
      `"${item.location || ''}"`,
      item.document_number,
      `${(item.tax_percent || 0).toFixed(2)}%`,
      item.total_amount,
      item.paid,
      item.balance,
      mapStatus(item.status)
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-invoices-${dateFrom}-to-${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportPaymentsToCSV = (data: PaymentLogEntry[]) => {
    if (data.length === 0) return;
    const headers = ['Payment Date', 'Currency', 'Invoice Number', 'Company/Client', 'Account Received', 'Method', 'Reference', 'Notes', 'Amount'];
    const rows = data.map(item => [
      new Date(item.payment_date).toLocaleDateString(),
      item.currency,
      item.document_number,
      `"${item.customer_name}"`,
      `"${item.account_name}"`,
      item.payment_method,
      `"${item.reference_number || ''}"`,
      `"${item.notes || ''}"`,
      item.amount
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-received-${dateFrom}-to-${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${dateFrom}-to-${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Header */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Financial Reports</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Multi-currency financial statements, invoice ledgers, and operational matrices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} variant="secondary" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-sm text-gray-900">Report Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                value={tempDateFrom}
                onChange={(e) => setTempDateFrom(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                value={tempDateTo}
                onChange={(e) => setTempDateTo(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Currency Filter</label>
              <select
                value={tempSelectedCurrency}
                onChange={(e) => setTempSelectedCurrency(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="all">All Currencies (Multi-Currency)</option>
                {currencies.map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleApplyFilters} size="sm" disabled={loading}>
              {loading ? 'Applying...' : 'Apply Filters'}
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveReportTab('statement')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
                activeReportTab === 'statement'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Monthly Financial Statement (KAVS Format)
            </button>
            <button
              onClick={() => setActiveReportTab('overview')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
                activeReportTab === 'overview'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-600" />
              Overview & Detailed Reports
            </button>
          </nav>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: INVOICE-STYLE MONTHLY FINANCIAL STATEMENT                          */}
        {/* ========================================================================= */}
        {activeReportTab === 'statement' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              
              {/* Multi-Currency Pill Switcher */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5" /> Currency View:
                </span>
                {activeCurrenciesInPeriod.map(curr => (
                  <button
                    key={curr}
                    onClick={() => setActiveStatementCurrency(curr)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      activeStatementCurrency === curr
                        ? 'bg-black text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button onClick={exportFullStatementCSV} variant="secondary" className="flex-1 sm:flex-initial">
                  <FileSpreadsheet className="w-4 h-4 mr-1 text-emerald-600" />
                  Excel / CSV
                </Button>
                <Button onClick={exportStatementPDF} variant="primary" className="flex-1 sm:flex-initial">
                  <FileDown className="w-4 h-4 mr-1" />
                  PDF ({activeStatementCurrency})
                </Button>
              </div>
            </div>

            {/* Printable Document Sheet Container */}
            <div id="financial-statement-doc" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-10 space-y-8">
              
              {/* Clean Letterhead Banner (Exact natural aspect ratio, no squishing) */}
              {companySettings?.letterhead_url ? (
                <div className="-mx-6 sm:-mx-10 -mt-6 sm:-mt-10 mb-6 overflow-hidden rounded-t-xl" id="letterhead-container">
                  <img
                    id="letterhead-image"
                    src={companySettings.letterhead_url}
                    alt="Letterhead"
                    className="block w-full h-auto"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </div>
              ) : (
                <div className="border-b-2 border-black pb-4 flex justify-between items-start">
                  <div>
                    {companySettings?.logo_url && (
                      <img src={companySettings.logo_url} alt="Logo" className="h-12 object-contain mb-2" />
                    )}
                    <h2 className="text-2xl font-bold uppercase tracking-wide text-gray-900">
                      {companySettings?.company_name || 'KILIMANJARO AUDIO VISUAL SERVICE'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {[companySettings?.address_line1, companySettings?.city, companySettings?.phone].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block">DOCUMENT</span>
                    <h1 className="text-xl font-black text-gray-900">SIMPLE FINANCIAL STATEMENT</h1>
                    <p className="text-xs text-gray-600 mt-1 font-mono">{dateFrom} to {dateTo}</p>
                  </div>
                </div>
              )}

              {/* 1. Profit and Loss Statement */}
              <div className="statement-section-break">
                <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-center">
                  <h3 className="text-base font-bold uppercase tracking-wider text-gray-900">
                    1. Profit & Loss Statement ({activeStatementCurrency})
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 rounded-md text-gray-700">
                    Currency: {activeStatementCurrency}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Revenue & COGS */}
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4 text-xs font-mono">
                    <div>
                      <div className="font-bold text-gray-900 uppercase tracking-wide border-b pb-1 font-sans text-xs">Revenue</div>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between py-1">
                          <span className="text-gray-600">Sale Revenue ({activeStatementCurrency})</span>
                          <span className="font-semibold text-gray-900">{formatCurrency(currentStatement.totalSalesRevenue, activeStatementCurrency)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-1.5 text-emerald-700">
                          <span>Total Revenue</span>
                          <span>{formatCurrency(currentStatement.totalSalesRevenue, activeStatementCurrency)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-gray-900 uppercase tracking-wide border-b pb-1 font-sans text-xs">Cost of Goods Sold (COGS)</div>
                      <div className="mt-2 space-y-1">
                        {Object.keys(currentStatement.cogsBreakdown).length > 0 ? (
                          Object.entries(currentStatement.cogsBreakdown).map(([cat, amt]) => (
                            <div key={cat} className="flex justify-between py-0.5">
                              <span className="text-gray-600">{cat}</span>
                              <span className="font-medium text-gray-900">{formatCurrency(amt, activeStatementCurrency)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 italic py-1">No COGS recorded for {activeStatementCurrency}.</div>
                        )}
                        <div className="flex justify-between font-bold border-t pt-1.5 text-red-700">
                          <span>Total COGS</span>
                          <span>{formatCurrency(currentStatement.totalCOGS, activeStatementCurrency)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between font-bold text-blue-900 font-sans text-sm">
                      <span>GROSS PROFIT</span>
                      <span>{formatCurrency(currentStatement.grossProfit, activeStatementCurrency)}</span>
                    </div>
                  </div>

                  {/* Right Column: Operating & Admin Expenses */}
                  <div className="border border-gray-200 rounded-lg p-4 space-y-4 text-xs font-mono">
                    <div>
                      <div className="font-bold text-gray-900 uppercase tracking-wide border-b pb-1 font-sans text-xs">Operating Expenses</div>
                      <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                        {Object.keys(currentStatement.operatingBreakdown).length > 0 ? (
                          Object.entries(currentStatement.operatingBreakdown).map(([cat, amt]) => (
                            <div key={cat} className="flex justify-between py-0.5">
                              <span className="text-gray-600">{cat}</span>
                              <span className="font-medium text-gray-900">{formatCurrency(amt, activeStatementCurrency)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 italic py-1">No operating expenses for {activeStatementCurrency}.</div>
                        )}
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1.5 text-gray-900 mt-1">
                        <span>Total Operating Expenses</span>
                        <span>{formatCurrency(currentStatement.totalOperating, activeStatementCurrency)}</span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-gray-900 uppercase tracking-wide border-b pb-1 font-sans text-xs">Administrative & Tax Expenses</div>
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                        {Object.keys(currentStatement.adminBreakdown).length > 0 ? (
                          Object.entries(currentStatement.adminBreakdown).map(([cat, amt]) => (
                            <div key={cat} className="flex justify-between py-0.5">
                              <span className="text-gray-600">{cat}</span>
                              <span className="font-medium text-gray-900">{formatCurrency(amt, activeStatementCurrency)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-400 italic py-1">No admin expenses for {activeStatementCurrency}.</div>
                        )}
                      </div>
                      <div className="flex justify-between font-bold border-t pt-1.5 text-gray-900 mt-1">
                        <span>Total Admin Expenses</span>
                        <span>{formatCurrency(currentStatement.totalAdmin, activeStatementCurrency)}</span>
                      </div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between font-bold text-emerald-900 font-sans text-sm">
                      <span>PROFIT BEFORE TAX</span>
                      <span>{formatCurrency(currentStatement.profitBeforeTax, activeStatementCurrency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Invoices Main Ledger Table */}
              <div className="statement-section-break">
                <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-center">
                  <h3 className="text-base font-bold uppercase tracking-wider text-gray-900">
                    2. Invoices Main (Monthly Invoice Ledger)
                  </h3>
                  <span className="text-xs text-gray-500">{documentData.length} invoices recorded</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-100">
                      <tr className="font-bold text-gray-700">
                        <th className="px-2.5 py-2 text-left">Invoice Date</th>
                        <th className="px-2.5 py-2 text-left">Curr</th>
                        <th className="px-2.5 py-2 text-left">Company/Client</th>
                        <th className="px-2.5 py-2 text-left">Project/Events</th>
                        <th className="px-2.5 py-2 text-left">Location</th>
                        <th className="px-2.5 py-2 text-left">Invoice #</th>
                        <th className="px-2.5 py-2 text-right">VAT</th>
                        <th className="px-2.5 py-2 text-right">Total Amount</th>
                        <th className="px-2.5 py-2 text-right">Paid</th>
                        <th className="px-2.5 py-2 text-right">Balance</th>
                        <th className="px-2.5 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {documentData.map((item) => (
                        <tr key={item.document_id} className="hover:bg-gray-50">
                          <td className="px-2.5 py-2 whitespace-nowrap text-gray-900 font-mono">{formatDate(item.issue_date)}</td>
                          <td className="px-2.5 py-2 font-bold text-gray-500">{item.currency}</td>
                          <td className="px-2.5 py-2 font-medium text-gray-900">{item.customer_name}</td>
                          <td className="px-2.5 py-2 text-gray-600">{item.project_events || '—'}</td>
                          <td className="px-2.5 py-2 text-gray-600">{item.location || '—'}</td>
                          <td className="px-2.5 py-2 font-medium text-blue-700">{item.document_number}</td>
                          <td className="px-2.5 py-2 text-right text-gray-500">{(item.tax_percent || 0).toFixed(2)}%</td>
                          <td className="px-2.5 py-2 text-right font-mono font-medium text-gray-900">{formatCurrency(item.total_amount, item.currency)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-emerald-700">{formatCurrency(item.paid || 0, item.currency)}</td>
                          <td className="px-2.5 py-2 text-right font-mono font-semibold text-amber-700">{formatCurrency(item.balance || 0, item.currency)}</td>
                          <td className="px-2.5 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              item.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              item.status === 'partially_paid' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {mapStatus(item.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-400">
                      {Object.entries(invoiceTotalsByCurrency).map(([curr, totals]) => (
                        <tr key={curr}>
                          <td colSpan={7} className="px-2.5 py-2 text-right uppercase text-gray-700">Total ({curr}):</td>
                          <td className="px-2.5 py-2 text-right font-mono text-gray-900">{formatCurrency(totals.total, curr)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-emerald-700">{formatCurrency(totals.paid, curr)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-amber-700">{formatCurrency(totals.balance, curr)}</td>
                          <td></td>
                        </tr>
                      ))}
                    </tfoot>
                  </table>
                </div>

                {/* Multi-Currency Summary Cards */}
                <div className="flex justify-end mt-4">
                  <div className="w-full max-w-sm space-y-3">
                    {Object.entries(invoiceTotalsByCurrency).map(([curr, totals]) => (
                      <div key={curr} className="bg-[#e2efda] border border-[#a9d18e] rounded-lg p-3 font-mono text-xs text-gray-800 shadow-sm">
                        <div className="font-bold text-[#375623] mb-1.5 border-b border-[#a9d18e] pb-1 font-sans text-xs uppercase flex justify-between">
                          <span>{curr} Summary</span>
                          <span>Invoiced</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-1.5">
                          <div className="font-bold text-[#375623]">Total sales:</div>
                          <div className="text-right font-bold text-[#375623]">{formatCurrency(totals.total, curr)}</div>
                          <div className="font-bold text-[#375623]">Paid:</div>
                          <div className="text-right font-bold text-[#375623]">{formatCurrency(totals.paid, curr)}</div>
                          <div className="font-bold text-[#375623]">Unpaid:</div>
                          <div className="text-right font-bold text-[#375623]">{formatCurrency(totals.balance, curr)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Dynamic Daily Expenses Matrix */}
              <div className="statement-section-break">
                <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-center">
                  <h3 className="text-base font-bold uppercase tracking-wider text-gray-900">
                    3. Daily Expenses Matrix ({activeStatementCurrency})
                  </h3>
                  <span className="text-xs text-gray-500">Expenses for currency: {activeStatementCurrency}</span>
                </div>

                {dynamicExpenseMatrix.sortedDates.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-xs bg-gray-50 rounded-lg">
                    No expense records found for {activeStatementCurrency} in this period.
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[450px]">
                    <table className="min-w-full divide-y divide-gray-200 text-[11px] font-mono">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-2 text-left font-bold text-gray-800 bg-gray-200 sticky left-0 z-20 font-sans">DATE</th>
                          {dynamicExpenseMatrix.activeCategories.map(cat => (
                            <th key={cat} className="px-2 py-2 text-right font-semibold text-gray-700 whitespace-nowrap">{cat}</th>
                          ))}
                          <th className="px-2 py-2 text-right font-bold text-gray-900 bg-gray-200 font-sans">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {dynamicExpenseMatrix.sortedDates.map(dateStr => {
                          const dayMap = dynamicExpenseMatrix.datesMap[dateStr] || {};
                          const dayTotal = Object.values(dayMap).reduce((a, b) => a + b, 0);
                          return (
                            <tr key={dateStr} className="hover:bg-gray-50">
                              <td className="px-2 py-1.5 font-sans font-medium text-gray-900 whitespace-nowrap bg-gray-50 sticky left-0 z-10">{dateStr}</td>
                              {dynamicExpenseMatrix.activeCategories.map(cat => (
                                <td key={cat} className="px-2 py-1.5 text-right text-gray-700 whitespace-nowrap">
                                  {dayMap[cat] ? formatCurrency(dayMap[cat], activeStatementCurrency) : '—'}
                                </td>
                              ))}
                              <td className="px-2 py-1.5 text-right font-bold text-red-600 bg-gray-50 whitespace-nowrap">
                                {formatCurrency(dayTotal, activeStatementCurrency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-200 font-bold border-t-2 border-gray-400 sticky bottom-0 z-10">
                        <tr>
                          <td className="px-2 py-2 text-gray-900 font-sans sticky left-0 z-20 bg-gray-200">TOTAL</td>
                          {dynamicExpenseMatrix.activeCategories.map(cat => (
                            <td key={cat} className="px-2 py-2 text-right whitespace-nowrap">
                              {dynamicExpenseMatrix.categoryTotals[cat] ? formatCurrency(dynamicExpenseMatrix.categoryTotals[cat], activeStatementCurrency) : '—'}
                            </td>
                          ))}
                          <td className="px-2 py-2 text-right text-red-800 bg-gray-300 whitespace-nowrap">
                            {formatCurrency(dynamicExpenseMatrix.grandTotal, activeStatementCurrency)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* TAB 2: ORIGINAL STANDARD OVERVIEW & DETAILED REPORTS                      */
          /* ========================================================================= */
          <div className="space-y-6">
            
            {/* Customization configuration picker panel */}
            <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
              <button
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-slate-600" />
                  <h3 className="font-semibold text-gray-900">Report Customization & Columns Picker</h3>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{showConfigPanel ? 'Collapse Options' : 'Expand Options'}</span>
                  {showConfigPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showConfigPanel && (
                <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Include Report Sections</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                      {[
                        { key: 'profitLoss', label: 'P&L Statement' },
                        { key: 'revenueByPeriod', label: 'Revenue by Period' },
                        { key: 'customerRevenue', label: 'Customer Revenue' },
                        { key: 'outstandingInvoices', label: 'Outstanding Invoices' },
                        { key: 'invoiceList', label: 'Invoice List' },
                        { key: 'paymentsLog', label: 'Payments Received Log' },
                      ].map((sec) => (
                        <label key={sec.key} className="flex items-center gap-2 bg-white px-3 py-2 rounded-md shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 select-none">
                          <input
                            type="checkbox"
                            checked={visibleSections[sec.key as keyof VisibleSections]}
                            onChange={(e) => {
                              const updated = {
                                ...visibleSections,
                                [sec.key]: e.target.checked,
                              };
                              setVisibleSections(updated);
                              localStorage.setItem('nogna_report_visible_sections', JSON.stringify(updated));
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span className="text-sm text-gray-700 font-medium">{sec.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Standard Collapsible Sections */}
            <div className="space-y-6">
              {/* Profit & Loss Overview */}
              {visibleSections.profitLoss && (
                <div className="bg-white rounded-lg shadow">
                  <div
                    role="button"
                    onClick={() => toggleSection('profitloss')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <PieChart className="w-6 h-6 text-slate-700" />
                      <h2 className="text-xl font-semibold text-gray-900">Profit & Loss Statement</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportToCSV(profitLossData, 'profit-and-loss');
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </Button>
                      {expandedSections['profitloss'] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {expandedSections['profitloss'] && (
                    <div className="px-6 pb-6">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expenses</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Profit</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {profitLossData.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {new Date(item.year, item.month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{item.currency}</td>
                                <td className="px-4 py-3 text-sm text-right text-emerald-600 font-semibold">{formatCurrency(Number(item.total_revenue), item.currency)}</td>
                                <td className="px-4 py-3 text-sm text-right text-red-600 font-semibold">{formatCurrency(Number(item.total_expenses), item.currency)}</td>
                                <td className={`px-4 py-3 text-sm text-right font-bold ${Number(item.net_profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {formatCurrency(Number(item.net_profit), item.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Monthly Invoice Report */}
              {visibleSections.invoiceList && (
                <div className="bg-white rounded-lg shadow">
                  <div
                    role="button"
                    onClick={() => toggleSection('documents')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="w-6 h-6 text-emerald-600" />
                      <h2 className="text-xl font-semibold text-gray-900">Monthly Invoice Report</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportInvoicesToCSV(documentData);
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </Button>
                      {expandedSections['documents'] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {expandedSections['documents'] && (
                    <div className="px-6 pb-6">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {visibleColumns.invoiceList.invoiceDate && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice date</th>}
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Curr</th>
                              {visibleColumns.invoiceList.client && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company/client</th>}
                              {visibleColumns.invoiceList.project && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project/Events</th>}
                              {visibleColumns.invoiceList.location && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>}
                              {visibleColumns.invoiceList.invoiceNumber && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice number2</th>}
                              {visibleColumns.invoiceList.taxRate && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax rate(VAT)</th>}
                              {visibleColumns.invoiceList.totalAmount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>}
                              {visibleColumns.invoiceList.paid && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>}
                              {visibleColumns.invoiceList.balance && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>}
                              {visibleColumns.invoiceList.status && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {documentData.map((item) => (
                              <tr key={item.document_id} className="hover:bg-gray-50">
                                {visibleColumns.invoiceList.invoiceDate && <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDate(item.issue_date)}</td>}
                                <td className="px-4 py-3 text-sm font-bold text-gray-500">{item.currency}</td>
                                {visibleColumns.invoiceList.client && <td className="px-4 py-3 text-sm text-gray-900">{item.customer_name}</td>}
                                {visibleColumns.invoiceList.project && <td className="px-4 py-3 text-sm text-gray-900">{item.project_events || '—'}</td>}
                                {visibleColumns.invoiceList.location && <td className="px-4 py-3 text-sm text-gray-900">{item.location || '—'}</td>}
                                {visibleColumns.invoiceList.invoiceNumber && <td className="px-4 py-3 text-sm text-blue-600 font-medium">{item.document_number}</td>}
                                {visibleColumns.invoiceList.taxRate && <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{(item.tax_percent || 0).toFixed(2)}%</td>}
                                {visibleColumns.invoiceList.totalAmount && <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">{formatCurrency(item.total_amount, item.currency)}</td>}
                                {visibleColumns.invoiceList.paid && <td className="px-4 py-3 text-sm text-right text-emerald-600 font-medium">{formatCurrency(item.paid || 0, item.currency)}</td>}
                                {visibleColumns.invoiceList.balance && <td className="px-4 py-3 text-sm text-right font-semibold text-amber-600">{formatCurrency(item.balance || 0, item.currency)}</td>}
                                {visibleColumns.invoiceList.status && (
                                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                      item.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                      item.status === 'partially_paid' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                      'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                      {mapStatus(item.status)}
                                    </span>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Payments Received Log */}
              {visibleSections.paymentsLog && (
                <div className="bg-white rounded-lg shadow">
                  <div
                    role="button"
                    onClick={() => toggleSection('paymentsLog')}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                      <h2 className="text-xl font-semibold text-gray-900">Payments Received Log</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportPaymentsToCSV(paymentsLogData);
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </Button>
                      {expandedSections['paymentsLog'] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {expandedSections['paymentsLog'] && (
                    <div className="px-6 pb-6">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Date</th>
                              <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Curr</th>
                              <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Invoice #</th>
                              <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Client</th>
                              <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Account</th>
                              <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Method</th>
                              <th className="px-3 py-2.5 text-right font-medium text-gray-500 uppercase">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {paymentsLogData.map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-900 whitespace-nowrap">{new Date(item.payment_date).toLocaleDateString()}</td>
                                <td className="px-3 py-2 font-bold text-gray-500">{item.currency}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">{item.document_number}</td>
                                <td className="px-3 py-2 text-gray-900">{item.customer_name}</td>
                                <td className="px-3 py-2 text-gray-600">{item.account_name}</td>
                                <td className="px-3 py-2 text-gray-600">{item.payment_method.replace('_', ' ')}</td>
                                <td className="px-3 py-2 text-right font-semibold text-emerald-600">{formatCurrency(item.amount, item.currency)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
