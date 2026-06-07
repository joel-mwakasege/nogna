import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { DeleteModal } from '../components/DeleteModal';
import { Pagination } from '../components/Pagination';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Trash2, CreditCard as Edit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Customer = Database['public']['Tables']['customers']['Row'];

export function CustomerList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { companyId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; customer: Customer | null; isDeleting: boolean }>({
    isOpen: false,
    customer: null,
    isDeleting: false,
  });

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      setTimeout(() => setSuccessMessage(''), 3000);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    loadCustomers();
  }, [currentPage]);

  const loadCustomers = async () => {
    try {
      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      setTotalCount(count || 0);

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(p(`/customers/edit/${customerId}`));
  };

  const handleDeleteClick = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, customer, isDeleting: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.customer) return;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true }));

    try {
      const { error } = await supabase
        .from('customers')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteModal.customer.id);

      if (error) throw error;

      setCustomers(customers.filter((c) => c.id !== deleteModal.customer.id));
      setDeleteModal({ isOpen: false, customer: null, isDeleting: false });
      setSuccessMessage('Customer moved to trash');
      setTimeout(() => setSuccessMessage(''), 3000);
      loadCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="bg-gray-50">
      <div className="px-4 sm:px-6 py-6 sm:py-8">
        {successMessage && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-xs sm:text-sm font-medium">{successMessage}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wide mb-2">CUSTOMER MANAGEMENT</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold">Customers</h1>
          </div>
          <Button onClick={() => navigate(p('/customers/new'))} className="w-full sm:w-auto">
            Create Customer
          </Button>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-xl p-8 sm:p-12 text-center">
            <p className="text-gray-500 text-sm sm:text-base">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 sm:p-12 text-center">
            <p className="text-gray-500 text-sm sm:text-base mb-4">No customers yet</p>
            <Button onClick={() => navigate(p('/customers/new'))} className="w-full sm:w-auto">
              Create Your First Customer
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden sm:block bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Name
                      </th>
                      <th className="px-4 lg:px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Email
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
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 lg:px-6 py-4 text-sm font-medium text-gray-900 cursor-pointer" onClick={() => navigate(p(`/customers/${customer.id}`))}>{customer.name}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 cursor-pointer" onClick={() => navigate(p(`/customers/${customer.id}`))}>{customer.email}</td>
                        <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 cursor-pointer hidden md:table-cell" onClick={() => navigate(p(`/customers/${customer.id}`))}>
                          {new Date(customer.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 lg:px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleEditClick(customer.id, e)}
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(customer, e)}
                              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
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
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => navigate(p(`/customers/${customer.id}`))}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 cursor-pointer hover:border-black transition-all"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-lg mb-1">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleEditClick(customer.id, e)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(customer, e)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
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
          title="Delete Customer"
          message="Are you sure you want to delete"
          itemName={deleteModal.customer?.name || ''}
          isLoading={deleteModal.isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal({ isOpen: false, customer: null, isDeleting: false })}
        />
      </div>
    </div>
  );
}
