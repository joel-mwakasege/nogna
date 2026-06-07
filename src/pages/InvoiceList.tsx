import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { Button } from '../components/Button';
import { DeleteModal } from '../components/DeleteModal';
import { Pagination } from '../components/Pagination';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { formatCurrency as formatCurrencyUtil } from '../lib/currency-utils';
import { Trash2, FileDown } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useAuth } from '../contexts/AuthContext';

type Document = Database['public']['Tables']['documents']['Row'];

interface InvoiceWithCustomer extends Document {
  customer_name: string;
  customer_email: string;
  total_amount: number;
}

export function InvoiceList() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { companyId } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; invoice: InvoiceWithCustomer | null; isDeleting: boolean }>({
    isOpen: false,
    invoice: null,
    isDeleting: false,
  });
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ isOpen: boolean; isDeleting: boolean }>({
    isOpen: false,
    isDeleting: false,
  });
  const [currencyDecimalPlaces, setCurrencyDecimalPlaces] = useState<Record<string, number>>({});

  useEffect(() => {
    loadCurrencies();
  }, []);

  useEffect(() => {
    if (companyId) loadInvoices();
  }, [currentPage, companyId]);

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

  const loadInvoices = async () => {
    if (!companyId) return;
    try {
      const { count } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null);

      setTotalCount(count || 0);

      const { data: docs, error } = await supabase
        .from('documents')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;

      const invoicesWithData = await Promise.all(
        (docs || []).map(async (doc) => {
          let customerName = 'No Customer';
          let customerEmail = '';

          if (doc.customer_id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('name, email')
              .eq('id', doc.customer_id)
              .single();

            if (customer) {
              customerName = customer.name;
              customerEmail = customer.email;
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
            customer_email: customerEmail,
            total_amount: totalAmount,
          };
        })
      );

      setInvoices(invoicesWithData);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (invoice: InvoiceWithCustomer, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, invoice, isDeleting: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.invoice) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteModal.invoice.id);

      if (error) throw error;

      setInvoices(invoices.filter((i) => i.id !== deleteModal.invoice.id));
      setDeleteModal({ isOpen: false, invoice: null, isDeleting: false });
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
      alert('Failed to delete invoice. Please try again.');
    }
  };

  const handleSelectAll = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map(inv => inv.id)));
    }
  };

  const handleSelectInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const handleBulkDeleteClick = () => {
    setBulkDeleteModal({ isOpen: true, isDeleting: false });
  };

  const handleConfirmBulkDelete = async () => {
    setBulkDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', Array.from(selectedInvoices));

      if (error) throw error;

      setSelectedInvoices(new Set());
      setBulkDeleteModal({ isOpen: false, isDeleting: false });
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoices:', error);
      setBulkDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedInvoices(new Set());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const exportInvoicePDF = async (invoice: InvoiceWithCustomer, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(p(`/documents/${invoice.id}`));
    setTimeout(() => {
      const element = window.document.getElementById('pdf-content');
      if (element) {
        const opt = {
          margin: 10,
          filename: `${invoice.document_number}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
        };
        html2pdf().set(opt).from(element).save();
      }
    }, 500);
  };

  const formatCurrency = (amount: number, currency: string) => {
    const decimalPlaces = currencyDecimalPlaces[currency] ?? 2;
    return formatCurrencyUtil(amount, currency, decimalPlaces);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="px-4 sm:px-6 py-6 sm:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between mb-6 sm:mb-12 gap-4">
          <div>
            <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider mb-2 sm:mb-4">BILLING MANAGEMENT</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-7xl font-bold leading-tight">INVOICES</h1>
          </div>
          <Button onClick={() => navigate(p('/documents/new'))} size="lg" className="w-full sm:w-auto">
            + CREATE INVOICE
          </Button>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 sm:p-12 text-center">
            <p className="text-gray-500 text-sm sm:text-base mb-4">No invoices yet</p>
            <Button onClick={() => navigate(p('/documents/new'))} className="w-full sm:w-auto">Create Your First Invoice</Button>
          </div>
        ) : (
          <>
            {selectedInvoices.size > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-red-900">
                  {selectedInvoices.size} invoice{selectedInvoices.size > 1 ? 's' : ''} selected
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
            <div className="hidden sm:block bg-white border-2 border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 lg:px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wide w-12">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-slate-700 border-gray-300 rounded focus:ring-slate-500"
                        />
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Invoice ID
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Customer
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">
                        Created At
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr
                        key={invoice.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 lg:px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedInvoices.has(invoice.id)}
                            onChange={() => handleSelectInvoice(invoice.id)}
                            className="w-4 h-4 text-slate-700 border-gray-300 rounded focus:ring-slate-500"
                          />
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm font-bold cursor-pointer" onClick={() => navigate(p(`/documents/${invoice.id}`))}>
                          {invoice.document_number}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm" onClick={() => navigate(p(`/documents/${invoice.id}`))}>
                          <p className="font-medium text-gray-900">{invoice.customer_name}</p>
                          <p className="text-xs text-gray-500">{invoice.customer_email}</p>
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm font-bold" onClick={() => navigate(p(`/documents/${invoice.id}`))}>
                          {formatCurrency(invoice.total_amount, invoice.currency)}
                        </td>
                        <td className="px-4 lg:px-6 py-4" onClick={() => navigate(p(`/documents/${invoice.id}`))}>
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 hidden md:table-cell" onClick={() => navigate(p(`/documents/${invoice.id}`))}>
                          {new Date(invoice.created_at).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm">
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => exportInvoicePDF(invoice, e)}
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                              title="Export to PDF"
                            >
                              <FileDown className="w-4 h-4" />
                              <span className="hidden lg:inline">Export</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(invoice, e);
                              }}
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden lg:inline">Delete</span>
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

            <div className="sm:hidden space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => navigate(p(`/documents/${invoice.id}`))}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 cursor-pointer hover:border-black transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-lg mb-1">{invoice.document_number}</p>
                      <p className="text-sm font-medium text-gray-900">{invoice.customer_name}</p>
                      <p className="text-xs text-gray-500">{invoice.customer_email}</p>
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 mb-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Amount</p>
                      <p className="font-bold text-xl">
                        {formatCurrency(invoice.total_amount, invoice.currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Created</p>
                      <p className="text-xs text-gray-600">
                        {new Date(invoice.created_at).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={(e) => exportInvoicePDF(invoice, e)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-sm"
                    >
                      <FileDown className="w-4 h-4" />
                      Export
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(invoice, e);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm"
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
          </>
        )}

        <DeleteModal
          isOpen={deleteModal.isOpen}
          title="Delete Invoice"
          message="Are you sure you want to delete"
          itemName={deleteModal.invoice?.document_number || ''}
          isLoading={deleteModal.isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal({ isOpen: false, invoice: null, isDeleting: false })}
        />

        <DeleteModal
          isOpen={bulkDeleteModal.isOpen}
          title="Delete Multiple Invoices"
          message={`Are you sure you want to delete ${selectedInvoices.size} invoice${selectedInvoices.size > 1 ? 's' : ''}?`}
          itemName="This action cannot be undone."
          isLoading={bulkDeleteModal.isDeleting}
          onConfirm={handleConfirmBulkDelete}
          onCancel={() => setBulkDeleteModal({ isOpen: false, isDeleting: false })}
        />
      </div>

      <footer className="border-t border-gray-200 px-4 sm:px-6 py-4 mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>© 2025 KAVS GROUP — INTERNAL SYSTEM</p>
          <div className="flex gap-4 sm:gap-6">
            <button className="hover:text-black">SECURITY</button>
            <span className="hidden sm:inline">•</span>
            <button className="hover:text-black">SUPPORT</button>
            <span className="hidden sm:inline">•</span>
            <button className="hover:text-black">SYSTEM STATUS</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
