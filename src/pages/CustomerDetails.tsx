import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { CreditCard as Edit, ArrowLeft, Mail, Phone, MapPin, Building, FileText, Receipt, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Customer = Database['public']['Tables']['customers']['Row'];

interface Document {
  document_id: string;
  document_number: string;
  document_type: string;
  issue_date: string;
  total_amount: number;
  status: string;
  currency: string;
}

interface Deposit {
  id: string;
  description: string;
  amount: number;
  deposit_date: string;
  currencies: { code: string; symbol: string };
  accounts: { name: string };
}

export function CustomerDetails() {
  const { id, slug } = useParams<{ id: string; slug: string }>();
  const navigate = useNavigate();
  const p = (path: string) => `/${slug}${path}`;
  const { companyId } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadCustomerData();
    }
  }, [id]);

  const loadCustomerData = async () => {
    try {
      const [customerRes, documentsRes, depositsRes] = await Promise.all([
        supabase.from('customers').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
        supabase
          .from('document_totals_view')
          .select('document_id, document_number, document_type, issue_date, total_amount, status, currency')
          .eq('customer_id', id)
          .order('issue_date', { ascending: false })
          .limit(10),
        supabase
          .from('deposits')
          .select('id, description, amount, deposit_date, currencies(code, symbol), accounts(name)')
          .eq('customer_id', id)
          .is('deleted_at', null)
          .order('deposit_date', { ascending: false })
          .limit(10),
      ]);

      if (customerRes.error) throw customerRes.error;
      if (!customerRes.data) {
        navigate(p('/customers'));
        return;
      }

      setCustomer(customerRes.data);
      setDocuments((documentsRes.data as Document[]) || []);
      setDeposits((depositsRes.data as Deposit[]) || []);
    } catch (error) {
      console.error('Error loading customer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading customer...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Customer not found</p>
          <Button onClick={() => navigate(p('/customers'))}>Back to Customers</Button>
        </div>
      </div>
    );
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <button
            onClick={() => navigate(p('/customers'))}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Customers
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wide mb-2">CUSTOMER DETAILS</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">{customer.name}</h1>
            </div>
            <Button onClick={() => navigate(p(`/customers/edit/${customer.id}`))}>
              <Edit className="w-4 h-4" />
              Edit Customer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="space-y-4">
                {customer.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <a href={`mailto:${customer.email}`} className="text-sm text-blue-600 hover:text-blue-700">
                        {customer.email}
                      </a>
                    </div>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <a href={`tel:${customer.phone}`} className="text-sm text-gray-900">
                        {customer.phone}
                      </a>
                    </div>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="text-sm text-gray-900 whitespace-pre-line">{customer.address}</p>
                    </div>
                  </div>
                )}
                {customer.tax_id && (
                  <div className="flex items-start gap-3">
                    <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Tax ID</p>
                      <p className="text-sm text-gray-900">{customer.tax_id}</p>
                    </div>
                  </div>
                )}
                {customer.notes && (
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Notes</p>
                      <p className="text-sm text-gray-900 whitespace-pre-line">{customer.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Created on {new Date(customer.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(p('/documents/new'), { state: { customerId: customer.id } })}
                >
                  <Receipt className="w-4 h-4" />
                  New Document
                </Button>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating a new document.</p>
                  <div className="mt-6">
                    <Button onClick={() => navigate(p('/documents/new'), { state: { customerId: customer.id } })}>
                      <Receipt className="w-4 h-4" />
                      New Document
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {documents.map((doc) => (
                        <tr
                          key={doc.document_id}
                          onClick={() => navigate(p(`/documents/${doc.document_id}`))}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {doc.document_number}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">
                            {doc.document_type}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(doc.issue_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {doc.currency}
                            {(doc.total_amount ?? 0).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                                doc.status
                              )}`}
                            >
                              {doc.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Recent Deposits</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(p('/deposits/create'), { state: { customerId: customer.id } })}
                >
                  <DollarSign className="w-4 h-4" />
                  New Deposit
                </Button>
              </div>

              {deposits.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No deposits</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by recording a new deposit.</p>
                  <div className="mt-6">
                    <Button onClick={() => navigate(p('/deposits/create'), { state: { customerId: customer.id } })}>
                      <DollarSign className="w-4 h-4" />
                      New Deposit
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Account
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deposits.map((deposit) => (
                        <tr
                          key={deposit.id}
                          onClick={() => navigate(p(`/deposits/edit/${deposit.id}`))}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">
                            {deposit.description}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {deposit.accounts?.name || 'N/A'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(deposit.deposit_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                            {deposit.currencies?.symbol}
                            {deposit.amount.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
