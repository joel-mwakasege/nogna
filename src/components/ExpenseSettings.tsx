import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, X, Tag, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { DeleteModal } from './DeleteModal';

interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

interface PaymentCategory {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export default function ExpenseSettings() {
  const [activeTab, setActiveTab] = useState<'expense' | 'payment'>('expense');
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<{ isOpen: boolean; type: 'expense' | 'payment'; item: any | null }>({
    isOpen: false,
    type: 'expense',
    item: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; type: 'expense' | 'payment'; id: string | null }>({
    isOpen: false,
    type: 'expense',
    id: null,
  });
  const [formData, setFormData] = useState({ name: '', description: '', color: '#3B82F6', is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    setError('');

    try {
      const [expenseRes, paymentRes] = await Promise.all([
        supabase.from('expense_categories').select('*').order('name'),
        supabase.from('payment_categories').select('*').order('name'),
      ]);

      if (expenseRes.error) {
        console.error('Error loading expense categories:', expenseRes.error);
        setError(`Failed to load expense categories: ${expenseRes.error.message}`);
      } else if (expenseRes.data) {
        setExpenseCategories(expenseRes.data);
      }

      if (paymentRes.error) {
        console.error('Error loading payment categories:', paymentRes.error);
        setError(`Failed to load payment categories: ${paymentRes.error.message}`);
      } else if (paymentRes.data) {
        setPaymentCategories(paymentRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError(`Failed to load categories: ${err.message || 'Unknown error'}`);
    }

    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const table = editModal.type === 'expense' ? 'expense_categories' : 'payment_categories';
      const data = editModal.type === 'expense'
        ? { name: formData.name, description: formData.description, color: formData.color, is_active: formData.is_active }
        : { name: formData.name, description: formData.description, is_active: formData.is_active };

      if (editModal.item?.id) {
        const { error: updateError } = await supabase
          .from(table)
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', editModal.item.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from(table).insert(data);
        if (insertError) throw insertError;
      }

      await fetchCategories();
      setEditModal({ isOpen: false, type: 'expense', item: null });
      setFormData({ name: '', description: '', color: '#3B82F6', is_active: true });
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteModal.id) return;

    try {
      const table = deleteModal.type === 'expense' ? 'expense_categories' : 'payment_categories';
      const { error: deleteError } = await supabase.from(table).delete().eq('id', deleteModal.id);

      if (deleteError) throw deleteError;

      await fetchCategories();
      setDeleteModal({ isOpen: false, type: 'expense', id: null });
    } catch (err: any) {
      setError(err.message || 'Failed to delete category');
    }
  };

  const openEditModal = (type: 'expense' | 'payment', item: any = null) => {
    setEditModal({ isOpen: true, type, item });
    if (item) {
      setFormData({
        name: item.name,
        description: item.description || '',
        color: item.color || '#3B82F6',
        is_active: item.is_active,
      });
    } else {
      setFormData({ name: '', description: '', color: '#3B82F6', is_active: true });
    }
    setError('');
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab('expense')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'expense'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Expense Categories
            </div>
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'payment'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Deposit Categories
            </div>
          </button>
        </nav>
      </div>

      {activeTab === 'expense' ? (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Expense Categories</h3>
            <Button size="sm" onClick={() => openEditModal('expense')}>
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          </div>
          {expenseCategories.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <Tag className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-500 mb-2">No expense categories found</p>
              <p className="text-xs text-gray-400">Click "Add Category" to create your first expense category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {expenseCategories.map((category) => (
                <div key={category.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{category.name}</h4>
                          {!category.is_active && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
                          )}
                        </div>
                        {category.description && (
                          <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => openEditModal('expense', category)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, type: 'expense', id: category.id })}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Deposit Categories</h3>
            <Button size="sm" onClick={() => openEditModal('payment')}>
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          </div>
          {paymentCategories.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <CreditCard className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-500 mb-2">No deposit categories found</p>
              <p className="text-xs text-gray-400">Click "Add Category" to create your first deposit category</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentCategories.map((category) => (
                <div key={category.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{category.name}</h4>
                        {!category.is_active && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
                        )}
                      </div>
                      {category.description && (
                        <p className="text-sm text-gray-500 mt-1">{category.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => openEditModal('payment', category)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, type: 'payment', id: category.id })}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editModal.item ? 'Edit' : 'Add'} {editModal.type === 'expense' ? 'Expense' : 'Payment'} Category
              </h3>
              <button
                onClick={() => setEditModal({ isOpen: false, type: 'expense', item: null })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              {editModal.type === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-500">{formData.color}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditModal({ isOpen: false, type: 'expense', item: null })}
                  disabled={saving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onCancel={() => setDeleteModal({ isOpen: false, type: 'expense', id: null })}
        onConfirm={handleDelete}
        title={`Delete ${deleteModal.type === 'expense' ? 'Expense' : 'Payment'} Category`}
        message="Are you sure you want to delete this category?"
        itemName=""
        isLoading={false}
      />
    </div>
  );
}
