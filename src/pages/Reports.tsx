import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  PieChart,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { formatCurrency } from '../lib/currency-utils';

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

interface ExpenseRecord {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
}

interface VisibleSections {
  profitLoss: boolean;
  revenueByPeriod: boolean;
  customerRevenue: boolean;
  outstandingInvoices: boolean;
  invoiceList: boolean;
  paymentsLog: boolean;
  expenseMatrix: boolean;
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

const EXPENSE_CATEGORIES_ORDER = [
  'VAT',
  'PROVISIONAL RETURN',
  'INDIVIDUAL TAX',
  'LICENSE',
  'PRA',
  'NSSF',
  'BASATA',
  'PAYEE',
  'BRELA',
  'INSURANCE',
  'COMMISSION',
  'FUEL',
  'TRANSPORT',
  'FOOD',
  'INTERNET',
  'SALARY',
  'LABOR',
  'ELECTRICITY',
  'WATER',
  'TAKA',
  'ACCOMMODATION',
  'MAINTENANCE',
  'INSTRUMENTS',
  'SECURITY',
  'STATIONERY',
  'ZOOM',
  'MATERIALS',
  'STORAGE RENT',
  'OTHER'
];

const COGS_CATEGORIES = ['labor', 'labour', 'direct payments', 'materials', 'direct cost', 'direct costs'];
const ADMIN_TAX_CATEGORIES = [
  'vat', 'nssf', 'payee', 'paye', 'wht', 'withholding tax',
  'pra', 'brela', 'brale', 'license', 'licence', 'basata',
  'provisional return', 'individual tax', 'insurance', 'commission'
];

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

const normalizeCategory = (cat: string) => {
  if (!cat) return 'OTHER';
  const upper = cat.trim().toUpperCase();
  if (upper === 'LABOUR') return 'LABOR';
  if (upper === 'PAYE') return 'PAYEE';
  if (upper === 'BRALE') return 'BRELA';
  if (upper === 'STATIONARY') return 'STATIONERY';
  if (upper === 'MAITANANCE') return 'MAINTENANCE';
  if (upper === 'ACCOMODATION') return 'ACCOMMODATION';
  if (upper === 'SALARY & WAGES') return 'SALARY';
  return upper;
};

const DEFAULT_VISIBLE_SECTIONS: VisibleSections = {
  profitLoss: true,
  revenueByPeriod: true,
  customerRevenue: true,
  outstandingInvoices: true,
  invoiceList: true,
  paymentsLog: true,
  expenseMatrix: true,
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  const [tempDateFrom, setTempDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // 1st of current month
    return date.toISOString().split('T')[0];
  });
  const [tempDateTo, setTempDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [tempSelectedCurrency, setTempSelectedCurrency] = useState('all');

  const [dateFrom, setDateFrom] = useState(tempDateFrom);
  const [dateTo, setDateTo] = useState(tempDateTo);
  const [selectedCurrency, setSelectedCurrency] = useState(tempSelectedCurrency);
  const [currencies, setCurrencies] = useState<Array<{ code: string; symbol: string }>>([]);

  const [revenueData, setRevenueData] = useState<RevenueByPeriod[]>([]);
  const [customerData, setCustomerData] = useState<CustomerRevenue[]>([]);
  const [outstandingData, setOutstandingData] = useState<OutstandingInvoice[]>([]);
  const [documentData, setDocumentData] = useState<DocumentTotal[]>([]);
  const [profitLossData, setProfitLossData] = useState<ProfitAndLoss[]>([]);
  const [paymentsLogData, setPaymentsLogData] = useState<PaymentLogEntry[]>([]);
  const [expensesData, setExpensesData] = useState<ExpenseRecord[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profitloss: true,
    documents: true,
    expenseMatrix: true,
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

    if (data) {
      setCurrencies(data);
    }
  };

  const fetchAllReportData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    setLoading(true);
    try {
      await Promise.all([
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

  const handleApplyFilters = () => {
    setDateFrom(tempDateFrom);
    setDateTo(tempDateTo);
    setSelectedCurrency(tempSelectedCurrency);
    fetchAllReportData(tempDateFrom, tempDateTo, tempSelectedCurrency);
  };

  const handleRefresh = () => {
    fetchAllReportData(dateFrom, dateTo, selectedCurrency);
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
    if (error) {
      console.error("fetchRevenueData error:", error);
    } else if (data) {
      const filtered = data.filter((item: any) => {
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
      customers.forEach((c: any) => {
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

    const invoiceIds = invoices.map((d: any) => d.document_id);
    const paymentsMap: Record<string, number> = {};

    if (invoiceIds.length > 0) {
      const { data: payments } = await supabase
        .from('payments')
        .select('document_id, amount')
        .in('document_id', invoiceIds)
        .eq('company_id', companyId)
        .is('deleted_at', null);

      if (payments) {
        payments.forEach((p: any) => {
          paymentsMap[p.document_id] = (paymentsMap[p.document_id] || 0) + Number(p.amount);
        });
      }
    }

    const grouped: Record<string, CustomerRevenue> = {};
    invoices.forEach((inv: any) => {
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
      if (isPaid) {
        group.paid_invoices += 1;
      } else {
        group.outstanding_invoices += 1;
      }
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
    if (error) {
      console.error("fetchOutstandingData error:", error);
    } else if (data) {
      setOutstandingData(data);
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
    if (error) {
      console.error("fetchDocumentData error:", error);
    } else if (data) {
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
            if (!customFieldsMap[docId]) {
              customFieldsMap[docId] = {};
            }
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
            if (!paymentsListMap[docId]) {
              paymentsListMap[docId] = [];
            }
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
    if (error) {
      console.error("fetchPaymentsLog error:", error);
    } else if (data) {
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

  const fetchExpensesData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    let query = supabase
      .from('expenses')
      .select('id, expense_date, category, amount, currency, description')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: true });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (error) {
      console.error("fetchExpensesData error:", error);
    } else if (data) {
      setExpensesData(data as ExpenseRecord[]);
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
    if (error) {
      console.error("fetchProfitLossData error:", error);
    } else if (data) {
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

  // Structured Financial Breakdown (COGS, Operating, Administrative)
  const structuredFinancials = React.useMemo(() => {
    const totalSalesRevenue = documentData.reduce((sum, d) => sum + (d.total_amount || 0), 0);
    const totalCollected = documentData.reduce((sum, d) => sum + (d.paid || 0), 0);
    const totalUnpaid = documentData.reduce((sum, d) => sum + (d.balance || 0), 0);

    const cogsBreakdown: Record<string, number> = {};
    const operatingBreakdown: Record<string, number> = {};
    const adminBreakdown: Record<string, number> = {};

    let totalCOGS = 0;
    let totalOperating = 0;
    let totalAdmin = 0;

    expensesData.forEach((exp) => {
      const catLower = (exp.category || '').toLowerCase().trim();
      const normCat = normalizeCategory(exp.category);
      const amt = Number(exp.amount) || 0;

      if (COGS_CATEGORIES.some(c => catLower.includes(c))) {
        cogsBreakdown[normCat] = (cogsBreakdown[normCat] || 0) + amt;
        totalCOGS += amt;
      } else if (ADMIN_TAX_CATEGORIES.some(c => catLower.includes(c))) {
        adminBreakdown[normCat] = (adminBreakdown[normCat] || 0) + amt;
        totalAdmin += amt;
      } else {
        operatingBreakdown[normCat] = (operatingBreakdown[normCat] || 0) + amt;
        totalOperating += amt;
      }
    });

    const grossProfit = totalSalesRevenue - totalCOGS;
    const totalExpenses = totalOperating + totalAdmin;
    const profitBeforeTax = grossProfit - totalExpenses;

    return {
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
  }, [documentData, expensesData]);

  // Pivot expense records by date
  const expenseMatrix = React.useMemo(() => {
    const datesMap: Record<string, Record<string, number>> = {};
    const categoryTotals: Record<string, number> = {};

    expensesData.forEach(exp => {
      const d = exp.expense_date;
      const cat = normalizeCategory(exp.category);
      const amt = Number(exp.amount) || 0;

      if (!datesMap[d]) datesMap[d] = {};
      datesMap[d][cat] = (datesMap[d][cat] || 0) + amt;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    const sortedDates = Object.keys(datesMap).sort();
    const grandTotal = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

    return {
      sortedDates,
      datesMap,
      categoryTotals,
      grandTotal
    };
  }, [expensesData]);

  // Export full multi-section statement
  const exportFullFinancialStatementCSV = () => {
    const lines: string[] = [];
    const pushLine = (...cols: any[]) => lines.push(cols.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','));

    // 1. Header
    pushLine('KILIMANJARO AUDIO VISUAL SERVICE');
    pushLine('SIMPLE FINANCIAL STATEMENT', `${dateFrom} to ${dateTo}`);
    pushLine('');

    // 2. Profit & Loss Statement
    pushLine('PROFIT AND LOSS STATEMENT');
    pushLine('REVENUE');
    pushLine('Sales Revenue', structuredFinancials.totalSalesRevenue);
    pushLine('Total Revenue', '', structuredFinancials.totalSalesRevenue);
    pushLine('');

    pushLine('COST OF GOODS SOLD (COGS)');
    Object.entries(structuredFinancials.cogsBreakdown).forEach(([k, v]) => pushLine(k, v));
    pushLine('Total COGS', '', structuredFinancials.totalCOGS);
    pushLine('');

    pushLine('GROSS PROFIT');
    pushLine('Total Revenue', '', structuredFinancials.totalSalesRevenue);
    pushLine('Less: Total COGS', '', structuredFinancials.totalCOGS);
    pushLine('GROSS PROFIT', '', structuredFinancials.grossProfit);
    pushLine('');

    pushLine('OPERATING EXPENSES');
    Object.entries(structuredFinancials.operatingBreakdown).forEach(([k, v]) => pushLine(k, v));
    pushLine('Total Operating Expenses', '', structuredFinancials.totalOperating);
    pushLine('');

    pushLine('ADMINISTRATIVE & TAX EXPENSES');
    Object.entries(structuredFinancials.adminBreakdown).forEach(([k, v]) => pushLine(k, v));
    pushLine('Total Administrative Expenses', '', structuredFinancials.totalAdmin);
    pushLine('Total Operating & Admin Expenses', '', structuredFinancials.totalExpenses);
    pushLine('');

    pushLine('PROFIT BEFORE TAX', '', structuredFinancials.profitBeforeTax);
    pushLine('');

    pushLine('SALES SUMMARY', 'Amount');
    pushLine('Total Sales', structuredFinancials.totalSalesRevenue);
    pushLine('Paid', structuredFinancials.totalCollected);
    pushLine('Unpaid', structuredFinancials.totalUnpaid);
    pushLine('');
    pushLine('');

    // 3. Invoices Main Table
    pushLine('INVOICES MAIN');
    pushLine('Invoice date', 'Company/client', 'Project/Events', 'Location', 'Invoice number', 'Tax rate(VAT)', 'Total Amount', 'Paid', 'Balance', 'Status');
    documentData.forEach(inv => {
      pushLine(
        formatDate(inv.issue_date),
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
    pushLine('Total', '', '', '', '', '', structuredFinancials.totalSalesRevenue, structuredFinancials.totalCollected, structuredFinancials.totalUnpaid);
    pushLine('');
    pushLine('');

    // 4. Daily Expenses Matrix
    pushLine('DAILY EXPENSES MATRIX');
    pushLine('DATE', ...EXPENSE_CATEGORIES_ORDER, 'TOTAL');
    expenseMatrix.sortedDates.forEach(d => {
      const rowCats = EXPENSE_CATEGORIES_ORDER.map(cat => expenseMatrix.datesMap[d]?.[cat] || '');
      const dayTotal = Object.values(expenseMatrix.datesMap[d] || {}).reduce((a, b) => a + b, 0);
      pushLine(d, ...rowCats, dayTotal);
    });
    pushLine('TOTAL', ...EXPENSE_CATEGORIES_ORDER.map(cat => expenseMatrix.categoryTotals[cat] || 0), expenseMatrix.grandTotal);

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KAVS_Financial_Statement_${dateFrom}_to_${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const invoiceTotalsByCurrency = documentData.reduce((acc, doc) => {
    const curr = doc.currency || 'USD';
    if (!acc[curr]) acc[curr] = { total: 0, paid: 0, balance: 0 };
    acc[curr].total += doc.total_amount || 0;
    acc[curr].paid += doc.paid || 0;
    acc[curr].balance += doc.balance || 0;
    return acc;
  }, {} as Record<string, { total: number; paid: number; balance: number }>);

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
        
        {/* Top Header & Actions */}
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Financial Reports & Statement</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Monthly executive P&L, invoice details, and daily expense matrices.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button onClick={exportFullFinancialStatementCSV} variant="primary" className="w-full sm:w-auto">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Full Financial Statement
            </Button>
            <Button onClick={handleRefresh} variant="secondary" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Report Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={tempDateFrom}
                onChange={(e) => setTempDateFrom(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={tempDateTo}
                onChange={(e) => setTempDateTo(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={tempSelectedCurrency}
                onChange={(e) => setTempSelectedCurrency(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Currencies</option>
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

        {/* Executive Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-medium text-gray-600">Total Sales (Revenue)</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(structuredFinancials.totalSalesRevenue, selectedCurrency === 'all' ? undefined : selectedCurrency)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{documentData.length} invoices issued</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-medium text-gray-600">Gross Profit (After COGS)</h3>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(structuredFinancials.grossProfit, selectedCurrency === 'all' ? undefined : selectedCurrency)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              COGS: {formatCurrency(structuredFinancials.totalCOGS, selectedCurrency === 'all' ? undefined : selectedCurrency)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-5 h-5 text-red-600" />
              <h3 className="text-sm font-medium text-gray-600">Profit Before Tax</h3>
            </div>
            <p className={`text-2xl font-bold ${structuredFinancials.profitBeforeTax >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(structuredFinancials.profitBeforeTax, selectedCurrency === 'all' ? undefined : selectedCurrency)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Expenses: {formatCurrency(structuredFinancials.totalExpenses, selectedCurrency === 'all' ? undefined : selectedCurrency)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-medium text-gray-600">Total Unpaid Balance</h3>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(structuredFinancials.totalUnpaid, selectedCurrency === 'all' ? undefined : selectedCurrency)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Collected: {formatCurrency(structuredFinancials.totalCollected, selectedCurrency === 'all' ? undefined : selectedCurrency)}
            </p>
          </div>
        </div>

        {/* Section Accordions */}
        <div className="space-y-6">

          {/* 1. 3-Tier Profit & Loss Statement */}
          {visibleSections.profitLoss && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div
                role="button"
                onClick={() => toggleSection('profitloss')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <PieChart className="w-6 h-6 text-slate-700" />
                  <h2 className="text-xl font-semibold text-gray-900">Profit & Loss Statement (Income Statement)</h2>
                </div>
                {expandedSections['profitloss'] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>

              {expandedSections['profitloss'] && (
                <div className="px-6 pb-6 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Revenue & COGS */}
                    <div className="border border-gray-200 rounded-lg p-5 space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b pb-2">Revenue</h4>
                        <div className="mt-2 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Sale Revenue:</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(structuredFinancials.totalSalesRevenue)}</span>
                          </div>
                          <div className="flex justify-between font-bold border-t pt-2 text-emerald-700">
                            <span>Total Revenue:</span>
                            <span>{formatCurrency(structuredFinancials.totalSalesRevenue)}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b pb-2">Cost of Goods Sold (COGS)</h4>
                        <div className="mt-2 space-y-2 text-sm">
                          {Object.keys(structuredFinancials.cogsBreakdown).length > 0 ? (
                            Object.entries(structuredFinancials.cogsBreakdown).map(([cat, amt]) => (
                              <div key={cat} className="flex justify-between">
                                <span className="text-gray-600">{cat}:</span>
                                <span className="font-medium text-gray-800">{formatCurrency(amt)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-gray-400 italic">No direct labor or COGS recorded.</div>
                          )}
                          <div className="flex justify-between font-bold border-t pt-2 text-red-700">
                            <span>Total COGS:</span>
                            <span>{formatCurrency(structuredFinancials.totalCOGS)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex justify-between font-bold text-blue-900">
                        <span>GROSS PROFIT:</span>
                        <span>{formatCurrency(structuredFinancials.grossProfit)}</span>
                      </div>
                    </div>

                    {/* Operating & Admin Expenses */}
                    <div className="border border-gray-200 rounded-lg p-5 space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b pb-2">Operating Expenses</h4>
                        <div className="mt-2 space-y-1.5 text-sm max-h-40 overflow-y-auto pr-2">
                          {Object.entries(structuredFinancials.operatingBreakdown).map(([cat, amt]) => (
                            <div key={cat} className="flex justify-between text-xs">
                              <span className="text-gray-600">{cat}:</span>
                              <span className="font-medium text-gray-800">{formatCurrency(amt)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2 text-xs text-gray-900 mt-2">
                          <span>Total Operating Expenses:</span>
                          <span>{formatCurrency(structuredFinancials.totalOperating)}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b pb-2">Administrative & Tax Expenses</h4>
                        <div className="mt-2 space-y-1.5 text-sm max-h-32 overflow-y-auto pr-2">
                          {Object.entries(structuredFinancials.adminBreakdown).map(([cat, amt]) => (
                            <div key={cat} className="flex justify-between text-xs">
                              <span className="text-gray-600">{cat}:</span>
                              <span className="font-medium text-gray-800">{formatCurrency(amt)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2 text-xs text-gray-900 mt-2">
                          <span>Total Admin Expenses:</span>
                          <span>{formatCurrency(structuredFinancials.totalAdmin)}</span>
                        </div>
                      </div>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between font-bold text-emerald-900">
                        <span>PROFIT BEFORE TAX:</span>
                        <span>{formatCurrency(structuredFinancials.profitBeforeTax)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Invoices Main Table */}
          {visibleSections.invoiceList && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div
                role="button"
                onClick={() => toggleSection('documents')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Invoices Main (Monthly Invoice Ledger)</h2>
                </div>
                {expandedSections['documents'] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>

              {expandedSections['documents'] && (
                <div className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Invoice Date</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Company/Client</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Project/Events</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                          <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">VAT</th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                          <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                          <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {documentData.map((item) => (
                          <tr key={item.document_id} className="hover:bg-gray-50 text-xs">
                            <td className="px-3 py-2.5 text-gray-900 whitespace-nowrap">{formatDate(item.issue_date)}</td>
                            <td className="px-3 py-2.5 text-gray-900 font-medium">{item.customer_name}</td>
                            <td className="px-3 py-2.5 text-gray-700">{item.project_events || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-700">{item.location || '—'}</td>
                            <td className="px-3 py-2.5">
                              <button
                                onClick={() => navigate(p(`/documents/${item.document_id}`))}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                {item.document_number}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{(item.tax_percent || 0).toFixed(2)}%</td>
                            <td className="px-3 py-2.5 text-right text-gray-900 font-medium">{formatCurrency(item.total_amount, item.currency)}</td>
                            <td className="px-3 py-2.5 text-right text-emerald-600 font-medium">{formatCurrency(item.paid || 0, item.currency)}</td>
                            <td className="px-3 py-2.5 text-right text-amber-600 font-semibold">{formatCurrency(item.balance || 0, item.currency)}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                item.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                item.status === 'partially_paid' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                'bg-red-50 text-red-700 border border-red-200'
                              }`}>
                                {mapStatus(item.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-300 text-xs">
                        <tr>
                          <td colSpan={6} className="px-3 py-3 text-right uppercase text-gray-600">Grand Total:</td>
                          <td className="px-3 py-3 text-right font-bold text-gray-900">{formatCurrency(structuredFinancials.totalSalesRevenue)}</td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-600">{formatCurrency(structuredFinancials.totalCollected)}</td>
                          <td className="px-3 py-3 text-right font-bold text-amber-600">{formatCurrency(structuredFinancials.totalUnpaid)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* KAVS Styled Summary Card */}
                  <div className="flex justify-end mt-6">
                    <div className="w-full max-w-sm bg-[#e2efda] border border-[#a9d18e] rounded-lg p-4 font-mono text-sm text-gray-800 shadow-sm">
                      <div className="font-bold text-[#375623] mb-2 border-b border-[#a9d18e] pb-1">Summary</div>
                      <div className="grid grid-cols-2 gap-y-2">
                        <div className="font-bold text-[#375623]">Total sales:</div>
                        <div className="text-right font-bold text-[#375623]">{formatCurrency(structuredFinancials.totalSalesRevenue)}</div>
                        <div className="font-bold text-[#375623]">Paid:</div>
                        <div className="text-right font-bold text-[#375623]">{formatCurrency(structuredFinancials.totalCollected)}</div>
                        <div className="font-bold text-[#375623]">Unpaid:</div>
                        <div className="text-right font-bold text-[#375623]">{formatCurrency(structuredFinancials.totalUnpaid)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Daily Expense Matrix */}
          {visibleSections.expenseMatrix && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div
                role="button"
                onClick={() => toggleSection('expenseMatrix')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="w-6 h-6 text-red-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Daily Expenses Matrix</h2>
                </div>
                {expandedSections['expenseMatrix'] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>

              {expandedSections['expenseMatrix'] && (
                <div className="px-6 pb-6">
                  {expenseMatrix.sortedDates.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">No expenses recorded for this period.</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[500px]">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-2 py-2 text-left font-bold text-gray-700 bg-gray-100 sticky left-0 z-20">DATE</th>
                            {EXPENSE_CATEGORIES_ORDER.map(cat => (
                              <th key={cat} className="px-2 py-2 text-right font-medium text-gray-600 whitespace-nowrap">{cat}</th>
                            ))}
                            <th className="px-2 py-2 text-right font-bold text-gray-900 bg-gray-100">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100 font-mono">
                          {expenseMatrix.sortedDates.map(dateStr => {
                            const dayMap = expenseMatrix.datesMap[dateStr] || {};
                            const dayTotal = Object.values(dayMap).reduce((a, b) => a + b, 0);
                            return (
                              <tr key={dateStr} className="hover:bg-gray-50">
                                <td className="px-2 py-1.5 text-gray-900 font-sans font-medium whitespace-nowrap bg-gray-50/50 sticky left-0 z-10">{dateStr}</td>
                                {EXPENSE_CATEGORIES_ORDER.map(cat => (
                                  <td key={cat} className="px-2 py-1.5 text-right text-gray-700 whitespace-nowrap">
                                    {dayMap[cat] ? formatCurrency(dayMap[cat]) : '—'}
                                  </td>
                                ))}
                                <td className="px-2 py-1.5 text-right font-bold text-red-600 bg-gray-50/50 whitespace-nowrap">
                                  {formatCurrency(dayTotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold font-mono border-t-2 border-gray-300 sticky bottom-0 z-10">
                          <tr>
                            <td className="px-2 py-2 text-gray-900 font-sans sticky left-0 z-20 bg-gray-100">TOTAL</td>
                            {EXPENSE_CATEGORIES_ORDER.map(cat => (
                              <td key={cat} className="px-2 py-2 text-right whitespace-nowrap">
                                {expenseMatrix.categoryTotals[cat] ? formatCurrency(expenseMatrix.categoryTotals[cat]) : '—'}
                              </td>
                            ))}
                            <td className="px-2 py-2 text-right text-red-700 bg-gray-200 whitespace-nowrap">
                              {formatCurrency(expenseMatrix.grandTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. Payments Received Log */}
          {visibleSections.paymentsLog && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div
                role="button"
                onClick={() => toggleSection('paymentsLog')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Payments Received Log</h2>
                </div>
                {expandedSections['paymentsLog'] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </div>

              {expandedSections['paymentsLog'] && (
                <div className="px-6 pb-6">
                  {paymentsLogData.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">No payments received in this period.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Payment Date</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Invoice #</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Customer</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Account Received</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-500 uppercase">Method</th>
                            <th className="px-3 py-2.5 text-right font-medium text-gray-500 uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paymentsLogData.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-900 whitespace-nowrap">{new Date(item.payment_date).toLocaleDateString()}</td>
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
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
