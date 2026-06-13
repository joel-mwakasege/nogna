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
  PieChart
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  // Local temporary inputs (for UI input fields/binds)
  const [tempDateFrom, setTempDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 12);
    return date.toISOString().split('T')[0];
  });
  const [tempDateTo, setTempDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [tempSelectedCurrency, setTempSelectedCurrency] = useState('all');

  // Applied query inputs (used for data fetching and report formatting/calculations)
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        fetchPaymentsLog(from, to, currency)
      ]);
    } catch (err) {
      console.error("Promise.all failed in fetchAllReportData:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    console.log("Applying filters:", { tempDateFrom, tempDateTo, tempSelectedCurrency });
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

    const { data, error } = await query as { data: any[] | null, error: any };
    if (error) {
      console.error("fetchRevenueData database error:", error);
    } else if (data) {
      const filtered = data.filter(item => {
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
    // 1. Fetch customer emails and created_at
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, email, created_at')
      .eq('company_id', companyId)
      .is('deleted_at', null) as { data: any[] | null, error: any };

    if (custError) {
      console.error("fetchCustomerData (customers query) database error:", custError);
    }

    const emailMap: Record<string, string> = {};
    const createdAtMap: Record<string, string> = {};
    if (customers) {
      customers.forEach(c => {
        emailMap[c.id] = c.email || '';
        createdAtMap[c.id] = c.created_at || '';
      });
    }

    // 2. Fetch invoices in date range and currency
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

    const { data: invoices, error: invError } = await query as { data: any[] | null, error: any };
    if (invError || !invoices) {
      if (invError) {
        console.error("fetchCustomerData (invoices query) database error:", invError);
      }
      setCustomerData([]);
      return;
    }

    const invoiceIds = invoices.map(d => d.document_id);
    const paymentsMap: Record<string, number> = {};

    if (invoiceIds.length > 0) {
      // 3. Fetch payments for these invoices
      const { data: payments, error: payError } = await supabase
        .from('payments')
        .select('document_id, amount')
        .in('document_id', invoiceIds)
        .eq('company_id', companyId)
        .is('deleted_at', null) as { data: any[] | null, error: any };

      if (payError) {
        console.error("fetchCustomerData (payments query) database error:", payError);
      }

      if (payments) {
        payments.forEach(p => {
          paymentsMap[p.document_id] = (paymentsMap[p.document_id] || 0) + Number(p.amount);
        });
      }
    }

    // 4. Group invoices by customer and currency
    const grouped: Record<string, CustomerRevenue> = {};
    invoices.forEach(inv => {
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

    const result = Object.values(grouped).sort((a, b) => b.total_paid - a.total_paid);
    setCustomerData(result);
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

    const { data, error } = await query as { data: any[] | null, error: any };
    if (error) {
      console.error("fetchOutstandingData database error:", error);
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
      console.error("fetchDocumentData database error:", error);
    } else if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documentIds = (data as any[]).map(d => d.document_id);
      
      const customFieldsMap: Record<string, { project?: string; location?: string }> = {};
      const paymentsMap: Record<string, number> = {};
      const paymentsListMap: Record<string, Array<{ date: string; amount: number }>> = {};

      if (documentIds.length > 0) {
        // Fetch client custom fields
        const { data: customFields } = await supabase
          .from('client_custom_fields')
          .select('document_id, field_label, field_value')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .in('document_id', documentIds) as { data: any[] | null };

        if (customFields) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

        // Fetch payments with payment_date for installment tracking
        const { data: payments } = await supabase
          .from('payments')
          .select('document_id, amount, payment_date')
          .in('document_id', documentIds)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .is('deleted_at', null) as { data: any[] | null };

        if (payments) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Enrich documentData
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const exportInvoicesToCSV = (data: DocumentTotal[]) => {
    if (data.length === 0) return;

    const headers: string[] = [];
    if (visibleColumns.invoiceList.invoiceDate) headers.push('Invoice date');
    if (visibleColumns.invoiceList.client) headers.push('Company/client');
    if (visibleColumns.invoiceList.project) headers.push('Project/Events');
    if (visibleColumns.invoiceList.location) headers.push('Location');
    if (visibleColumns.invoiceList.invoiceNumber) headers.push('Invoice number2');
    if (visibleColumns.invoiceList.taxRate) headers.push('Tax rate(VAT)');
    if (visibleColumns.invoiceList.totalAmount) headers.push('Total Amount');
    if (visibleColumns.invoiceList.paid) headers.push('Paid');
    if (visibleColumns.invoiceList.balance) headers.push('Balance');
    if (visibleColumns.invoiceList.paymentDates) headers.push('Payment Dates');
    if (visibleColumns.invoiceList.status) headers.push('Status');

    const formatCSVValue = (val: string | number | boolean | null | undefined) => {
      if (val === null || val === undefined) return '';
      const stringValue = String(val);
      return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
    };

    const rows = data.map(item => {
      const rowData: string[] = [];
      const taxRate = `${(item.tax_percent || 0).toFixed(2)}%`;
      const payHistoryStr = item.payment_history
        ? item.payment_history.map(pay => `${formatDate(pay.date)} (${pay.amount})`).join('; ')
        : '';

      if (visibleColumns.invoiceList.invoiceDate) rowData.push(formatCSVValue(formatDate(item.issue_date)));
      if (visibleColumns.invoiceList.client) rowData.push(formatCSVValue(item.customer_name));
      if (visibleColumns.invoiceList.project) rowData.push(formatCSVValue(item.project_events));
      if (visibleColumns.invoiceList.location) rowData.push(formatCSVValue(item.location));
      if (visibleColumns.invoiceList.invoiceNumber) rowData.push(formatCSVValue(item.document_number));
      if (visibleColumns.invoiceList.taxRate) rowData.push(formatCSVValue(taxRate));
      if (visibleColumns.invoiceList.totalAmount) rowData.push(formatCSVValue(item.total_amount));
      if (visibleColumns.invoiceList.paid) rowData.push(formatCSVValue(item.paid));
      if (visibleColumns.invoiceList.balance) rowData.push(formatCSVValue(item.balance));
      if (visibleColumns.invoiceList.paymentDates) rowData.push(formatCSVValue(payHistoryStr));
      if (visibleColumns.invoiceList.status) rowData.push(formatCSVValue(mapStatus(item.status)));

      return rowData.join(',');
    });

    const totalsByCurrency = data.reduce((acc, doc) => {
      const curr = doc.currency || 'USD';
      if (!acc[curr]) {
        acc[curr] = { total: 0, paid: 0, balance: 0 };
      }
      acc[curr].total += doc.total_amount || 0;
      acc[curr].paid += doc.paid || 0;
      acc[curr].balance += doc.balance || 0;
      return acc;
    }, {} as Record<string, { total: number; paid: number; balance: number }>);

    Object.entries(totalsByCurrency).forEach(([currency, sum]) => {
      const rowData: string[] = [];
      if (visibleColumns.invoiceList.invoiceDate) rowData.push(formatCSVValue(`Total (${currency})`));
      else if (headers.length > 0) {
        rowData.push(formatCSVValue(`Total (${currency})`));
      }
      
      const preCount = [
        visibleColumns.invoiceList.client,
        visibleColumns.invoiceList.project,
        visibleColumns.invoiceList.location,
        visibleColumns.invoiceList.invoiceNumber,
        visibleColumns.invoiceList.taxRate
      ].filter(Boolean).length;

      const actualPreCount = visibleColumns.invoiceList.invoiceDate ? preCount : Math.max(0, preCount - 1);
      for (let i = 0; i < actualPreCount; i++) {
        rowData.push('');
      }

      if (visibleColumns.invoiceList.totalAmount) rowData.push(formatCSVValue(sum.total));
      if (visibleColumns.invoiceList.paid) rowData.push(formatCSVValue(sum.paid));
      if (visibleColumns.invoiceList.balance) rowData.push(formatCSVValue(sum.balance));
      if (visibleColumns.invoiceList.paymentDates) rowData.push('');
      if (visibleColumns.invoiceList.status) rowData.push('');

      rows.push(rowData.join(','));
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-invoice-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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
      console.error("fetchPaymentsLog database error:", error);
    } else if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const exportPaymentsToCSV = (data: PaymentLogEntry[]) => {
    if (data.length === 0) return;

    const headers: string[] = [];
    if (visibleColumns.paymentsLog.paymentDate) headers.push('Payment Date');
    if (visibleColumns.paymentsLog.invoiceNumber) headers.push('Invoice Number');
    if (visibleColumns.paymentsLog.client) headers.push('Company/Client');
    if (visibleColumns.paymentsLog.account) headers.push('Account Received');
    if (visibleColumns.paymentsLog.paymentMethod) headers.push('Method');
    if (visibleColumns.paymentsLog.reference) headers.push('Reference');
    if (visibleColumns.paymentsLog.notes) headers.push('Notes');
    if (visibleColumns.paymentsLog.amount) headers.push('Amount');

    const formatCSVValue = (val: string | number | boolean | null | undefined) => {
      if (val === null || val === undefined) return '';
      const stringValue = String(val);
      return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
    };

    const rows = data.map(item => {
      const rowData: string[] = [];
      if (visibleColumns.paymentsLog.paymentDate) rowData.push(formatCSVValue(new Date(item.payment_date).toLocaleDateString()));
      if (visibleColumns.paymentsLog.invoiceNumber) rowData.push(formatCSVValue(item.document_number));
      if (visibleColumns.paymentsLog.client) rowData.push(formatCSVValue(item.customer_name));
      if (visibleColumns.paymentsLog.account) rowData.push(formatCSVValue(item.account_name));
      if (visibleColumns.paymentsLog.paymentMethod) rowData.push(formatCSVValue(item.payment_method.replace('_', ' ')));
      if (visibleColumns.paymentsLog.reference) rowData.push(formatCSVValue(item.reference_number || ''));
      if (visibleColumns.paymentsLog.notes) rowData.push(formatCSVValue(item.notes || ''));
      if (visibleColumns.paymentsLog.amount) rowData.push(formatCSVValue(item.amount));
      return rowData.join(',');
    });

    const totalsByCurrency = data.reduce((acc, pay) => {
      const curr = pay.currency || 'USD';
      acc[curr] = (acc[curr] || 0) + pay.amount;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(totalsByCurrency).forEach(([currency, total]) => {
      const rowData: string[] = [];
      if (visibleColumns.paymentsLog.paymentDate) rowData.push(formatCSVValue(`Total (${currency})`));
      else if (headers.length > 0) {
        rowData.push(formatCSVValue(`Total (${currency})`));
      }

      const preCount = [
        visibleColumns.paymentsLog.invoiceNumber,
        visibleColumns.paymentsLog.client,
        visibleColumns.paymentsLog.account,
        visibleColumns.paymentsLog.paymentMethod,
        visibleColumns.paymentsLog.reference,
        visibleColumns.paymentsLog.notes
      ].filter(Boolean).length;

      const actualPreCount = visibleColumns.paymentsLog.paymentDate ? preCount : Math.max(0, preCount - 1);
      for (let i = 0; i < actualPreCount; i++) {
        rowData.push('');
      }

      if (visibleColumns.paymentsLog.amount) rowData.push(formatCSVValue(total));

      rows.push(rowData.join(','));
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-received-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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

    const { data, error } = await query as { data: any[] | null, error: any };
    if (error) {
      console.error("fetchProfitLossData database error:", error);
    } else if (data) {
      const filtered = data.filter(item => {
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

  const calculateTotals = () => {
    const filteredProfitLoss = profitLossData;
    const filteredRevenue = revenueData;
    const filteredOutstanding = outstandingData;

    if (selectedCurrency === 'all') {
      const revenueByCurrency = filteredProfitLoss.reduce((acc, item) => {
        if (!acc[item.currency]) {
          acc[item.currency] = {
            totalRevenue: 0,
            invoiceRevenue: 0,
            depositRevenue: 0
          };
        }
        acc[item.currency].totalRevenue += Number(item.total_revenue);
        acc[item.currency].invoiceRevenue += Number(item.invoice_revenue);
        acc[item.currency].depositRevenue += Number(item.deposit_revenue);
        return acc;
      }, {} as Record<string, { totalRevenue: number; invoiceRevenue: number; depositRevenue: number }>);

      const outstandingByCurrency = filteredOutstanding.reduce((acc, item) => {
        if (!acc[item.currency]) {
          acc[item.currency] = 0;
        }
        acc[item.currency] += Number(item.balance_due);
        return acc;
      }, {} as Record<string, number>);

      return {
        revenueByCurrency,
        outstandingByCurrency,
        totalInvoices: filteredRevenue.reduce((sum, item) => sum + item.document_count, 0),
        totalCustomers: customerData.length,
        currencySymbol: '$',
        isMultiCurrency: true
      };
    } else {
      const totalRevenue = filteredProfitLoss.reduce((sum, item) => sum + Number(item.total_revenue), 0);
      const totalInvoiceRevenue = filteredProfitLoss.reduce((sum, item) => sum + Number(item.invoice_revenue), 0);
      const totalDepositRevenue = filteredProfitLoss.reduce((sum, item) => sum + Number(item.deposit_revenue), 0);
      const totalInvoices = filteredRevenue.reduce((sum, item) => sum + item.document_count, 0);
      const totalOutstanding = filteredOutstanding.reduce((sum, item) => sum + Number(item.balance_due), 0);
      const currencySymbol = currencies.find(c => c.code === selectedCurrency)?.symbol || '$';

      return {
        totalRevenue,
        totalInvoiceRevenue,
        totalDepositRevenue,
        totalInvoices,
        totalOutstanding,
        totalCustomers: customerData.length,
        currencySymbol,
        isMultiCurrency: false
      };
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totals = calculateTotals() as any;

  // Group invoice totals by currency
  const invoiceTotalsByCurrency = documentData.reduce((acc, doc) => {
    const curr = doc.currency || 'USD';
    if (!acc[curr]) {
      acc[curr] = {
        total: 0,
        paid: 0,
        balance: 0
      };
    }
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
        <div className="mb-8">
          <div className="flex items-center justify-end">
            <Button onClick={handleRefresh} variant="secondary" disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={tempDateFrom}
                onChange={(e) => setTempDateFrom(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={tempDateTo}
                onChange={(e) => setTempDateTo(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={tempSelectedCurrency}
                onChange={(e) => setTempSelectedCurrency(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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

        {/* Content sections wrapper with non-blocking loader */}
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-lg min-h-[300px]">
              <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm font-medium text-gray-700">Updating report data...</p>
              </div>
            </div>
          )}

          <div className={loading ? 'opacity-40 pointer-events-none transition-opacity duration-200' : 'transition-opacity duration-200'}>

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

              {visibleSections.invoiceList && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Monthly Invoice Report Columns</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {[
                      { key: 'invoiceDate', label: 'Invoice Date' },
                      { key: 'client', label: 'Company/Client' },
                      { key: 'project', label: 'Project/Events' },
                      { key: 'location', label: 'Location' },
                      { key: 'invoiceNumber', label: 'Invoice Number' },
                      { key: 'taxRate', label: 'Tax Rate' },
                      { key: 'totalAmount', label: 'Total Amount' },
                      { key: 'paid', label: 'Paid' },
                      { key: 'balance', label: 'Balance' },
                      { key: 'paymentDates', label: 'Payment Dates & Details' },
                      { key: 'status', label: 'Status' },
                    ].map((col) => (
                      <label key={col.key} className="flex items-center gap-2 bg-white px-3 py-2 rounded-md shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 select-none">
                        <input
                          type="checkbox"
                          checked={visibleColumns.invoiceList[col.key as keyof VisibleColumns['invoiceList']]}
                          onChange={(e) => {
                            const updated = {
                              ...visibleColumns,
                              invoiceList: {
                                ...visibleColumns.invoiceList,
                                [col.key]: e.target.checked,
                              },
                            };
                            setVisibleColumns(updated);
                            localStorage.setItem('nogna_report_visible_columns', JSON.stringify(updated));
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span className="text-sm text-gray-700 font-medium">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {visibleSections.paymentsLog && (
                <div>
                  <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Payments Received Log Columns</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {[
                      { key: 'paymentDate', label: 'Payment Date' },
                      { key: 'invoiceNumber', label: 'Invoice Number' },
                      { key: 'client', label: 'Company/Client' },
                      { key: 'account', label: 'Account Received' },
                      { key: 'paymentMethod', label: 'Method' },
                      { key: 'reference', label: 'Reference Number' },
                      { key: 'notes', label: 'Notes' },
                      { key: 'amount', label: 'Amount' },
                    ].map((col) => (
                      <label key={col.key} className="flex items-center gap-2 bg-white px-3 py-2 rounded-md shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 select-none">
                        <input
                          type="checkbox"
                          checked={visibleColumns.paymentsLog[col.key as keyof VisibleColumns['paymentsLog']]}
                          onChange={(e) => {
                            const updated = {
                              ...visibleColumns,
                              paymentsLog: {
                                ...visibleColumns.paymentsLog,
                                [col.key]: e.target.checked,
                              },
                            };
                            setVisibleColumns(updated);
                            localStorage.setItem('nogna_report_visible_columns', JSON.stringify(updated));
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span className="text-sm text-gray-700 font-medium">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
              </div>
            </div>
            {totals.isMultiCurrency ? (
              <div className="space-y-2">
                {Object.entries(totals.revenueByCurrency as Record<string, { totalRevenue: number; invoiceRevenue: number; depositRevenue: number }>).map(([currency, amounts]) => (
                  <div key={currency} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(amounts.totalRevenue, currency)}
                    </p>
                    <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                      <p>{formatCurrency(amounts.invoiceRevenue, currency)} from invoices</p>
                      <p>{formatCurrency(amounts.depositRevenue, currency)} from deposits</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totals.totalRevenue, selectedCurrency)}
                </p>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  <p>{formatCurrency(totals.totalInvoiceRevenue, selectedCurrency)} from {totals.totalInvoices} invoices</p>
                  <p>{formatCurrency(totals.totalDepositRevenue, selectedCurrency)} from deposits</p>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-medium text-gray-600">Outstanding</h3>
              </div>
            </div>
            {totals.isMultiCurrency ? (
              <div className="space-y-1">
                {Object.entries(totals.outstandingByCurrency as Record<string, number>).map(([currency, amount]) => (
                  <p key={currency} className="text-xl font-bold text-gray-900">
                    {formatCurrency(amount, currency)}
                  </p>
                ))}
                <p className="text-xs text-gray-500 mt-1">{outstandingData.length} unpaid invoices</p>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totals.totalOutstanding, selectedCurrency)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{outstandingData.length} unpaid invoices</p>
              </>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-600" />
                <h3 className="text-sm font-medium text-gray-600">Total Customers</h3>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totals.totalCustomers}</p>
            <p className="text-xs text-gray-500 mt-1">Active customers</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-medium text-gray-600">Avg Invoice Value</h3>
              </div>
            </div>
            {totals.isMultiCurrency ? (
              <div className="space-y-1">
                {Object.entries(totals.revenueByCurrency as Record<string, { totalRevenue: number; invoiceRevenue: number; depositRevenue: number }>).map(([currency, amounts]) => {
                  const invoiceCount = revenueData.filter(r => r.currency === currency).reduce((sum, r) => sum + r.document_count, 0);
                  return (
                    <p key={currency} className="text-lg font-bold text-gray-900">
                      {formatCurrency(invoiceCount > 0 ? amounts.invoiceRevenue / invoiceCount : 0, currency)}
                    </p>
                  );
                })}
                <p className="text-xs text-gray-500 mt-1">Per invoice</p>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(
                    totals.totalInvoices > 0 ? totals.totalInvoiceRevenue / totals.totalInvoices : 0,
                    selectedCurrency
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">Per invoice</p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {visibleSections.profitLoss && (
            <div className="bg-white rounded-lg shadow">
              <button
                onClick={() => toggleSection('profitloss')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
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
                  {expandedSections['profitloss'] ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

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
                          <React.Fragment key={idx}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {new Date(item.year, item.month - 1).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long'
                                })}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.currency}</td>
                              <td className="px-4 py-3 text-sm text-right text-emerald-600 font-semibold">
                                {formatCurrency(Number(item.total_revenue), item.currency)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-red-600 font-semibold">
                                {formatCurrency(Number(item.total_expenses), item.currency)}
                              </td>
                              <td className={`px-4 py-3 text-sm text-right font-bold ${
                                Number(item.net_profit) >= 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}>
                                {formatCurrency(Number(item.net_profit), item.currency)}
                              </td>
                            </tr>
                            <tr key={`${idx}-details`} className="bg-gray-50">
                              <td colSpan={5} className="px-4 py-3">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  <div>
                                    <div className="text-xs text-gray-600 font-medium mb-2">Revenue Breakdown:</div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-700">Invoices:</span>
                                        <span className="text-gray-900 font-medium ml-2">
                                          {formatCurrency(Number(item.invoice_revenue), item.currency)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-xs">
                                        <span className="text-gray-700">Deposits:</span>
                                        <span className="text-gray-900 font-medium ml-2">
                                          {formatCurrency(Number(item.deposit_revenue), item.currency)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  {item.expenses_by_category && item.expenses_by_category.length > 0 && (
                                    <div>
                                      <div className="text-xs text-gray-600 font-medium mb-2">Expense Breakdown:</div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {item.expenses_by_category.map((expense, expIdx) => (
                                          <div key={expIdx} className="flex justify-between text-xs">
                                            <span className="text-gray-700">{expense.category}:</span>
                                            <span className="text-gray-900 font-medium ml-2">
                                              {formatCurrency(Number(expense.amount), item.currency)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {visibleSections.revenueByPeriod && (
            <div className="bg-white rounded-lg shadow">
              <button
                onClick={() => toggleSection('revenue')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Revenue by Period</h2>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToCSV(revenueData, 'revenue-by-period');
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  {expandedSections['revenue'] ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedSections['revenue'] && (
                <div className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoices</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {revenueData.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(item.year, item.month - 1).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long'
                              })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.currency}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">{item.document_count}</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                              {formatCurrency(Number(item.total_revenue), item.currency)}
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

          {visibleSections.customerRevenue && (
            <div className="bg-white rounded-lg shadow">
              <button
                onClick={() => toggleSection('customers')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-slate-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Customer Revenue</h2>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToCSV(customerData, 'customer-revenue');
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  {expandedSections['customers'] ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedSections['customers'] && (
                <div className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Currency</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Invoices</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {customerData.map((item, idx) => (
                          <tr key={`${item.customer_id}-${item.currency}-${idx}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900">{item.customer_name}</div>
                              <div className="text-xs text-gray-500">{item.customer_email}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.currency || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {item.total_invoices}
                              <span className="text-xs text-gray-500 ml-1">
                                ({item.paid_invoices} paid)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-600">
                              {formatCurrency(Number(item.total_paid), item.currency || undefined)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-amber-600">
                              {formatCurrency(Number(item.total_outstanding), item.currency || undefined)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.last_invoice_date
                                ? new Date(item.last_invoice_date).toLocaleDateString()
                                : 'N/A'
                              }
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

          {visibleSections.outstandingInvoices && (
            <div className="bg-white rounded-lg shadow">
              <button
                onClick={() => toggleSection('outstanding')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-amber-600" />
                  <h2 className="text-xl font-semibold text-gray-900">Outstanding Invoices</h2>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToCSV(outstandingData, 'outstanding-invoices');
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </Button>
                  {expandedSections['outstanding'] ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedSections['outstanding'] && (
                <div className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue Date</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Days</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount Due</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {outstandingData.map((item) => (
                          <tr key={item.document_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => navigate(p(`/documents/${item.document_id}`))}
                                className="text-sm font-medium text-slate-600 hover:text-blue-800"
                              >
                                {item.document_number}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-gray-900">{item.customer_name}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(item.issue_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={`font-medium ${
                                item.days_outstanding > 30 ? 'text-red-600' :
                                item.days_outstanding > 15 ? 'text-amber-600' :
                                'text-gray-900'
                              }`}>
                                {item.days_outstanding}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900">
                              {formatCurrency(Number(item.amount_due), item.currency)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-emerald-600">
                              {formatCurrency(Number(item.amount_paid), item.currency)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-amber-600">
                              {formatCurrency(Number(item.balance_due), item.currency)}
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

          {visibleSections.paymentsLog && (
            <div className="bg-white rounded-lg shadow">
              <button
                onClick={() => toggleSection('paymentsLog')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
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
                  {expandedSections['paymentsLog'] ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedSections['paymentsLog'] && (
                <div className="px-6 pb-6">
                  {paymentsLogData.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">No payments received in this period.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {visibleColumns.paymentsLog.paymentDate && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Date</th>}
                            {visibleColumns.paymentsLog.invoiceNumber && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice Number</th>}
                            {visibleColumns.paymentsLog.client && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company/Client</th>}
                            {visibleColumns.paymentsLog.account && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Received</th>}
                            {visibleColumns.paymentsLog.paymentMethod && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>}
                            {visibleColumns.paymentsLog.reference && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>}
                            {visibleColumns.paymentsLog.notes && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>}
                            {visibleColumns.paymentsLog.amount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paymentsLogData.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              {visibleColumns.paymentsLog.paymentDate && (
                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                  {new Date(item.payment_date).toLocaleDateString()}
                                </td>
                              )}
                              {visibleColumns.paymentsLog.invoiceNumber && (
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                  {item.document_number}
                                </td>
                              )}
                              {visibleColumns.paymentsLog.client && (
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {item.customer_name}
                                </td>
                              )}
                              {visibleColumns.paymentsLog.account && (
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.account_name}
                                </td>
                              )}
                              {visibleColumns.paymentsLog.paymentMethod && (
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.payment_method.replace('_', ' ')}
                                </td>
                              )}
                              {visibleColumns.paymentsLog.reference && (
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.reference_number || '—'}
                                </td>
                              )}
                              {visibleColumns.paymentsLog.notes && (
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {item.notes || '—'}
                                </td>
                              )}
                              {visibleColumns.paymentsLog.amount && (
                                <td className="px-4 py-3 text-sm text-right text-emerald-600 font-semibold whitespace-nowrap">
                                  {formatCurrency(item.amount, item.currency)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                          {Object.entries(
                            paymentsLogData.reduce((acc, pay) => {
                              const curr = pay.currency || 'USD';
                              acc[curr] = (acc[curr] || 0) + pay.amount;
                              return acc;
                            }, {} as Record<string, number>)
                          ).map(([currency, totalAmount]) => {
                            const preColSpan = [
                              visibleColumns.paymentsLog.paymentDate,
                              visibleColumns.paymentsLog.invoiceNumber,
                              visibleColumns.paymentsLog.client,
                              visibleColumns.paymentsLog.account,
                              visibleColumns.paymentsLog.paymentMethod,
                              visibleColumns.paymentsLog.reference,
                              visibleColumns.paymentsLog.notes
                            ].filter(Boolean).length;
                            
                            return (
                              <tr key={currency}>
                                {preColSpan > 0 && (
                                  <td colSpan={preColSpan} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Total ({currency})
                                  </td>
                                )}
                                {visibleColumns.paymentsLog.amount && (
                                  <td className="px-4 py-3 text-right text-sm text-emerald-600 font-bold whitespace-nowrap">
                                    {formatCurrency(totalAmount, currency)}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {visibleSections.invoiceList && (
            <div className="bg-white rounded-lg shadow">
              <button
                onClick={() => toggleSection('documents')}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
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
                  {expandedSections['documents'] ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {expandedSections['documents'] && (
                <div className="px-6 pb-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {visibleColumns.invoiceList.invoiceDate && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice date</th>}
                          {visibleColumns.invoiceList.client && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company/client</th>}
                          {visibleColumns.invoiceList.project && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project/Events</th>}
                          {visibleColumns.invoiceList.location && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>}
                          {visibleColumns.invoiceList.invoiceNumber && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice number2</th>}
                          {visibleColumns.invoiceList.taxRate && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax rate(VAT)</th>}
                          {visibleColumns.invoiceList.totalAmount && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>}
                          {visibleColumns.invoiceList.paid && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>}
                          {visibleColumns.invoiceList.balance && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>}
                          {visibleColumns.invoiceList.paymentDates && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Dates</th>}
                          {visibleColumns.invoiceList.status && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {documentData.map((item) => (
                          <tr key={item.document_id} className="hover:bg-gray-50">
                            {visibleColumns.invoiceList.invoiceDate && (
                              <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {formatDate(item.issue_date)}
                              </td>
                            )}
                            {visibleColumns.invoiceList.client && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {item.customer_name}
                              </td>
                            )}
                            {visibleColumns.invoiceList.project && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {item.project_events || '—'}
                              </td>
                            )}
                            {visibleColumns.invoiceList.location && (
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {item.location || '—'}
                              </td>
                            )}
                            {visibleColumns.invoiceList.invoiceNumber && (
                              <td className="px-4 py-3 text-sm">
                                <button
                                  onClick={() => navigate(p(`/documents/${item.document_id}`))}
                                  className="font-medium text-slate-600 hover:text-blue-800"
                                >
                                  {item.document_number}
                                </button>
                              </td>
                            )}
                            {visibleColumns.invoiceList.taxRate && (
                              <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {(item.tax_percent || 0).toFixed(2)}%
                              </td>
                            )}
                            {visibleColumns.invoiceList.totalAmount && (
                              <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                                {formatCurrency(item.total_amount, item.currency)}
                              </td>
                            )}
                            {visibleColumns.invoiceList.paid && (
                              <td className="px-4 py-3 text-sm text-right text-emerald-600 whitespace-nowrap">
                                {formatCurrency(item.paid || 0, item.currency)}
                              </td>
                            )}
                            {visibleColumns.invoiceList.balance && (
                              <td className="px-4 py-3 text-sm text-right font-semibold text-amber-600 whitespace-nowrap">
                                {formatCurrency(item.balance || 0, item.currency)}
                              </td>
                            )}
                            {visibleColumns.invoiceList.paymentDates && (
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs whitespace-nowrap">
                                {item.payment_history && item.payment_history.length > 0 ? (
                                  <div className="space-y-1">
                                    {item.payment_history.map((pay, i) => (
                                      <div key={i}>
                                        <span className="font-semibold">{formatDate(pay.date)}</span>
                                        <span className="text-emerald-600 ml-1">({formatCurrency(pay.amount, item.currency)})</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.invoiceList.status && (
                              <td className="px-4 py-3 text-sm whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  item.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  item.status === 'partially_paid' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  item.status === 'pending' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                  item.status === 'overdue' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  'bg-gray-50 text-gray-700 border border-gray-200'
                                }`}>
                                  {mapStatus(item.status)}
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                        {Object.entries(invoiceTotalsByCurrency).map(([currency, sum]) => {
                          const invoiceListColSpan = [
                            visibleColumns.invoiceList.invoiceDate,
                            visibleColumns.invoiceList.client,
                            visibleColumns.invoiceList.project,
                            visibleColumns.invoiceList.location,
                            visibleColumns.invoiceList.invoiceNumber,
                            visibleColumns.invoiceList.taxRate,
                          ].filter(Boolean).length;
                          
                          return (
                            <tr key={currency}>
                              {invoiceListColSpan > 0 && (
                                <td colSpan={invoiceListColSpan} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                  Total ({currency})
                                </td>
                              )}
                              {visibleColumns.invoiceList.totalAmount && (
                                <td className="px-4 py-3 text-right text-sm text-gray-900 font-bold whitespace-nowrap">
                                  {formatCurrency(sum.total, currency)}
                                </td>
                              )}
                              {visibleColumns.invoiceList.paid && (
                                <td className="px-4 py-3 text-right text-sm text-emerald-600 font-bold whitespace-nowrap">
                                  {formatCurrency(sum.paid, currency)}
                                </td>
                              )}
                              {visibleColumns.invoiceList.balance && (
                                <td className="px-4 py-3 text-right text-sm text-amber-600 font-bold whitespace-nowrap">
                                  {formatCurrency(sum.balance, currency)}
                                </td>
                              )}
                              {visibleColumns.invoiceList.paymentDates && <td></td>}
                              {visibleColumns.invoiceList.status && <td></td>}
                            </tr>
                          );
                        })}
                      </tfoot>
                    </table>
                  </div>

                  {/* Multi-currency grouped totals below table */}
                  {Object.keys(invoiceTotalsByCurrency).length > 1 && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Totals by Currency</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(invoiceTotalsByCurrency).map(([currency, sum]) => (
                          <div key={currency} className="bg-white p-3 rounded border border-gray-100 shadow-sm">
                            <p className="text-xs font-bold text-gray-400 uppercase">{currency}</p>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Total Sales:</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(sum.total, currency)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Paid:</span>
                                <span className="font-semibold text-emerald-600">{formatCurrency(sum.paid, currency)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Balance:</span>
                                <span className="font-semibold text-amber-600">{formatCurrency(sum.balance, currency)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Styled Summary Card at bottom right */}
                  <div className="flex justify-end mt-6">
                    <div className="w-full max-w-md bg-[#e2efda] border border-[#a9d18e] rounded-lg p-4 font-mono text-sm text-gray-800 shadow-sm">
                      {Object.entries(invoiceTotalsByCurrency).map(([currency, sum], index) => (
                        <div key={currency} className={index > 0 ? 'mt-4 pt-4 border-t border-[#c6e0b4]' : ''}>
                          {Object.keys(invoiceTotalsByCurrency).length > 1 && (
                            <div className="font-bold text-[#375623] mb-2">{currency} Summary</div>
                          )}
                          <div className="grid grid-cols-2 gap-y-2">
                            <div className="font-bold text-[#375623]">Total sales</div>
                            <div className="text-right font-bold text-[#375623]">
                              {formatCurrency(sum.total, currency)}
                            </div>
                            <div className="font-bold text-[#375623]">Paid</div>
                            <div className="text-right font-bold text-[#375623]">
                              {formatCurrency(sum.paid, currency)}
                            </div>
                            <div className="font-bold text-[#375623]">Balance</div>
                            <div className="text-right font-bold text-[#375623]">
                              {formatCurrency(sum.balance, currency)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
