import { useState, useEffect, useRef } from 'react';
import { X, Paperclip, Trash2, FileText, Image, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { useAuth } from '../contexts/AuthContext';
import {
  uploadFile,
  deleteFile,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  formatFileSize,
} from '../lib/file-upload-utils';

type Account = Database['public']['Tables']['accounts']['Row'];
type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
type Payment = Database['public']['Tables']['payments']['Row'];

interface PendingFile {
  file: File;
  preview?: string;
}

interface ExistingAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  signed_url: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  documentId: string;
  documentCurrency: string;
  remainingAmount: number;
  onClose: () => void;
  onPaymentAdded: () => void;
  editPayment?: (Payment & { account_name: string; attachments: ExistingAttachment[] }) | null;
}

export function PaymentModal({
  isOpen,
  documentId,
  documentCurrency,
  remainingAmount,
  onClose,
  onPaymentAdded,
  editPayment,
}: PaymentModalProps) {
  const { user: authUser, userProfile, companyId: authCompanyId } = useAuth();
  const activeCompanyId = userProfile?.company_id || authCompanyId;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachment[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = !!editPayment;

  const [formData, setFormData] = useState<PaymentInsert>({
    document_id: documentId,
    account_id: '',
    amount: remainingAmount,
    currency: documentCurrency as any,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setPendingFiles([]);
      setRemovedAttachmentIds([]);
      setFileError('');

      if (editPayment) {
        setFormData({
          document_id: editPayment.document_id,
          account_id: editPayment.account_id,
          amount: editPayment.amount,
          currency: editPayment.currency as any,
          payment_date: editPayment.payment_date,
          payment_method: editPayment.payment_method,
          reference_number: editPayment.reference_number || '',
          notes: editPayment.notes || '',
        });
        setExistingAttachments(editPayment.attachments || []);
        loadAccounts(editPayment.account_id);
      } else {
        setFormData({
          document_id: documentId,
          amount: remainingAmount,
          currency: documentCurrency as any,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'bank_transfer',
          account_id: '',
          reference_number: '',
          notes: '',
        });
        setExistingAttachments([]);
        loadAccounts();
      }
    }
  }, [isOpen, editPayment, documentId, remainingAmount, documentCurrency]);

  const loadAccounts = async (selectedAccountId?: string) => {
    try {
      let query = supabase
        .from('accounts')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (activeCompanyId) {
        query = query.eq('company_id', activeCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const loadedAccounts = data || [];
      setAccounts(loadedAccounts);

      if (!selectedAccountId && loadedAccounts.length > 0) {
        setFormData((prev) => ({
          ...prev,
          account_id: prev.account_id || loadedAccounts[0].id,
        }));
      }
    } catch (error: any) {
      console.error('Error loading accounts:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setFileError('Only images, PDFs, and Word documents are allowed.');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`"${file.name}" exceeds the 10MB size limit.`);
        return;
      }
    }

    const newPending: PendingFile[] = files.map((file) => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));

    setPendingFiles((prev) => [...prev, ...newPending]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => {
      const updated = [...prev];
      if (updated[index].preview) URL.revokeObjectURL(updated[index].preview!);
      updated.splice(index, 1);
      return updated;
    });
  };

  const removeExistingAttachment = (id: string) => {
    setRemovedAttachmentIds((prev) => [...prev, id]);
    setExistingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation checks
    if (!formData.account_id) {
      setErrorMessage('Please select an account to receive this payment.');
      return;
    }

    const parsedAmount = Number(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than zero.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id || authUser?.id;

      if (!currentUserId) {
        throw new Error('User authentication session not found. Please log in again.');
      }

      // Ensure company_id is resolved
      let targetCompanyId = activeCompanyId;
      if (!targetCompanyId) {
        const { data: docData } = await supabase
          .from('documents')
          .select('company_id')
          .eq('id', documentId)
          .single();
        targetCompanyId = docData?.company_id;
      }

      if (!targetCompanyId) {
        throw new Error('Company ID could not be determined for this document.');
      }

      let paymentId: string;

      if (isEditMode && editPayment) {
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            account_id: formData.account_id,
            amount: parsedAmount,
            currency: formData.currency,
            payment_date: formData.payment_date,
            payment_method: formData.payment_method,
            reference_number: formData.reference_number?.trim() || null,
            notes: formData.notes?.trim() || null,
          })
          .eq('id', editPayment.id);

        if (updateError) throw updateError;
        paymentId = editPayment.id;

        // Soft-delete removed attachments
        if (removedAttachmentIds.length > 0) {
          await supabase
            .from('payment_attachments')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', removedAttachmentIds);

          const removedAttachments = (editPayment.attachments || []).filter((a) =>
            removedAttachmentIds.includes(a.id)
          );
          await Promise.all(
            removedAttachments.map((a) => deleteFile(a.file_path, 'payment-attachments'))
          );
        }
      } else {
        const { data: newPayment, error: insertError } = await supabase
          .from('payments')
          .insert([
            {
              document_id: documentId,
              account_id: formData.account_id,
              amount: parsedAmount,
              currency: formData.currency,
              payment_date: formData.payment_date,
              payment_method: formData.payment_method,
              reference_number: formData.reference_number?.trim() || null,
              notes: formData.notes?.trim() || null,
              user_id: currentUserId,
              company_id: targetCompanyId,
            },
          ])
          .select('id')
          .single();

        if (insertError) throw insertError;
        paymentId = newPayment.id;
      }

      // Upload new attachments if present
      if (pendingFiles.length > 0) {
        for (const { file } of pendingFiles) {
          const filePath = await uploadFile(file, 'payment-attachments', paymentId);
          const { error: attError } = await supabase.from('payment_attachments').insert({
            payment_id: paymentId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: currentUserId,
            company_id: targetCompanyId,
          });
          if (attError) console.error('Attachment record error:', attError);
        }
      }

      onPaymentAdded();
      onClose();
    } catch (error: any) {
      console.error('Error saving payment:', error);
      setErrorMessage(error.message || 'Failed to save payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const effectiveMax = isEditMode && editPayment
    ? remainingAmount + editPayment.amount
    : remainingAmount;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold">
            {isEditMode ? 'Edit Payment' : 'Record Payment'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Payment Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={effectiveMax > 0 ? effectiveMax : undefined}
                value={isNaN(Number(formData.amount)) ? '' : formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: e.target.value === '' ? 0 : parseFloat(e.target.value),
                  })
                }
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Remaining: {documentCurrency} {effectiveMax.toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Payment Date *
              </label>
              <input
                type="date"
                value={formData.payment_date}
                onChange={(e) =>
                  setFormData({ ...formData, payment_date: e.target.value })
                }
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Account Received *
            </label>
            <select
              value={formData.account_id || ''}
              onChange={(e) =>
                setFormData({ ...formData, account_id: e.target.value })
              }
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              required
            >
              <option value="">Select an account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.account_type})
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No active accounts found. Please add a bank or cash account first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Payment Method *
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  payment_method: e.target.value as PaymentInsert['payment_method'],
                })
              }
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              required
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="credit_card">Credit Card</option>
              <option value="paypal">PayPal</option>
              <option value="stripe">Stripe</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Reference Number
            </label>
            <input
              type="text"
              value={formData.reference_number || ''}
              onChange={(e) =>
                setFormData({ ...formData, reference_number: e.target.value })
              }
              placeholder="Transaction ID, Check Number, etc."
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Notes / Reason
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Payment details, reason, or additional notes..."
              rows={3}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
              Attachments
            </label>

            {existingAttachments.length > 0 && (
              <ul className="mb-3 space-y-2">
                {existingAttachments.map((att) => {
                  const isImage = att.file_type.startsWith('image/');
                  return (
                    <li
                      key={att.id}
                      className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                    >
                      {isImage ? (
                        <img
                          src={att.signed_url}
                          alt={att.file_name}
                          className="w-8 h-8 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-red-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {att.file_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(att.file_size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExistingAttachment(att.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-lg px-4 py-5 flex flex-col items-center gap-2 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <Paperclip className="w-5 h-5 text-gray-400" />
              <p className="text-sm text-gray-500">Click to attach files</p>
              <p className="text-xs text-gray-400">
                Images, PDF, Word — up to 10 MB each
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_FILE_TYPES.join(',')}
              onChange={handleFileChange}
              className="hidden"
            />

            {fileError && <p className="text-xs text-red-500 mt-2">{fileError}</p>}

            {pendingFiles.length > 0 && (
              <ul className="mt-3 space-y-2">
                {pendingFiles.map((pf, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    {pf.preview ? (
                      <img
                        src={pf.preview}
                        alt={pf.file.name}
                        className="w-8 h-8 object-cover rounded flex-shrink-0"
                      />
                    ) : pf.file.type === 'application/pdf' ? (
                      <FileText className="w-8 h-8 text-red-400 flex-shrink-0" />
                    ) : (
                      <Image className="w-8 h-8 text-blue-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {pf.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(pf.file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 w-full"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || accounts.length === 0}
              className="flex-1 w-full"
            >
              {isSubmitting
                ? isEditMode
                  ? 'Saving...'
                  : 'Recording...'
                : isEditMode
                ? 'Save Changes'
                : 'Record Payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
