import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
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
}

type ReportView = 'overview' | 'revenue' | 'customers' | 'outstanding' | 'documents';

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

export default function Reports() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ReportView>('overview');
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 12);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCurrency, setSelectedCurrency] = useState('all');
  const [currencies, setCurrencies] = useState<Array<{ code: string; symbol: string }>>([]);

  const [revenueData, setRevenueData] = useState<RevenueByPeriod[]>([]);
  const [customerData, setCustomerData] = useState<CustomerRevenue[]>([]);
  const [outstandingData, setOutstandingData] = useState<OutstandingInvoice[]>([]);
  const [documentData, setDocumentData] = useState<DocumentTotal[]>([]);
  const [profitLossData, setProfitLossData] = useState<ProfitAndLoss[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAdmin) {
      navigate(p('/dashboard'));
      return;
    }
    fetchCurrencies();
    fetchAllReportData();
  }, [isAdmin, navigate]);

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
    setLoading(true);
    await Promise.all([
      fetchRevenueData(from, to, currency),
      fetchCustomerData(from, to, currency),
      fetchOutstandingData(from, to, currency),
      fetchDocumentData(from, to, currency),
      fetchProfitLossData(from, to, currency)
    ]);
    setLoading(false);
  };

  const fetchRevenueData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const fromYear = fromDate.getFullYear();
    const fromMonth = fromDate.getMonth() + 1;
    const toYear = toDate.getFullYear();
    const toMonth = toDate.getMonth() + 1;

    let query = supabase
      .from('revenue_by_period_view')
      .select('*')
      .or(`year.gt.${fromYear},and(year.eq.${fromYear},month.gte.${fromMonth})`)
      .or(`year.lt.${toYear},and(year.eq.${toYear},month.lte.${toMonth})`)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRevenueData(data);
    }
  };

  const fetchCustomerData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    let query = supabase
      .from('customer_revenue_view')
      .select('*')
      .gte('last_invoice_date', from)
      .lte('last_invoice_date', to)
      .order('total_paid', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      setCustomerData(data);
    }
  };

  const fetchOutstandingData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    let query = supabase
      .from('outstanding_invoices_view')
      .select('*')
      .gte('issue_date', from)
      .lte('issue_date', to);

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      setOutstandingData(data);
    }
  };

  const fetchDocumentData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    let query = supabase
      .from('document_totals_view')
      .select('*')
      .eq('document_type', 'invoice')
      .gte('issue_date', from)
      .lte('issue_date', to)
      .order('issue_date', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      const documentIds = data.map(d => d.document_id);
      
      let customFieldsMap: Record<string, { project?: string; location?: string }> = {};
      let paymentsMap: Record<string, number> = {};

      if (documentIds.length > 0) {
        // Fetch client custom fields
        const { data: customFields } = await supabase
          .from('client_custom_fields')
          .select('document_id, field_label, field_value')
          .in('document_id', documentIds);

        if (customFields) {
          customFields.forEach(field => {
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

        // Fetch payments
        const { data: payments } = await supabase
          .from('payments')
          .select('document_id, amount')
          .in('document_id', documentIds)
          .is('deleted_at', null);

        if (payments) {
          payments.forEach(payment => {
            const docId = payment.document_id;
            paymentsMap[docId] = (paymentsMap[docId] || 0) + Number(payment.amount);
          });
        }
      }

      // Enrich documentData
      const enrichedData = data.map(doc => {
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
          balance: balance
        };
      });

      setDocumentData(enrichedData);
    }
  };

  const exportInvoicesToCSV = (data: DocumentTotal[]) => {
    if (data.length === 0) return;

    const headers = [
      'Invoice date',
      'Company/client',
      'Project/Events',
      'Location',
      'Invoice number2',
      'Tax rate(VAT)',
      'Total Amount',
      'Paid',
      'Balance',
      'Status'
    ];

    const formatCSVValue = (val: any) => {
      if (val === null || val === undefined) return '';
      const stringValue = String(val);
      return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
    };

    const rows = data.map(item => {
      const taxRate = `${(item.tax_percent || 0).toFixed(2)}%`;
      return [
        formatCSVValue(formatDate(item.issue_date)),
        formatCSVValue(item.customer_name),
        formatCSVValue(item.project_events),
        formatCSVValue(item.location),
        formatCSVValue(item.document_number),
        formatCSVValue(taxRate),
        formatCSVValue(item.total_amount),
        formatCSVValue(item.paid),
        formatCSVValue(item.balance),
        formatCSVValue(mapStatus(item.status))
      ].join(',');
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
      rows.push([
        formatCSVValue(`Total (${currency})`),
        '',
        '',
        '',
        '',
        '',
        formatCSVValue(sum.total),
        formatCSVValue(sum.paid),
        formatCSVValue(sum.balance),
        ''
      ].join(','));
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

  const fetchProfitLossData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const fromYear = fromDate.getFullYear();
    const fromMonth = fromDate.getMonth() + 1;
    const toYear = toDate.getFullYear();
    const toMonth = toDate.getMonth() + 1;

    let query = supabase
      .from('profit_and_loss_by_period_view')
      .select('*')
      .or(`year.gt.${fromYear},and(year.eq.${fromYear},month.gte.${fromMonth})`)
      .or(`year.lt.${toYear},and(year.eq.${toYear},month.lte.${toMonth})`)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      setProfitLossData(data);
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

  const totals = calculateTotals();

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

  if (loading) {
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
            <Button onClick={() => fetchAllReportData(dateFrom, dateTo, selectedCurrency)} variant="secondary">
              <RefreshCw className="w-4 h-4" />
              Refresh
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
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
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
            <Button onClick={() => fetchAllReportData(dateFrom, dateTo, selectedCurrency)} size="sm">
              Apply Filters
            </Button>
          </div>
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
                {Object.entries(totals.revenueByCurrency).map(([currency, amounts]) => (
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
                {Object.entries(totals.outstandingByCurrency).map(([currency, amount]) => (
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
                {Object.entries(totals.revenueByCurrency).map(([currency, amounts]) => {
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company/client</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project/Events</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice number2</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax rate(VAT)</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {documentData.map((item) => (
                        <tr key={item.document_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {formatDate(item.issue_date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.customer_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.project_events || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.location || '—'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => navigate(p(`/documents/${item.document_id}`))}
                              className="font-medium text-slate-600 hover:text-blue-800"
                            >
                              {item.document_number}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {(item.tax_percent || 0).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.total_amount, item.currency)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-emerald-600 whitespace-nowrap">
                            {formatCurrency(item.paid || 0, item.currency)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-amber-600 whitespace-nowrap">
                            {formatCurrency(item.balance || 0, item.currency)}
                          </td>
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
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                      {Object.entries(invoiceTotalsByCurrency).map(([currency, sum]) => (
                        <tr key={currency}>
                          <td colSpan={6} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Total ({currency})
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-900 font-bold whitespace-nowrap">
                            {formatCurrency(sum.total, currency)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-emerald-600 font-bold whitespace-nowrap">
                            {formatCurrency(sum.paid, currency)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-amber-600 font-bold whitespace-nowrap">
                            {formatCurrency(sum.balance, currency)}
                          </td>
                          <td></td>
                        </tr>
                      ))}
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
        </div>
      </div>
    </div>
  );
}
