import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, X, Tag, CreditCard, Layers, Briefcase, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';
import { DeleteModal } from './DeleteModal';

export type ExpenseClassification = 'cogs' | 'operating' | 'admin';

interface ExpenseCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  is_active: boolean;
  classification?: ExpenseClassification;
}

interface PaymentCategory {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export default function ExpenseSettings() {
  const { userProfile, companyId: authCompanyId } = useAuth();
  const companyId = userProfile?.company_id || authCompanyId;

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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    is_active: true,
    classification: 'operating' as ExpenseClassification,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, [companyId]);

  const fetchCategories = async () => {
    setLoading(true);
    setError('');

    try {
      let expenseQuery = supabase.from('expense_categories').select('*').order('name');
      let paymentQuery = supabase.from('payment_categories').select('*').order('name');

      if (companyId) {
        expenseQuery = expenseQuery.eq('company_id', companyId);
        paymentQuery = paymentQuery.eq('company_id', companyId);
      }

      const [expenseRes, paymentRes] = await Promise.all([expenseQuery, paymentQuery]);

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
      
      const payload: any = editModal.type === 'expense'
        ? {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            color: formData.color,
            is_active: formData.is_active,
            classification: formData.classification,
          }
        : {
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            is_active: formData.is_active,
          };

      if (companyId) {
        payload.company_id = companyId;
      }

      if (editModal.item?.id) {
        const { error: updateError } = await supabase
          .from(table)
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editModal.item.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from(table).insert(payload);
        if (insertError) throw insertError;
      }

      await fetchCategories();
      setEditModal({ isOpen: false, type: 'expense', item: null });
      setFormData({
        name: '',
        description: '',
        color: '#3B82F6',
        is_active: true,
        classification: 'operating',
      });
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
        is_active: item.is_active ?? true,
        classification: (item.classification || 'operating') as ExpenseClassification,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        color: '#3B82F6',
        is_active: true,
        classification: 'operating',
      });
    }
    setError('');
  };

  const renderClassificationBadge = (classification?: ExpenseClassification) => {
    switch (classification) {
      case 'cogs':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
            <Layers className="w-3 h-3" /> Direct Cost (COGS)
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
            <FileText className="w-3 h-3" /> Admin & Tax
          </span>
        );
      case 'operating':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
            <Briefcase className="w-3 h-3" /> Operating
          </span>
        );
    }
  };

  if (loading) {
    return <div className="text-gray-500 py-6">Loading categories...</div>;
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
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Expense Categories</h3>
              <p className="text-xs text-gray-500">
                Classify categories into Direct Costs (COGS), Operating, or Administrative for your P&L Statement.
              </p>
            </div>
            <Button size="sm" onClick={() => openEditModal('expense')}>
              <Plus className="w-4 h-4 mr-1" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expenseCategories.map((category) => (
                <div key={category.id} className="border border-gray-200 bg-white rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: category.color || '#3B82F6' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-gray-900 truncate">{category.name}</h4>
                          {!category.is_active && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactive</span>
                          )}
                        </div>
                        <div className="mt-1.5">
                          {renderClassificationBadge(category.classification)}
                        </div>
                        {category.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{category.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <button
                        onClick={() => openEditModal('expense', category)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit category"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, type: 'expense', id: category.id })}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete category"
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
              <Plus className="w-4 h-4 mr-1" />
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
                <div key={category.id} className="border border-gray-200 bg-white rounded-lg p-4 hover:shadow-md transition-shadow">
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

      {/* Add / Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {editModal.item ? 'Edit' : 'Add'} {editModal.type === 'expense' ? 'Expense' : 'Deposit'} Category
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
                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Direct Labor, Fuel, Internet, VAT"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              {/* 3-Way Classification Selector (for Expense Categories) */}
              {editModal.type === 'expense' && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1.5">
                    Accounting Classification *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, classification: 'cogs' })}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        formData.classification === 'cogs'
                          ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <Layers className="w-4 h-4 mb-1 text-amber-600" />
                      <div>
                        <div className="text-xs font-bold leading-tight">COGS</div>
                        <div className="text-[10px] text-gray-500 leading-tight">Direct Costs</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, classification: 'operating' })}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        formData.classification === 'operating'
                          ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <Briefcase className="w-4 h-4 mb-1 text-blue-600" />
                      <div>
                        <div className="text-xs font-bold leading-tight">Operating</div>
                        <div className="text-[10px] text-gray-500 leading-tight">Overheads</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, classification: 'admin' })}
                      className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                        formData.classification === 'admin'
                          ? 'border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-500/20'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <FileText className="w-4 h-4 mb-1 text-purple-600" />
                      <div>
                        <div className="text-xs font-bold leading-tight">Admin & Tax</div>
                        <div className="text-[10px] text-gray-500 leading-tight">Taxes/Gov</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional notes or guidelines for this category..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  rows={2}
                />
              </div>

              {editModal.type === 'expense' && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Color Tag</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-9 w-16 border border-gray-300 rounded-lg cursor-pointer p-0.5"
                    />
                    <span className="text-xs font-mono text-gray-500">{formData.color}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-black focus:ring-black h-4 w-4"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 select-none">
                  Active (available in expense dropdowns)
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-gray-100">
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
                  {saving ? 'Saving...' : 'Save Category'}
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
        title={`Delete ${deleteModal.type === 'expense' ? 'Expense' : 'Deposit'} Category`}
        message="Are you sure you want to delete this category?"
        itemName=""
        isLoading={false}
      />
    </div>
  );
}
