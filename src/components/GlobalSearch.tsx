import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, X, FileText, Users, Receipt, ArrowDownCircle, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DocumentResult {
  id: string;
  document_number: string;
  document_type: 'invoice' | 'quote';
  status: string;
  customer_name: string | null;
}

interface CustomerResult {
  id: string;
  name: string;
  email: string;
}

interface ExpenseResult {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category_name: string | null;
  currency_code: string;
}

interface DepositResult {
  id: string;
  description: string;
  amount: number;
  deposit_date: string;
  category_name: string | null;
  currency_code: string;
}

interface PaymentResult {
  id: string;
  reference_number: string | null;
  amount: number;
  payment_date: string;
  document_id: string;
  currency: string;
}

interface SearchResults {
  documents: DocumentResult[];
  customers: CustomerResult[];
  expenses: ExpenseResult[];
  deposits: DepositResult[];
  payments: PaymentResult[];
}

const EMPTY_RESULTS: SearchResults = {
  documents: [],
  customers: [],
  expenses: [],
  deposits: [],
  payments: [],
};

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  unpaid: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-600',
  partially_paid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-orange-100 text-orange-700',
};

function formatAmount(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function totalResultCount(results: SearchResults) {
  return (
    results.documents.length +
    results.customers.length +
    results.expenses.length +
    results.deposits.length +
    results.payments.length
  );
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function mapExpenseRow(d: any): ExpenseResult {
  return {
    id: d.id,
    description: d.description,
    amount: d.amount,
    expense_date: d.expense_date,
    category_name: d.expense_categories?.name ?? null,
    currency_code: d.currencies?.code ?? 'USD',
  };
}

function mapDepositRow(d: any): DepositResult {
  return {
    id: d.id,
    description: d.description,
    amount: d.amount,
    deposit_date: d.deposit_date,
    category_name: d.payment_categories?.name ?? null,
    currency_code: d.currencies?.code ?? 'USD',
  };
}

export function GlobalSearch() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults(EMPTY_RESULTS);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const term = `%${searchQuery}%`;

    try {
      // Resolve expense category IDs matching the query
      const expenseCategoryIdsPromise = supabase
        .from('expense_categories')
        .select('id')
        .ilike('name', term)
        .then(({ data }) => (data || []).map((r: any) => r.id as string));

      // Resolve payment (deposit) category IDs matching the query
      const paymentCategoryIdsPromise = supabase
        .from('payment_categories')
        .select('id')
        .ilike('name', term)
        .then(({ data }) => (data || []).map((r: any) => r.id as string));

      const [expenseCatIds, depositCatIds] = await Promise.all([
        expenseCategoryIdsPromise,
        paymentCategoryIdsPromise,
      ]);

      const expenseSelect = 'id, description, amount, expense_date, expense_categories(name), currencies(code, symbol)';
      const depositSelect = 'id, description, amount, deposit_date, payment_categories(name), currencies(code, symbol)';

      // Run all searches in parallel
      const [
        documentsRes,
        customersRes,
        expensesByDescRes,
        expensesByCatRes,
        depositsByDescRes,
        depositsByCatRes,
        paymentsRes,
      ] = await Promise.all([
        supabase
          .from('documents')
          .select('id, document_number, document_type, status, customers(name)')
          .ilike('document_number', term)
          .is('deleted_at', null)
          .limit(5),

        supabase
          .from('customers')
          .select('id, name, email')
          .or(`name.ilike.${term},email.ilike.${term}`)
          .is('deleted_at', null)
          .limit(5),

        supabase
          .from('expenses')
          .select(expenseSelect)
          .ilike('description', term)
          .is('deleted_at', null)
          .limit(5),

        expenseCatIds.length > 0
          ? supabase
              .from('expenses')
              .select(expenseSelect)
              .in('expense_category_id', expenseCatIds)
              .is('deleted_at', null)
              .limit(5)
          : Promise.resolve({ data: [] }),

        supabase
          .from('deposits')
          .select(depositSelect)
          .ilike('description', term)
          .is('deleted_at', null)
          .limit(5),

        depositCatIds.length > 0
          ? supabase
              .from('deposits')
              .select(depositSelect)
              .in('payment_category_id', depositCatIds)
              .is('deleted_at', null)
              .limit(5)
          : Promise.resolve({ data: [] }),

        supabase
          .from('payments')
          .select('id, reference_number, amount, payment_date, document_id, currency')
          .ilike('reference_number', term)
          .is('deleted_at', null)
          .limit(5),
      ]);

      // Also search documents by customer name
      const customerNameDocsRes = await supabase
        .from('documents')
        .select('id, document_number, document_type, status, customers(name)')
        .is('deleted_at', null)
        .limit(50);

      const docResults: DocumentResult[] = (documentsRes.data || []).map((d: any) => ({
        id: d.id,
        document_number: d.document_number,
        document_type: d.document_type,
        status: d.status,
        customer_name: d.customers?.name ?? null,
      }));

      const customerNameMatches: DocumentResult[] = ((customerNameDocsRes.data || []) as any[])
        .filter(
          (d: any) =>
            d.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !docResults.find((r) => r.id === d.id)
        )
        .slice(0, 5 - docResults.length)
        .map((d: any) => ({
          id: d.id,
          document_number: d.document_number,
          document_type: d.document_type,
          status: d.status,
          customer_name: d.customers?.name ?? null,
        }));

      const allExpenses = dedupeById([
        ...(expensesByDescRes.data || []).map(mapExpenseRow),
        ...(expensesByCatRes.data || []).map(mapExpenseRow),
      ]).slice(0, 5);

      const allDeposits = dedupeById([
        ...(depositsByDescRes.data || []).map(mapDepositRow),
        ...(depositsByCatRes.data || []).map(mapDepositRow),
      ]).slice(0, 5);

      setResults({
        documents: [...docResults, ...customerNameMatches].slice(0, 5),
        customers: (customersRes.data || []) as CustomerResult[],
        expenses: allExpenses,
        deposits: allDeposits,
        payments: (paymentsRes.data || []) as PaymentResult[],
      });
    } catch (err) {
      console.error('Search error:', err);
      setResults(EMPTY_RESULTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) {
      setResults(EMPTY_RESULTS);
      setIsOpen(query.length > 0);
      return;
    }
    setIsLoading(true);
    setIsOpen(true);
    debounceRef.current = setTimeout(() => performSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, performSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (mobileOpen) {
          mobileInputRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setMobileOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  const openResult = (url: string) => {
    navigate(`/${slug}${url}`);
    setIsOpen(false);
    setMobileOpen(false);
    setQuery('');
  };

  const handleMobileOpen = () => {
    setMobileOpen(true);
    setTimeout(() => mobileInputRef.current?.focus(), 50);
  };

  const handleMobileClose = () => {
    setMobileOpen(false);
    setQuery('');
    setResults(EMPTY_RESULTS);
    setIsOpen(false);
  };

  const hasResults = totalResultCount(results) > 0;

  const ResultsContent = () => (
    <>
      {results.documents.length > 0 && (
        <section>
          <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents</span>
          </div>
          {results.documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => openResult(`/documents/${doc.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{doc.document_number}</span>
                  <span className="text-xs text-gray-400 capitalize">{doc.document_type}</span>
                </div>
                {doc.customer_name && (
                  <p className="text-xs text-gray-500 truncate">{doc.customer_name}</p>
                )}
              </div>
              {doc.status && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {doc.status.replace('_', ' ')}
                </span>
              )}
            </button>
          ))}
        </section>
      )}

      {results.customers.length > 0 && (
        <section>
          <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customers</span>
          </div>
          {results.customers.map((c) => (
            <button
              key={c.id}
              onClick={() => openResult(`/customers/${c.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 truncate">{c.email}</p>
              </div>
            </button>
          ))}
        </section>
      )}

      {results.expenses.length > 0 && (
        <section>
          <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
            <Receipt className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expenses</span>
          </div>
          {results.expenses.map((e) => (
            <button
              key={e.id}
              onClick={() => openResult(`/expenses/edit/${e.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{e.description}</p>
                <p className="text-xs text-gray-500">
                  {e.category_name ? `${e.category_name} · ` : ''}{formatDate(e.expense_date)}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-700 flex-shrink-0">{formatAmount(e.amount, e.currency_code)}</span>
            </button>
          ))}
        </section>
      )}

      {results.deposits.length > 0 && (
        <section>
          <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
            <ArrowDownCircle className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Deposits</span>
          </div>
          {results.deposits.map((d) => (
            <button
              key={d.id}
              onClick={() => openResult(`/deposits/edit/${d.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                <ArrowDownCircle className="w-4 h-4 text-teal-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{d.description}</p>
                <p className="text-xs text-gray-500">
                  {d.category_name ? `${d.category_name} · ` : ''}{formatDate(d.deposit_date)}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-700 flex-shrink-0">{formatAmount(d.amount, d.currency_code)}</span>
            </button>
          ))}
        </section>
      )}

      {results.payments.length > 0 && (
        <section>
          <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Payments</span>
          </div>
          {results.payments.map((p) => (
            <button
              key={p.id}
              onClick={() => openResult(`/documents/${p.document_id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{p.reference_number || 'Payment'}</p>
                <p className="text-xs text-gray-500">{formatDate(p.payment_date)}</p>
              </div>
              <span className="text-sm font-medium text-gray-700 flex-shrink-0">{formatAmount(p.amount, p.currency)}</span>
            </button>
          ))}
        </section>
      )}
    </>
  );

  const dropdown = isOpen && query.length >= 3 && (
    <div className="absolute top-full mt-2 left-0 w-full min-w-[340px] bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Searching...
        </div>
      ) : !hasResults ? (
        <div className="py-8 text-center text-sm text-gray-400">
          No results found for <span className="font-medium text-gray-600">"{query}"</span>
        </div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-50">
          <ResultsContent />
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              {totalResultCount(results)} result{totalResultCount(results) !== 1 ? 's' : ''}&nbsp;·&nbsp;Press <kbd className="px-1 py-0.5 bg-white border border-gray-200 rounded text-gray-500 font-mono">Esc</kbd> to close
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop search */}
      <div className="relative hidden md:block" ref={wrapperRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 3 && setIsOpen(true)}
          placeholder="Search records… ⌘K"
          className="w-64 pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white text-gray-800 placeholder-gray-400 transition-all focus:w-80"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults(EMPTY_RESULTS); setIsOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {dropdown}
      </div>

      {/* Mobile search icon */}
      <button
        onClick={handleMobileOpen}
        className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Open search"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Mobile search overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden" onClick={handleMobileClose}>
          <div
            className="bg-white w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search records..."
                className="flex-1 text-sm outline-none text-gray-800 placeholder-gray-400"
              />
              {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}
              <button onClick={handleMobileClose} className="text-gray-400 hover:text-gray-600 transition-colors ml-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {query.length >= 3 && (
              <div className="max-h-[70vh] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </div>
                ) : !hasResults ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    No results found for <span className="font-medium text-gray-600">"{query}"</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    <ResultsContent />
                  </div>
                )}
              </div>
            )}

            {query.length > 0 && query.length < 3 && (
              <p className="text-center text-xs text-gray-400 py-6">Type at least 3 characters to search</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
