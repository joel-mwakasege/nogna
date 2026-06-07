import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { Button } from '../components/Button';
import { DeleteModal } from '../components/DeleteModal';
import { Pagination } from '../components/Pagination';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { formatCurrency as formatCurrencyUtil } from '../lib/currency-utils';
import { Trash2, FileDown, Filter } from 'lucide-react';
import html2pdf from 'html2pdf.js';

type Document = Database['public']['Tables']['documents']['Row'];

interface DocumentWithCustomer extends Document {
  customer_name: string;
  total_amount: number;
}

type FilterStatus = 'all' | 'unpaid' | 'partially_paid' | 'paid' | 'draft';

import { useAuth } from '../contexts/AuthContext';

export function DocumentList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { companyId } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'recent' | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; document: DocumentWithCustomer | null; isDeleting: boolean }>({
    isOpen: false,
    document: null,
    isDeleting: false,
  });
  const [currencyDecimalPlaces, setCurrencyDecimalPlaces] = useState<Record<string, number>>({});

  useEffect(() => {
    loadCurrencies();
  }, []);

  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    if (urlFilter === 'draft') {
      setFilterStatus('draft');
      setFilter('all');
    }
  }, [searchParams]);

  useEffect(() => {
    if (companyId) loadDocuments();
  }, [filter, filterStatus, currentPage, companyId]);

  const loadCurrencies = async () => {
    try {
      const { data: currencies } = await supabase
        .from('currencies')
        .select('code, decimal_places');

      if (currencies) {
        const decimalPlacesMap: Record<string, number> = {};
        currencies.forEach(curr => {
          decimalPlacesMap[curr.code] = curr.decimal_places ?? 2;
        });
        setCurrencyDecimalPlaces(decimalPlacesMap);
      }
    } catch (error) {
      console.error('Error loading currencies:', error);
    }
  };

  const loadDocuments = async () => {
    if (!companyId) return;
    try {
      let countQuery = supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null);

      if (filter === 'recent') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        countQuery = countQuery.gte('created_at', thirtyDaysAgo.toISOString());
      }

      if (filterStatus === 'draft') {
        countQuery = countQuery.eq('status', 'draft');
      } else if (filterStatus === 'unpaid') {
        countQuery = countQuery.in('status', ['unpaid', 'overdue']);
      } else if (filterStatus === 'partially_paid') {
        countQuery = countQuery.eq('status', 'partially_paid');
      } else if (filterStatus === 'paid') {
        countQuery = countQuery.eq('status', 'paid');
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      let query = supabase
        .from('documents')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (filter === 'recent') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      }

      if (filterStatus === 'draft') {
        query = query.eq('status', 'draft');
      } else if (filterStatus === 'unpaid') {
        query = query.in('status', ['unpaid', 'overdue']);
      } else if (filterStatus === 'partially_paid') {
        query = query.eq('status', 'partially_paid');
      } else if (filterStatus === 'paid') {
        query = query.eq('status', 'paid');
      }

      const { data: docs, error } = await query;

      if (error) throw error;

      const docsWithCustomersAndAmounts = await Promise.all(
        (docs || []).map(async (doc) => {
          let customerName = 'No Customer';

          if (doc.customer_id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('name')
              .eq('id', doc.customer_id)
              .single();

            if (customer) {
              customerName = customer.name;
            }
          }

          const { data: sections } = await supabase
            .from('document_sections')
            .select('id, units_multiplier')
            .eq('document_id', doc.id);

          let totalAmount = 0;
          if (sections) {
            for (const section of sections) {
              const { data: items } = await supabase
                .from('document_line_items')
                .select('units, days, unit_cost, group_id, is_group_parent')
                .eq('section_id', section.id);

              if (items) {
                const processedGroups = new Set<string>();
                let sectionSubtotal = 0;

                for (const item of items) {
                  if (item.group_id) {
                    if (processedGroups.has(item.group_id)) {
                      continue;
                    }
                    processedGroups.add(item.group_id);

                    const parentItem = items.find(
                      (i) => i.group_id === item.group_id && i.is_group_parent
                    );

                    if (parentItem) {
                      sectionSubtotal += parentItem.days * parentItem.unit_cost;
                    }
                  } else {
                    sectionSubtotal += item.units * item.days * item.unit_cost;
                  }
                }

                const multiplier = section.units_multiplier || 1;
                totalAmount += sectionSubtotal * multiplier;
              }
            }
          }

          const discount = totalAmount * (doc.discount_percent / 100);
          const afterDiscount = totalAmount - discount;
          const tax = afterDiscount * (doc.tax_percent / 100);
          totalAmount = afterDiscount + tax;

          return {
            ...doc,
            customer_name: customerName,
            total_amount: totalAmount,
          };
        })
      );

      setDocuments(docsWithCustomersAndAmounts);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (document: DocumentWithCustomer, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, document, isDeleting: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.document) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteModal.document.id);

      if (error) throw error;

      setDocuments(documents.filter((d) => d.id !== deleteModal.document.id));
      setDeleteModal({ isOpen: false, document: null, isDeleting: false });
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const exportDocumentPDF = async (doc: DocumentWithCustomer, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(p(`/documents/${doc.id}`));
    setTimeout(() => {
      const element = window.document.getElementById('pdf-content');
      if (element) {
        const opt = {
          margin: 10,
          filename: `${doc.document_number}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
        };
        html2pdf().set(opt).from(element).save();
      }
    }, 500);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const decimalPlaces = currencyDecimalPlaces[currency] ?? 2;
    return formatCurrencyUtil(amount, currency, decimalPlaces);
  };

  const calculateTotalRevenue = () => {
    const byCurrency: Record<string, number> = {};
    documents.forEach((doc) => {
      if (!byCurrency[doc.currency]) {
        byCurrency[doc.currency] = 0;
      }
      byCurrency[doc.currency] += doc.total_amount;
    });
    return byCurrency;
  };

  const calculateOutstanding = () => {
    const byCurrency: Record<string, number> = {};
    documents
      .filter((doc) => ['draft', 'unpaid', 'partially_paid', 'overdue'].includes(doc.status))
      .forEach((doc) => {
        if (!byCurrency[doc.currency]) {
          byCurrency[doc.currency] = 0;
        }
        byCurrency[doc.currency] += doc.total_amount;
      });
    return byCurrency;
  };

  const handleFilterStatusChange = (newStatus: FilterStatus) => {
    setFilterStatus(newStatus);
    setCurrentPage(1);
    setShowFilterDropdown(false);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="px-4 sm:px-6 py-6 sm:py-12">
        <div className="mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row items-start justify-between mb-6 sm:mb-8 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">ADMINISTRATION</p>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-2 sm:mb-4">Billing</h1>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight">Documents</h1>
            </div>
            <div className="sm:text-right space-y-3 sm:space-y-4 w-full sm:w-auto">
              <p className="text-xs sm:text-sm text-gray-600 sm:max-w-xs">
                Manage and track your financial transactions with high precision.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setFilter('all'); setCurrentPage(1); }}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wide rounded-lg transition-colors ${
                    filter === 'all'
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => { setFilter('recent'); setCurrentPage(1); }}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs font-medium uppercase tracking-wide rounded-lg transition-colors ${
                    filter === 'recent'
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Recent
                </button>
              </div>
            </div>
          </div>

          <Button onClick={() => navigate(p('/documents/new'))} size="lg" className="w-full sm:w-auto">
            Create Document
          </Button>
        </div>

        {documents.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center">
            <p className="text-gray-500 mb-4">No documents found</p>
            <Button onClick={() => navigate(p('/documents/new'))}>Create Your First Document</Button>
          </div>
        ) : (
          <>
            <div className="hidden sm:block bg-white border-2 border-black rounded-xl overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-black bg-gray-50">
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                        Document #
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                        Client Name
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold uppercase tracking-wider hidden lg:table-cell">
                        Currency
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold uppercase tracking-wider hidden md:table-cell">
                        Issue Date
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc, index) => (
                      <tr
                        key={doc.id}
                        className={`transition-colors ${
                          index === 0 ? 'bg-black text-white hover:bg-gray-800' : 'hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        <td className="px-4 lg:px-6 py-4 font-bold text-sm" onClick={() => navigate(p(`/documents/${doc.id}`))}>{doc.document_number}</td>
                        <td className="px-4 lg:px-6 py-4 text-xs uppercase" onClick={() => navigate(p(`/documents/${doc.id}`))}>{doc.document_type}</td>
                        <td className="px-4 lg:px-6 py-4 font-medium text-sm" onClick={() => navigate(p(`/documents/${doc.id}`))}>{doc.customer_name}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm hidden lg:table-cell" onClick={() => navigate(p(`/documents/${doc.id}`))}>{doc.currency}</td>
                        <td className="px-4 lg:px-6 py-4" onClick={() => navigate(p(`/documents/${doc.id}`))}>
                          {index === 0 && <span className="text-white">●</span>}
                          {index !== 0 && <StatusBadge status={doc.status} />}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-xs hidden md:table-cell" onClick={() => navigate(p(`/documents/${doc.id}`))}>
                          {new Date(doc.issue_date).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm">
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => exportDocumentPDF(doc, e)}
                              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
                                index === 0
                                  ? 'text-white hover:bg-gray-700'
                                  : 'text-blue-600 hover:bg-blue-50'
                              }`}
                              title="Export to PDF"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(doc, e);
                              }}
                              className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors ${
                                index === 0
                                  ? 'text-white hover:bg-gray-700'
                                  : 'text-red-600 hover:bg-red-50'
                              }`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                totalItems={totalCount}
                itemsPerPage={itemsPerPage}
              />
            </div>

            <div className="sm:hidden space-y-4 mb-8">
              {documents.map((doc, index) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(p(`/documents/${doc.id}`))}
                  className={`rounded-xl p-4 cursor-pointer transition-all ${
                    index === 0
                      ? 'bg-black text-white border-2 border-black'
                      : 'bg-white border-2 border-gray-200 hover:border-black'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-lg mb-1">{doc.document_number}</p>
                      <p className={`text-xs uppercase ${index === 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                        {doc.document_type}
                      </p>
                    </div>
                    {index === 0 ? (
                      <span className="text-white">●</span>
                    ) : (
                      <StatusBadge status={doc.status} />
                    )}
                  </div>

                  <div className="mb-3">
                    <p className="font-medium mb-1">{doc.customer_name}</p>
                    <p className={`text-sm ${index === 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                      {new Date(doc.issue_date).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })} • {doc.currency}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={(e) => exportDocumentPDF(doc, e)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        index === 0
                          ? 'bg-gray-800 text-white hover:bg-gray-700'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      <FileDown className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(doc, e);
                      }}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        index === 0
                          ? 'bg-gray-800 text-white hover:bg-gray-700'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                totalItems={totalCount}
                itemsPerPage={itemsPerPage}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mt-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full sm:w-auto">
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-2">Total Revenue</p>
                  <div className="flex flex-col gap-1">
                    {Object.entries(calculateTotalRevenue()).map(([currency, amount]) => (
                      <p key={currency} className="text-xl sm:text-2xl lg:text-3xl font-bold">
                        {formatCurrency(amount, currency)}
                      </p>
                    ))}
                    {Object.keys(calculateTotalRevenue()).length === 0 && (
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-400">$0.00</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-2">Outstanding</p>
                  <div className="flex flex-col gap-1">
                    {Object.entries(calculateOutstanding()).map(([currency, amount]) => (
                      <p key={currency} className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">
                        {formatCurrency(amount, currency)}
                      </p>
                    ))}
                    {Object.keys(calculateOutstanding()).length === 0 && (
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-400">$0.00</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Add Filter View
                  {filterStatus !== 'all' && (
                    <span className="ml-1 px-2 py-0.5 bg-white text-black rounded text-xs">
                      {filterStatus === 'draft' && 'Draft'}
                      {filterStatus === 'unpaid' && 'Unpaid'}
                      {filterStatus === 'partially_paid' && 'Partially Paid'}
                      {filterStatus === 'paid' && 'Paid'}
                    </span>
                  )}
                </button>
                {showFilterDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => handleFilterStatusChange('all')}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        filterStatus === 'all' ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      All Documents
                    </button>
                    <button
                      onClick={() => handleFilterStatusChange('draft')}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        filterStatus === 'draft' ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      Draft
                    </button>
                    <button
                      onClick={() => handleFilterStatusChange('unpaid')}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        filterStatus === 'unpaid' ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      Unpaid
                    </button>
                    <button
                      onClick={() => handleFilterStatusChange('partially_paid')}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        filterStatus === 'partially_paid' ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      Partially Paid
                    </button>
                    <button
                      onClick={() => handleFilterStatusChange('paid')}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        filterStatus === 'paid' ? 'bg-gray-100 font-medium' : ''
                      }`}
                    >
                      Paid
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <DeleteModal
          isOpen={deleteModal.isOpen}
          title="Delete Document"
          message="Are you sure you want to delete"
          itemName={deleteModal.document?.document_number || ''}
          isLoading={deleteModal.isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal({ isOpen: false, document: null, isDeleting: false })}
        />
      </div>

      <footer className="border-t border-gray-200 px-4 sm:px-6 py-4 mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>© 2025 Kavs Group Billing Systems.</p>
          <div className="flex gap-4 sm:gap-6">
            <button className="hover:text-black">Privacy Policy</button>
            <span className="hidden sm:inline">•</span>
            <button className="hover:text-black">System Status</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
