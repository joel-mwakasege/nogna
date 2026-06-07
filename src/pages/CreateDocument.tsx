import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';

type Customer = Database['public']['Tables']['customers']['Row'];

interface CompanySettings {
  id: string;
  document_numbering_mode: 'auto' | 'manual';
  document_number_prefix: string;
  document_number_counter: number;
  default_terms: string | null;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  display_order: number;
}

export function CreateDocument() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { userProfile } = useAuth();
  const [documentType, setDocumentType] = useState<'invoice' | 'quote'>('invoice');
  const [documentNumber, setDocumentNumber] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState<string>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ documentNumber?: string; customerId?: string }>({});
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    loadCustomers();
    loadCompanySettings();
    loadCurrencies();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('id, document_numbering_mode, document_number_prefix, document_number_counter, default_terms')
        .maybeSingle();

      if (error) throw error;
      setCompanySettings(data);
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const loadCurrencies = async () => {
    try {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCurrencies(data || []);

      // Set the first currency as default if available
      if (data && data.length > 0 && !currency) {
        setCurrency(data[0].code);
      }
    } catch (error) {
      console.error('Error loading currencies:', error);
    }
  };

  const validateForm = () => {
    const newErrors: { documentNumber?: string; customerId?: string } = {};

    if (companySettings?.document_numbering_mode === 'manual' && !documentNumber.trim()) {
      newErrors.documentNumber = 'Document number is required';
    }

    if (!customerId) {
      newErrors.customerId = 'Please select a customer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      let finalDocumentNumber = documentNumber.trim();

      if (companySettings?.document_numbering_mode === 'auto') {
        finalDocumentNumber = `${companySettings.document_number_prefix}${companySettings.document_number_counter}`;
      }

      const { data: document, error } = await supabase
        .from('documents')
        .insert({
          document_number: finalDocumentNumber,
          document_type: documentType,
          customer_id: customerId,
          currency,
          issue_date: issueDate,
          status: 'draft',
          company_id: userProfile?.company_id || null,
          administrative_notes: companySettings?.default_terms || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (companySettings?.document_numbering_mode === 'auto' && companySettings.id) {
        await supabase
          .from('company_settings')
          .update({ document_number_counter: companySettings.document_number_counter + 1 })
          .eq('id', companySettings.id);
      }

      navigate(p(`/documents/${document.id}`));
    } catch (error) {
      console.error('Error creating document:', error);
      setErrors({ documentNumber: 'Failed to create document. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="mb-8 sm:mb-12">
          <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">NEW BILLING DOCUMENT</p>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight mb-1 sm:mb-2">CREATE</h1>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight">DOCUMENT</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-2 sm:mb-3">
                  Document Type
                </label>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setDocumentType('invoice')}
                    className={`w-full py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg border-2 font-medium text-sm sm:text-base transition-colors ${
                      documentType === 'invoice'
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentType('quote')}
                    className={`w-full py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg border-2 font-medium text-sm sm:text-base transition-colors ${
                      documentType === 'quote'
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Quote
                  </button>
                </div>
              </div>

              {companySettings?.document_numbering_mode === 'manual' && (
                <div>
                  <label htmlFor="documentNumber" className="block text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
                    Document Number
                  </label>
                  <input
                    type="text"
                    id="documentNumber"
                    value={documentNumber}
                    onChange={(e) => {
                      setDocumentNumber(e.target.value);
                      if (errors.documentNumber) setErrors({ ...errors, documentNumber: undefined });
                    }}
                    placeholder="INV-2025-001"
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border ${
                      errors.documentNumber ? 'border-red-500' : 'border-gray-300'
                    } rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent`}
                  />
                  {errors.documentNumber && <p className="mt-2 text-xs sm:text-sm text-red-600">{errors.documentNumber}</p>}
                </div>
              )}

              {companySettings?.document_numbering_mode === 'auto' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
                    Document Number
                  </p>
                  <p className="text-base sm:text-lg font-semibold text-slate-900">
                    {companySettings.document_number_prefix}{companySettings.document_number_counter}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Auto-generated</p>
                </div>
              )}

              <div>
                <label htmlFor="customerId" className="block text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
                  Client Name
                </label>
                <select
                  id="customerId"
                  value={customerId}
                  onChange={(e) => {
                    if (e.target.value === 'new') {
                      navigate(p('/customers/new'), { state: { returnTo: p('/documents/new') } });
                    } else {
                      setCustomerId(e.target.value);
                      if (errors.customerId) setErrors({ ...errors, customerId: undefined });
                    }
                  }}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border ${
                    errors.customerId ? 'border-red-500' : 'border-gray-300'
                  } rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent`}
                >
                  <option value="">Enter company or individual name</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                  <option value="new">+ Add New Customer</option>
                </select>
                {errors.customerId && <p className="mt-2 text-xs sm:text-sm text-red-600">{errors.customerId}</p>}
              </div>

              <div>
                <label htmlFor="currency" className="block text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
                  Currency
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  {currencies.length === 0 ? (
                    <option value="">No currencies available</option>
                  ) : (
                    currencies.map((curr) => (
                      <option key={curr.id} value={curr.code}>
                        {curr.code} ({curr.symbol}) - {curr.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="issueDate" className="block text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
                  Issue Date
                </label>
                <input
                  type="date"
                  id="issueDate"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              <div className="pt-2 sm:pt-4">
                <Button type="submit" size="lg" isLoading={isLoading}>
                  CREATE DOCUMENT
                </Button>
              </div>
            </form>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="bg-gray-50 rounded-xl p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-600 italic leading-relaxed">
                "Accuracy in billing is the heartbeat of professional trust. Ensure all fields are verified before
                generating the final production output."
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate(p('/customers/new'), { state: { returnTo: p('/documents/new') } })}
                className="w-full flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-black hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-400">+</span>
                <span className="text-xs sm:text-sm font-medium">ADD ANOTHER CLIENT</span>
              </button>

              <button
                onClick={() => navigate(p('/documents?filter=draft'))}
                className="w-full flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-black hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-400">↻</span>
                <span className="text-xs sm:text-sm font-medium">VIEW DRAFT HISTORY</span>
              </button>

              <button
                onClick={() => navigate(p('/settings'))}
                className="w-full flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 hover:border-black hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-400">⚙</span>
                <span className="text-xs sm:text-sm font-medium">BILLING PREFERENCES</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-xs text-gray-500">
          <p className="text-center sm:text-left">© 2025 KAVS GROUP — INTERNAL SYSTEM</p>
          <div className="flex gap-4 sm:gap-6">
            <button className="hover:text-black">SECURITY</button>
            <button className="hover:text-black">SUPPORT</button>
            <button className="hover:text-black">SYSTEM STATUS</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
