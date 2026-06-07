import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/Button';
import { DeleteModal } from '../components/DeleteModal';
import { Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TrashItem {
  id: string;
  type: 'document' | 'customer' | 'expense' | 'account';
  title: string;
  subtitle?: string;
  deleted_at: string;
  days_remaining: number;
}

export function Trash() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'all' | 'document' | 'customer' | 'expense' | 'account'>('all');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; item: TrashItem | null; isDeleting: boolean }>({
    isOpen: false,
    item: null,
    isDeleting: false,
  });

  useEffect(() => {
    loadTrashItems();
  }, []);

  const loadTrashItems = async () => {
    try {
      setIsLoading(true);
      const items: TrashItem[] = [];

      // Load deleted documents
      const { data: documents } = await supabase
        .from('documents')
        .select('id, document_number, document_type, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (documents) {
        for (const doc of documents) {
          const daysRemaining = calculateDaysRemaining(doc.deleted_at);
          items.push({
            id: doc.id,
            type: 'document',
            title: `${doc.document_type === 'invoice' ? 'Invoice' : 'Quote'} #${doc.document_number}`,
            deleted_at: doc.deleted_at,
            days_remaining: daysRemaining,
          });
        }
      }

      // Load deleted customers
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, email, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (customers) {
        for (const customer of customers) {
          const daysRemaining = calculateDaysRemaining(customer.deleted_at);
          items.push({
            id: customer.id,
            type: 'customer',
            title: customer.name,
            subtitle: customer.email,
            deleted_at: customer.deleted_at,
            days_remaining: daysRemaining,
          });
        }
      }

      // Load deleted expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('id, description, amount, currency_id, deleted_at, currencies(symbol)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (expenses) {
        for (const expense of expenses) {
          const daysRemaining = calculateDaysRemaining(expense.deleted_at);
          const symbol = (expense.currencies as any)?.symbol || '';
          items.push({
            id: expense.id,
            type: 'expense',
            title: expense.description,
            subtitle: `${symbol}${expense.amount}`,
            deleted_at: expense.deleted_at,
            days_remaining: daysRemaining,
          });
        }
      }

      // Load deleted accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name, account_number, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (accounts) {
        for (const account of accounts) {
          const daysRemaining = calculateDaysRemaining(account.deleted_at);
          items.push({
            id: account.id,
            type: 'account',
            title: account.name,
            subtitle: account.account_number,
            deleted_at: account.deleted_at,
            days_remaining: daysRemaining,
          });
        }
      }

      setTrashItems(items);
    } catch (error) {
      console.error('Error loading trash items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDaysRemaining = (deletedAt: string): number => {
    const deleted = new Date(deletedAt);
    const expiryDate = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  };

  const handleRestore = async (item: TrashItem) => {
    try {
      const tableName = item.type === 'document' ? 'documents' :
                       item.type === 'customer' ? 'customers' :
                       item.type === 'expense' ? 'expenses' : 'accounts';

      const { error } = await supabase
        .from(tableName)
        .update({ deleted_at: null })
        .eq('id', item.id);

      if (error) throw error;

      setTrashItems(trashItems.filter(i => i.id !== item.id));
    } catch (error) {
      console.error('Error restoring item:', error);
      alert('Failed to restore item. Please try again.');
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleteModal.item) return;

    try {
      setDeleteModal({ ...deleteModal, isDeleting: true });

      const tableName = deleteModal.item.type === 'document' ? 'documents' :
                       deleteModal.item.type === 'customer' ? 'customers' :
                       deleteModal.item.type === 'expense' ? 'expenses' : 'accounts';

      // For documents, delete related data first
      if (deleteModal.item.type === 'document') {
        const { data: sections } = await supabase
          .from('document_sections')
          .select('id')
          .eq('document_id', deleteModal.item.id);

        if (sections) {
          for (const section of sections) {
            await supabase
              .from('document_line_items')
              .delete()
              .eq('section_id', section.id);
          }
        }

        await supabase
          .from('document_sections')
          .delete()
          .eq('document_id', deleteModal.item.id);

        await supabase
          .from('payments')
          .delete()
          .eq('document_id', deleteModal.item.id);
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', deleteModal.item.id);

      if (error) throw error;

      setTrashItems(trashItems.filter(i => i.id !== deleteModal.item!.id));
      setDeleteModal({ isOpen: false, item: null, isDeleting: false });
    } catch (error) {
      console.error('Error permanently deleting item:', error);
      alert('Failed to delete item. Please try again.');
      setDeleteModal({ ...deleteModal, isDeleting: false });
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('Are you sure you want to permanently delete ALL items in trash? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);

      for (const item of trashItems) {
        const tableName = item.type === 'document' ? 'documents' :
                         item.type === 'customer' ? 'customers' :
                         item.type === 'expense' ? 'expenses' : 'accounts';

        // For documents, delete related data first
        if (item.type === 'document') {
          const { data: sections } = await supabase
            .from('document_sections')
            .select('id')
            .eq('document_id', item.id);

          if (sections) {
            for (const section of sections) {
              await supabase
                .from('document_line_items')
                .delete()
                .eq('section_id', section.id);
            }
          }

          await supabase
            .from('document_sections')
            .delete()
            .eq('document_id', item.id);

          await supabase
            .from('payments')
            .delete()
            .eq('document_id', item.id);
        }

        await supabase
          .from(tableName)
          .delete()
          .eq('id', item.id);
      }

      setTrashItems([]);
    } catch (error) {
      console.error('Error emptying trash:', error);
      alert('Failed to empty trash. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'document': return 'Document';
      case 'customer': return 'Customer';
      case 'expense': return 'Expense';
      case 'account': return 'Account';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'document': return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'customer': return 'bg-slate-100 text-slate-700 border border-slate-200';
      case 'expense': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'account': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredItems = selectedType === 'all'
    ? trashItems
    : trashItems.filter(item => item.type === selectedType);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading trash...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Trash</h1>
              <p className="mt-2 text-sm text-gray-600">
                Items will be permanently deleted after 30 days
              </p>
            </div>
            {trashItems.length > 0 && (
              <Button
                variant="danger"
                onClick={handleEmptyTrash}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Empty Trash
              </Button>
            )}
          </div>
        </div>

        {trashItems.length > 0 && (
          <div className="mb-6 flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              All ({trashItems.length})
            </button>
            <button
              onClick={() => setSelectedType('document')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'document'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Documents ({trashItems.filter(i => i.type === 'document').length})
            </button>
            <button
              onClick={() => setSelectedType('customer')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'customer'
                  ? 'bg-slate-700 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Customers ({trashItems.filter(i => i.type === 'customer').length})
            </button>
            <button
              onClick={() => setSelectedType('expense')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'expense'
                  ? 'bg-amber-700 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Expenses ({trashItems.filter(i => i.type === 'expense').length})
            </button>
            <button
              onClick={() => setSelectedType('account')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === 'account'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              Accounts ({trashItems.filter(i => i.type === 'account').length})
            </button>
          </div>
        )}

        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Trash2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Trash is empty</h2>
            <p className="text-gray-600">
              {selectedType === 'all'
                ? 'Deleted items will appear here and be kept for 30 days'
                : `No deleted ${selectedType}s found`
              }
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <div key={`${item.type}-${item.id}`} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                          {getTypeLabel(item.type)}
                        </span>
                        {item.days_remaining <= 7 && (
                          <span className="inline-flex items-center text-xs font-medium text-red-600">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {item.days_remaining} {item.days_remaining === 1 ? 'day' : 'days'} remaining
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {item.title}
                      </h3>
                      {item.subtitle && (
                        <p className="text-sm text-gray-600 mb-2">{item.subtitle}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        Deleted {new Date(item.deleted_at).toLocaleDateString()} at{' '}
                        {new Date(item.deleted_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRestore(item)}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restore
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteModal({ isOpen: true, item, isDeleting: false })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, item: null, isDeleting: false })}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete Item"
        message="This will permanently delete this item. This action cannot be undone."
        itemName={deleteModal.item?.title || ''}
        isLoading={deleteModal.isDeleting}
      />
    </div>
  );
}
