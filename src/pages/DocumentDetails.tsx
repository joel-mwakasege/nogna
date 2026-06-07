import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { Button } from '../components/Button';
import { PaymentModal } from '../components/PaymentModal';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { Plus, FileDown, DollarSign, Trash2, Link, Unlink, ChevronUp, ChevronDown, Pencil, Check, X, Paperclip, FileText, ExternalLink, SquarePen } from 'lucide-react';
import { DeleteModal } from '../components/DeleteModal';
import html2pdf from 'html2pdf.js';
import { useAuth } from '../contexts/AuthContext';

type Document = Database['public']['Tables']['documents']['Row'];
type Section = Database['public']['Tables']['document_sections']['Row'];
type LineItem = Database['public']['Tables']['document_line_items']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type Account = Database['public']['Tables']['accounts']['Row'];
type ClientCustomField = Database['public']['Tables']['client_custom_fields']['Row'];
type CompanySettings = Database['public']['Tables']['company_settings']['Row'];
type CompanyCustomField = Database['public']['Tables']['company_custom_fields']['Row'];

interface SectionWithItems extends Section {
  items: LineItem[];
}

interface PaymentAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  signed_url: string;
}

interface PaymentWithAccount extends Payment {
  account_name: string;
  attachments: PaymentAttachment[];
}

export function DocumentDetails() {
  const { id, slug } = useParams<{ id: string; slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const navigate = useNavigate();
  const { user, userProfile, companyId } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [sections, setSections] = useState<SectionWithItems[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [availableCustomers, setAvailableCustomers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [payments, setPayments] = useState<PaymentWithAccount[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentWithAccount | null>(null);
  const [deletePaymentModal, setDeletePaymentModal] = useState<{ payment: PaymentWithAccount | null; isDeleting: boolean }>({ payment: null, isDeleting: false });
  const [clientCustomFields, setClientCustomFields] = useState<ClientCustomField[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [companyCustomFields, setCompanyCustomFields] = useState<CompanyCustomField[]>([]);
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [letterheadDataUrl, setLetterheadDataUrl] = useState<string>('');
  const [selectedItemsForGrouping, setSelectedItemsForGrouping] = useState<Set<string>>(new Set());
  const [isGroupingMode, setIsGroupingMode] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState<string>('$');
  const [currencyDecimalPlaces, setCurrencyDecimalPlaces] = useState<number>(2);
  const [availableCurrencies, setAvailableCurrencies] = useState<{ code: string; name: string; symbol: string; decimal_places: number }[]>([]);
  const [editingDate, setEditingDate] = useState(false);
  const [editingUnitCostId, setEditingUnitCostId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState('');
  const [savingDate, setSavingDate] = useState(false);
  const [deleteSectionModal, setDeleteSectionModal] = useState<{ sectionId: string; sectionName: string } | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);

  const pendingUpdatesRef = useRef<Map<string, { updates: Partial<LineItem>, timestamp: number }>>(new Map());
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id && userProfile) {
      setIsLoading(true);
      Promise.all([
        loadDocument(),
        loadPayments(),
        loadClientCustomFields(),
        loadCompanySettings(),
        supabase
          .from('currencies')
          .select('code, name, symbol, decimal_places')
          .eq('is_active', true)
          .order('display_order')
          .then(({ data }) => {
            if (data) setAvailableCurrencies(data);
          }),
        supabase
          .from('customers')
          .select('id, name')
          .is('deleted_at', null)
          .order('name')
          .then(({ data }) => {
            if (data) setAvailableCustomers(data);
          })
      ]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [id, userProfile]);

  useEffect(() => {
    if (companySettings?.logo_url) {
      loadLogoAsDataUrl(companySettings.logo_url);
    }
  }, [companySettings?.logo_url]);

  useEffect(() => {
    if (companySettings?.letterhead_url) {
      loadImageAsDataUrl(companySettings.letterhead_url, setLetterheadDataUrl);
    }
  }, [companySettings?.letterhead_url]);

  const loadImageAsDataUrl = async (url: string, setter: (v: string) => void) => {
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Failed to load image:', error);
      setter('');
    }
  };

  const loadLogoAsDataUrl = (url: string) => loadImageAsDataUrl(url, setLogoDataUrl);

  const loadDocument = async () => {
    try {
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (docError) throw docError;

      if (!doc) {
        navigate(p('/documents'));
        return;
      }

      setDocument(doc);
      setDiscountPercent(doc.discount_percent);
      setShowDiscount(doc.discount_percent > 0);
      setTaxPercent(doc.tax_percent);

      if (doc.currency) {
        const { data: currencyData } = await supabase
          .from('currencies')
          .select('symbol, decimal_places')
          .eq('code', doc.currency)
          .maybeSingle();
        if (currencyData) {
          if (currencyData.symbol) {
            setCurrencySymbol(currencyData.symbol);
          }
          if (currencyData.decimal_places !== undefined && currencyData.decimal_places !== null) {
            setCurrencyDecimalPlaces(currencyData.decimal_places);
          }
        }
      }

      if (doc.customer_id) {
        const { data: customer } = await supabase
          .from('customers')
          .select('name')
          .eq('id', doc.customer_id)
          .single();
        if (customer) setCustomerName(customer.name);
      }

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('document_sections')
        .select('*')
        .eq('document_id', id)
        .order('sort_order');

      if (sectionsError) throw sectionsError;

      const sectionsWithItems = await Promise.all(
        (sectionsData || []).map(async (section) => {
          const { data: items } = await supabase
            .from('document_line_items')
            .select('*')
            .eq('section_id', section.id)
            .order('sort_order');

          return {
            ...section,
            items: items || [],
          };
        })
      );

      setSections(sectionsWithItems);
    } catch (error) {
      console.error('Error loading document:', error);
    }
  };

  const handleUpdateIssueDate = async () => {
    if (!document || !editDateValue) return;
    setSavingDate(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ issue_date: editDateValue })
        .eq('id', document.id);

      if (error) throw error;

      setDocument({ ...document, issue_date: editDateValue });
      setEditingDate(false);
    } catch (error) {
      console.error('Error updating issue date:', error);
    } finally {
      setSavingDate(false);
    }
  };

  const loadPayments = async () => {
    try {
      const { data: paymentsData, error } = await supabase
        .from('payments')
        .select('*')
        .eq('document_id', id)
        .is('deleted_at', null)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const paymentsWithAccounts = await Promise.all(
        (paymentsData || []).map(async (payment) => {
          const [{ data: account }, { data: rawAttachments }] = await Promise.all([
            supabase.from('accounts').select('name').eq('id', payment.account_id).maybeSingle(),
            supabase.from('payment_attachments').select('id, file_name, file_path, file_type, file_size').eq('payment_id', payment.id).is('deleted_at', null),
          ]);

          const attachments = await Promise.all(
            (rawAttachments || []).map(async (att) => {
              const { data: signedData } = await supabase.storage
                .from('payment-attachments')
                .createSignedUrl(att.file_path, 3600);
              return { ...att, signed_url: signedData?.signedUrl || '' };
            })
          );

          return {
            ...payment,
            account_name: account?.name || 'Unknown Account',
            attachments,
          };
        })
      );

      setPayments(paymentsWithAccounts);
      try {
        await updateDocumentStatus(paymentsWithAccounts);
      } catch (statusError) {
        console.error('Error updating document status:', statusError);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  const loadClientCustomFields = async () => {
    if (!user?.id || !userProfile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('client_custom_fields')
        .select('*')
        .eq('document_id', id)
        .order('display_order');

      if (error) throw error;

      if (!data || data.length === 0) {
        const { count } = await supabase
          .from('client_custom_fields')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', id);

        if (count && count > 0) {
          return;
        }

        const { data: defaultFields, error: defaultFieldsError } = await supabase
          .from('default_client_fields')
          .select('*')
          .eq('user_id', user.id)
          .order('display_order', { ascending: true });

        if (defaultFieldsError) {
          console.error('Error loading default client fields:', defaultFieldsError);
          return;
        }

        if (!defaultFields || defaultFields.length === 0) {
          return;
        }

        const fieldsToInsert = defaultFields.map((field, index) => ({
          document_id: id,
          company_id: userProfile.company_id,
          field_label: field.field_label,
          field_value: field.field_value,
          display_order: index,
        }));

        const { data: insertedFields, error: insertError } = await supabase
          .from('client_custom_fields')
          .insert(fieldsToInsert)
          .select();

        if (insertError) {
          if (insertError.code === '23505') {
            const { data: existingFields } = await supabase
              .from('client_custom_fields')
              .select('*')
              .eq('document_id', id)
              .order('display_order');
            setClientCustomFields(existingFields || []);
          } else {
            throw insertError;
          }
        } else {
          setClientCustomFields(insertedFields || []);
        }
      } else {
        setClientCustomFields(data);
      }
    } catch (error) {
      console.error('Error loading client custom fields:', error);
    }
  };

  const loadCompanySettings = async () => {
    if (!companyId) return;
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      setCompanySettings(data);

      if (data) {
        const { data: customFields, error: customFieldsError } = await supabase
          .from('company_custom_fields')
          .select('*')
          .eq('company_settings_id', data.id)
          .order('display_order', { ascending: true });

        if (customFieldsError) throw customFieldsError;
        setCompanyCustomFields(customFields || []);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
  };

  const updateDocumentStatus = async (paymentsToCheck: PaymentWithAccount[] = payments) => {
    if (!document) return;

    const totalPaid = paymentsToCheck.reduce((sum, payment) => sum + payment.amount, 0);
    const currentSubtotal = sections.reduce((total, section) => {
      const sectionSubtotal = calculateSectionSubtotal(section);
      const multiplier = section.units_multiplier || 1;
      return total + (sectionSubtotal * multiplier);
    }, 0);
    const currentDiscount = currentSubtotal * (discountPercent / 100);
    const currentTax = (currentSubtotal - currentDiscount) * (taxPercent / 100);
    const currentGrandTotal = currentSubtotal - currentDiscount + currentTax;

    let newStatus: Document['status'] = document.status;

    if (totalPaid === 0) {
      newStatus = 'unpaid';
    } else if (totalPaid >= currentGrandTotal) {
      newStatus = 'paid';
    } else if (totalPaid > 0 && totalPaid < currentGrandTotal) {
      newStatus = 'partially_paid';
    }

    await updateDocument({ status: newStatus });
  };

  const handlePaymentAdded = () => {
    loadPayments();
    loadDocument();
  };

  const openEditPayment = (payment: PaymentWithAccount) => {
    setEditingPayment(payment);
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setEditingPayment(null);
  };

  const handleConfirmDeletePayment = async () => {
    if (!deletePaymentModal.payment) return;
    const paymentId = deletePaymentModal.payment.id;
    setDeletePaymentModal((prev) => ({ ...prev, isDeleting: true }));
    try {
      const { error } = await supabase.rpc('soft_delete_payment', { p_payment_id: paymentId });
      if (error) throw error;
      setDeletePaymentModal({ payment: null, isDeleting: false });
    } catch (error) {
      console.error('Error deleting payment:', error);
      setDeletePaymentModal((prev) => ({ ...prev, isDeleting: false }));
      alert('Failed to delete payment. Please try again.');
      return;
    }
    loadPayments();
    loadDocument();
  };

  const addSection = async () => {
    if (!document) return;

    try {
      const sortOrder = sections.length;
      const { data: newSection, error } = await supabase
        .from('document_sections')
        .insert({
          document_id: document.id,
          name: 'New Section',
          sort_order: sortOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setSections((prevSections) => [...prevSections, { ...newSection, items: [] }]);
    } catch (error) {
      console.error('Error adding section:', error);
    }
  };

  const updateSectionNameInDB = async (sectionId: string, name: string) => {
    try {
      const { error } = await supabase
        .from('document_sections')
        .update({ name })
        .eq('id', sectionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating section name:', error);
    }
  };

  const updateSectionNameLocally = (sectionId: string, name: string) => {
    setSections((prevSections) =>
      prevSections.map((s) => (s.id === sectionId ? { ...s, name } : s))
    );
  };

  const updateSectionMultiplierInDB = async (sectionId: string, units_multiplier: number) => {
    try {
      const { error } = await supabase
        .from('document_sections')
        .update({ units_multiplier })
        .eq('id', sectionId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating section multiplier:', error);
    }
  };

  const updateSectionMultiplierLocally = (sectionId: string, units_multiplier: number) => {
    setSections((prevSections) =>
      prevSections.map((s) => (s.id === sectionId ? { ...s, units_multiplier } : s))
    );
  };

  const deleteSection = async (sectionId: string) => {
    try {
      const { error: itemsError } = await supabase
        .from('document_line_items')
        .delete()
        .eq('section_id', sectionId);

      if (itemsError) throw itemsError;

      const { error: sectionError } = await supabase
        .from('document_sections')
        .delete()
        .eq('id', sectionId);

      if (sectionError) throw sectionError;

      setSections((prevSections) => prevSections.filter((s) => s.id !== sectionId));
    } catch (error) {
      console.error('Error deleting section:', error);
    }
  };

  const removeSectionHeaderOnly = async (sectionId: string) => {
    try {
      const { error } = await supabase
        .from('document_sections')
        .update({ hide_header: true })
        .eq('id', sectionId);

      if (error) throw error;

      setSections((prevSections) =>
        prevSections.map((s) => (s.id === sectionId ? { ...s, hide_header: true } : s))
      );
    } catch (error) {
      console.error('Error hiding section header:', error);
    }
  };

  const addLineItem = async (sectionId: string) => {
    try {
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;

      const { data: newItem, error } = await supabase
        .from('document_line_items')
        .insert({
          section_id: sectionId,
          description: 'New Line Item',
          units: 1,
          days: 1,
          unit_cost: 0,
          sort_order: section.items.length,
        })
        .select()
        .single();

      if (error) throw error;

      setSections((prevSections) =>
        prevSections.map((s) =>
          s.id === sectionId ? { ...s, items: [...s.items, newItem] } : s
        )
      );
    } catch (error) {
      console.error('Error adding line item:', error);
    }
  };

  const flushPendingUpdates = useCallback(async () => {
    const updates = Array.from(pendingUpdatesRef.current.entries());
    if (updates.length === 0) return;

    pendingUpdatesRef.current.clear();

    try {
      await Promise.all(
        updates.map(([itemId, { updates: itemUpdates }]) =>
          supabase
            .from('document_line_items')
            .update(itemUpdates)
            .eq('id', itemId)
        )
      );
    } catch (error) {
      console.error('Error flushing updates:', error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        flushPendingUpdates();
      }
    };
  }, [flushPendingUpdates]);

  const updateLineItemInDB = useCallback(async (
    itemId: string,
    updates: Partial<LineItem>
  ) => {
    try {
      const { error } = await supabase
        .from('document_line_items')
        .update(updates)
        .eq('id', itemId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating line item:', error);
    }
  }, []);

  const updateLineItemLocally = useCallback((itemId: string, updates: Partial<LineItem>) => {
    setSections((prevSections) =>
      prevSections.map((s) => ({
        ...s,
        items: s.items.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item
        ),
      }))
    );
  }, []);

  const updateLineItemWithDebounce = useCallback((itemId: string, updates: Partial<LineItem>) => {
    updateLineItemLocally(itemId, updates);

    const existing = pendingUpdatesRef.current.get(itemId);
    pendingUpdatesRef.current.set(itemId, {
      updates: { ...(existing?.updates || {}), ...updates },
      timestamp: Date.now()
    });

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      flushPendingUpdates();
    }, 1000);
  }, [updateLineItemLocally, flushPendingUpdates]);

  const deleteLineItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('document_line_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setSections((prevSections) =>
        prevSections.map((s) => ({
          ...s,
          items: s.items.filter((item) => item.id !== itemId),
        }))
      );
    } catch (error) {
      console.error('Error deleting line item:', error);
    }
  };

  const moveLineItem = async (itemId: string, direction: 'up' | 'down') => {
    try {
      const section = sections.find((s) => s.items.some((item) => item.id === itemId));
      if (!section) return;

      const currentIndex = section.items.findIndex((item) => item.id === itemId);
      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= section.items.length) return;

      const newItems = [...section.items];
      [newItems[currentIndex], newItems[newIndex]] = [newItems[newIndex], newItems[currentIndex]];

      const updates = newItems.map((item, index) => ({
        id: item.id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('document_line_items')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }

      setSections((prevSections) =>
        prevSections.map((s) =>
          s.id === section.id
            ? { ...s, items: newItems }
            : s
        )
      );
    } catch (error) {
      console.error('Error moving line item:', error);
    }
  };

  const updateDocument = async (updates: Partial<Document>) => {
    if (!document) return;

    try {
      const { error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', document.id);

      if (error) throw error;

      setDocument({ ...document, ...updates });
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const addClientCustomField = async () => {
    if (!document || !userProfile?.company_id) return;

    try {
      const displayOrder = clientCustomFields.length;
      const { data: newField, error } = await supabase
        .from('client_custom_fields')
        .insert({
          document_id: document.id,
          company_id: userProfile.company_id,
          field_label: 'New Field',
          field_value: '',
          display_order: displayOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setClientCustomFields((prev) => [...prev, newField]);
    } catch (error) {
      console.error('Error adding client custom field:', error);
    }
  };

  const updateClientCustomFieldInDB = async (
    fieldId: string,
    updates: Partial<ClientCustomField>
  ) => {
    try {
      const { error } = await supabase
        .from('client_custom_fields')
        .update(updates)
        .eq('id', fieldId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating client custom field:', error);
    }
  };

  const updateClientCustomFieldLocally = (
    fieldId: string,
    updates: Partial<ClientCustomField>
  ) => {
    setClientCustomFields((prev) =>
      prev.map((field) => (field.id === fieldId ? { ...field, ...updates } : field))
    );
  };

  const deleteClientCustomField = async (fieldId: string) => {
    try {
      const { error } = await supabase
        .from('client_custom_fields')
        .delete()
        .eq('id', fieldId);

      if (error) throw error;

      setClientCustomFields((prev) => prev.filter((field) => field.id !== fieldId));
    } catch (error) {
      console.error('Error deleting client custom field:', error);
    }
  };

  const startGrouping = (sectionId: string) => {
    setIsGroupingMode(sectionId);
    setSelectedItemsForGrouping(new Set());
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemsForGrouping((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const createGroup = async () => {
    if (selectedItemsForGrouping.size < 2) {
      alert('Please select at least 2 items to group');
      return;
    }

    try {
      const groupId = crypto.randomUUID();
      const selectedItems = Array.from(selectedItemsForGrouping);
      const firstItemId = selectedItems[0];

      for (let i = 0; i < selectedItems.length; i++) {
        const itemId = selectedItems[i];
        await supabase
          .from('document_line_items')
          .update({
            group_id: groupId,
            is_group_parent: i === 0,
          })
          .eq('id', itemId);
      }

      await loadDocument();
      setIsGroupingMode(null);
      setSelectedItemsForGrouping(new Set());
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const cancelGrouping = () => {
    setIsGroupingMode(null);
    setSelectedItemsForGrouping(new Set());
  };

  const ungroupItems = async (groupId: string) => {
    try {
      await supabase
        .from('document_line_items')
        .update({
          group_id: null,
          is_group_parent: false,
        })
        .eq('group_id', groupId);

      await loadDocument();
    } catch (error) {
      console.error('Error ungrouping items:', error);
    }
  };

  const calculateSectionSubtotal = useCallback((section: SectionWithItems) => {
    const processedGroups = new Set<string>();
    return section.items.reduce((sum, item) => {
      if (item.group_id) {
        if (processedGroups.has(item.group_id)) {
          return sum;
        }
        processedGroups.add(item.group_id);
        const parentItem = section.items.find(
          (i) => i.group_id === item.group_id && i.is_group_parent
        );
        if (parentItem) {
          return sum + parentItem.days * parentItem.unit_cost;
        }
        return sum;
      }
      return sum + item.units * item.days * item.unit_cost;
    }, 0);
  }, []);

  const subtotal = useMemo(() => {
    return sections.reduce((total, section) => {
      const sectionSubtotal = calculateSectionSubtotal(section);
      const multiplier = section.units_multiplier || 1;
      return total + (sectionSubtotal * multiplier);
    }, 0);
  }, [sections, calculateSectionSubtotal]);

  const discount = useMemo(() => {
    return subtotal * (discountPercent / 100);
  }, [subtotal, discountPercent]);

  const tax = useMemo(() => {
    return (subtotal - discount) * (taxPercent / 100);
  }, [subtotal, discount, taxPercent]);

  const grandTotal = useMemo(() => {
    return subtotal - discount + tax;
  }, [subtotal, discount, tax]);

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, grandTotal - totalPaid);
  }, [grandTotal, totalPaid]);

  const exportPDF = async () => {
    const element = window.document.getElementById('pdf-content');
    if (!element || !document) {
      alert('PDF content not found. Please refresh the page and try again.');
      return;
    }

    const hideElements = element.querySelectorAll('.pdf-hide');
    const hideInputs = element.querySelectorAll('.pdf-hide-input, input');
    const showTexts = element.querySelectorAll('.pdf-export-text');
    const logoImg = element.querySelector('#company-logo') as HTMLImageElement;
    const letterheadImg = element.querySelector('#letterhead-image') as HTMLImageElement;
    const sectionFooters = element.querySelectorAll('.pdf-section-footer');
    const sectionWrappers = element.querySelectorAll('.pdf-section');

    try {
      element.classList.add('pdf-mode');

      hideElements.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });

      hideInputs.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });

      showTexts.forEach((el) => {
        (el as HTMLElement).style.display = 'block';
      });

      sectionFooters.forEach((el) => {
        (el as HTMLElement).style.pageBreakInside = 'avoid';
        (el as HTMLElement).style.breakInside = 'avoid';
        (el as HTMLElement).style.pageBreakBefore = 'avoid';
      });

      sectionWrappers.forEach((el) => {
        (el as HTMLElement).style.pageBreakInside = 'auto';
        (el as HTMLElement).style.breakInside = 'auto';
      });

      const sectionHeaders = element.querySelectorAll('.pdf-section-header');
      sectionHeaders.forEach((el) => {
        (el as HTMLElement).style.pageBreakInside = 'avoid';
        (el as HTMLElement).style.breakInside = 'avoid';
        (el as HTMLElement).style.pageBreakAfter = 'avoid';
        (el as HTMLElement).style.breakAfter = 'avoid';
      });

      if (logoImg && logoDataUrl) {
        logoImg.src = logoDataUrl;
        logoImg.style.display = 'block';
        logoImg.style.visibility = 'visible';
      }

      if (letterheadImg && letterheadDataUrl) {
        letterheadImg.src = letterheadDataUrl;
        letterheadImg.style.display = 'block';
        letterheadImg.style.visibility = 'visible';
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const opt = {
        margin: [10, 10, 15, 10],
        filename: `${document.document_number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: false,
          allowTaint: true,
          logging: false,
          windowWidth: 1200,
          imageTimeout: 0,
          backgroundColor: '#ffffff',
          removeContainer: true
        },
        jsPDF: {
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true
        },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.pdf-section-header', '.pdf-section-footer'] }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      element.classList.remove('pdf-mode');

      if (logoImg && companySettings?.logo_url) {
        logoImg.src = companySettings.logo_url;
        logoImg.style.display = '';
        logoImg.style.visibility = '';
      }

      if (letterheadImg && companySettings?.letterhead_url) {
        letterheadImg.src = companySettings.letterhead_url;
        letterheadImg.style.display = '';
        letterheadImg.style.visibility = '';
      }

      hideElements.forEach((el) => {
        (el as HTMLElement).style.display = '';
      });
      hideInputs.forEach((el) => {
        (el as HTMLElement).style.display = '';
      });
      showTexts.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
      sectionFooters.forEach((el) => {
        (el as HTMLElement).style.pageBreakInside = '';
        (el as HTMLElement).style.breakInside = '';
        (el as HTMLElement).style.pageBreakBefore = '';
      });
      sectionWrappers.forEach((el) => {
        (el as HTMLElement).style.pageBreakInside = '';
        (el as HTMLElement).style.breakInside = '';
      });

      element.querySelectorAll('.pdf-section-header').forEach((el) => {
        (el as HTMLElement).style.pageBreakInside = '';
        (el as HTMLElement).style.breakInside = '';
        (el as HTMLElement).style.pageBreakAfter = '';
        (el as HTMLElement).style.breakAfter = '';
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${amount.toLocaleString('en-US', {
      minimumFractionDigits: currencyDecimalPlaces,
      maximumFractionDigits: currencyDecimalPlaces,
    })}`;
  };

  const handleDiscountChange = async (value: number) => {
    setDiscountPercent(value);
    await updateDocument({ discount_percent: value });
  };

  const handleTaxChange = async (value: number) => {
    setTaxPercent(value);
    await updateDocument({ tax_percent: value });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading document...</p>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Document not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print, (min-width: 0px) {
          #pdf-content.pdf-mode {
            font-size: 11px;
          }
          #pdf-content.pdf-mode h1 {
            font-size: 1.5rem;
          }
          #pdf-content.pdf-mode h2,
          #pdf-content.pdf-mode h3 {
            font-size: 0.875rem;
          }
          #pdf-content.pdf-mode .text-sm {
            font-size: 0.75rem;
          }
          #pdf-content.pdf-mode .text-base {
            font-size: 0.875rem;
          }
          #pdf-content.pdf-mode .text-lg {
            font-size: 1rem;
          }
          #pdf-content.pdf-mode .text-xl {
            font-size: 1.125rem;
          }
          #pdf-content.pdf-mode #company-logo {
            height: 2.5rem !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            max-width: 200px !important;
          }
          #pdf-content.pdf-mode img:not(#letterhead-image) {
            height: 2.5rem !important;
          }
          #pdf-content.pdf-mode #letterhead-container {
            margin-left: 0 !important;
            margin-right: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 8mm !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            max-height: 80mm !important;
          }
          #pdf-content.pdf-mode #letterhead-image {
            width: 100% !important;
            height: auto !important;
            max-height: 80mm !important;
            object-fit: cover !important;
            object-position: top !important;
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            margin: 0 !important;
          }
          #pdf-content.pdf-mode table {
            font-size: 0.75rem;
          }
          #pdf-content.pdf-mode .space-y-2 > * + * {
            margin-top: 0.25rem !important;
          }
          #pdf-content.pdf-mode .space-y-3 > * + * {
            margin-top: 0.5rem !important;
          }
          #pdf-content.pdf-mode .mb-4 {
            margin-bottom: 0.75rem !important;
          }
          #pdf-content.pdf-mode .pb-4 {
            padding-bottom: 0.75rem !important;
          }
          #pdf-content.pdf-mode {
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          #pdf-content.pdf-mode .pdf-inner-content {
            padding: 8mm !important;
          }
          #pdf-content.pdf-mode .pdf-section {
            page-break-inside: auto;
            break-inside: auto;
          }
          #pdf-content.pdf-mode .pdf-section-header {
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: avoid;
            break-after: avoid;
          }
          #pdf-content.pdf-mode .pdf-section-footer {
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-before: avoid;
            break-before: avoid;
          }
          #pdf-content.pdf-mode .pdf-section-footer tr {
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-before: avoid;
            break-before: avoid;
          }
          #pdf-content.pdf-mode tbody tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div id="pdf-content" className="bg-white rounded-xl shadow-sm p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6">
          {companySettings?.letterhead_url && (
            <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 mb-6 overflow-hidden rounded-t-xl" id="letterhead-container">
              <img
                id="letterhead-image"
                src={companySettings.letterhead_url}
                alt="Letterhead"
                className="block"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          )}
          <div className="pdf-inner-content">
          <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3 sm:gap-0">
            <div>
              <div className="flex items-center gap-3 mb-3 sm:mb-4 pdf-hide">
                <button
                  onClick={() => navigate(p('/documents'))}
                  className="text-gray-500 hover:text-black text-sm sm:text-base"
                >
                  ← Back
                </button>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wide mb-2 pdf-hide">DOCUMENT OVERVIEW</p>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">{document.document_number}</h1>
            </div>
            <div className="text-right w-full sm:w-auto">
              <p className="text-xs sm:text-sm text-gray-500 uppercase mb-2">DATE OF ISSUE</p>
              {editingDate ? (
                <div className="flex items-center gap-2 mb-3 pdf-hide">
                  <input
                    type="date"
                    value={editDateValue}
                    onChange={(e) => setEditDateValue(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateIssueDate}
                    disabled={savingDate || !editDateValue}
                    className="p-1.5 rounded-md text-green-600 hover:bg-green-50 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingDate(false)}
                    disabled={savingDate}
                    className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-3 sm:justify-end">
                  <p className="text-base sm:text-lg font-medium">
                    {new Date(document.issue_date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <button
                    onClick={() => {
                      setEditDateValue(document.issue_date);
                      setEditingDate(true);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 pdf-hide"
                    title="Edit issue date"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <span className="pdf-hide">
                <StatusBadge status={document.status} />
              </span>
            </div>
          </div>

          {companySettings && (companySettings.company_name || companySettings.logo_url || companySettings.address_line1 || companySettings.phone || companySettings.email) && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div className="space-y-3">
                  {companySettings.logo_url && companySettings.header_display_mode !== 'text' && (
                    <div className="mb-3" id="logo-container">
                      <img
                        id="company-logo"
                        src={companySettings.logo_url}
                        alt={companySettings.company_name || 'Company Logo'}
                        className="h-16 object-contain"
                      />
                    </div>
                  )}

                  {companySettings.company_name && companySettings.header_display_mode !== 'logo' && (
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">{companySettings.company_name}</h3>
                    </div>
                  )}

                  {(companySettings.address_line1 || companySettings.city) && (
                    <div className="text-sm text-gray-700 leading-relaxed pdf-text:text-xs pdf-text:leading-snug">
                      {companySettings.address_line1 && <p>{companySettings.address_line1}</p>}
                      {companySettings.address_line2 && <p>{companySettings.address_line2}</p>}
                      {(companySettings.city || companySettings.state || companySettings.zip_code) && (
                        <p>
                          {[companySettings.city, companySettings.state, companySettings.zip_code].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {companySettings.country && <p>{companySettings.country}</p>}
                    </div>
                  )}

                  {(companySettings.phone || companySettings.email) && (
                    <div className="text-sm text-gray-700 pdf-text:text-xs">
                      {companySettings.phone && <p>{companySettings.phone}</p>}
                      {companySettings.email && <p>{companySettings.email}</p>}
                    </div>
                  )}

                  {companyCustomFields.length > 0 && (
                    <div className="text-sm text-gray-700 pdf-text:text-xs">
                      {companyCustomFields.map((field) => (
                        <p key={field.id}>
                          <span className="font-medium">{field.field_label}:</span> {field.field_value}
                        </p>
                      ))}
                    </div>
                  )}

                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 pdf-hide">CLIENT DETAILS</p>
                    <div className="text-sm text-gray-700 pdf-text:text-xs">
                      <div className="pdf-hide-input space-y-2">
                        <div>
                          <p className="text-xs text-gray-500 uppercase mb-1">Document Type</p>
                          <select
                            value={document.document_type}
                            onChange={(e) => updateDocument({ document_type: e.target.value as 'invoice' | 'quote' })}
                            className="w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm"
                          >
                            <option value="invoice">Invoice</option>
                            <option value="quote">Quote</option>
                          </select>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 uppercase mb-1">Currency</p>
                          <select
                            value={document.currency}
                            onChange={(e) => {
                              const selected = availableCurrencies.find(c => c.code === e.target.value);
                              updateDocument({ currency: e.target.value });
                              if (selected) {
                                setCurrencySymbol(selected.symbol);
                                setCurrencyDecimalPlaces(selected.decimal_places ?? 2);
                              }
                            }}
                            className="w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm"
                          >
                            {availableCurrencies.map(c => (
                              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 uppercase mb-1">Customer</p>
                          <select
                            value={document.customer_id || ''}
                            onChange={(e) => {
                              const selectedId = e.target.value || null;
                              const selected = availableCustomers.find(c => c.id === selectedId);
                              updateDocument({ customer_id: selectedId });
                              setCustomerName(selected?.name || '');
                            }}
                            className="w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm"
                          >
                            <option value="">— No customer —</option>
                            {availableCustomers.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pdf-hide">
                    {clientCustomFields.length > 0 ? (
                      <div className="space-y-3">
                        {clientCustomFields.map((field) => (
                          <div key={field.id} className="relative">
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <label className="text-xs text-gray-500 uppercase block mb-1">
                                  <input
                                    type="text"
                                    value={field.field_label}
                                    onChange={(e) =>
                                      updateClientCustomFieldLocally(field.id, { field_label: e.target.value })
                                    }
                                    onBlur={(e) =>
                                      updateClientCustomFieldInDB(field.id, { field_label: e.target.value })
                                    }
                                    placeholder="Field name"
                                    className="w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-black rounded px-1 text-xs text-gray-500 uppercase"
                                  />
                                </label>
                                <input
                                  type="text"
                                  value={field.field_value || ''}
                                  onChange={(e) =>
                                    updateClientCustomFieldLocally(field.id, { field_value: e.target.value })
                                  }
                                  onBlur={(e) =>
                                    updateClientCustomFieldInDB(field.id, { field_value: e.target.value })
                                  }
                                  placeholder="Enter value"
                                  className="w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm"
                                />
                              </div>
                              <button
                                onClick={() => deleteClientCustomField(field.id)}
                                className="text-red-500 hover:text-red-700 p-2 mt-6"
                                title="Delete field"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <button
                      onClick={addClientCustomField}
                      className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors w-full mt-3"
                    >
                      <Plus className="w-4 h-4" />
                      ADD CUSTOM FIELD
                    </button>
                  </div>
                </div>
              </div>
              <div className="pdf-export-text hidden" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 20px' }}>
                  <p style={{ fontSize: '11px', color: '#374151', margin: 0 }}>
                    <span style={{ fontWeight: 600 }}>Document Type:</span> <span style={{ textTransform: 'capitalize' }}>{document.document_type}</span>
                  </p>
                  <p style={{ fontSize: '11px', color: '#374151', margin: 0 }}>
                    <span style={{ fontWeight: 600 }}>Customer:</span> {customerName || 'No customer selected'}
                  </p>
                  {clientCustomFields.map((field) => (
                    <p key={field.id} style={{ fontSize: '11px', color: '#374151', margin: 0 }}>
                      <span style={{ fontWeight: 600 }}>{field.field_label}:</span> {field.field_value || '-'}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.id} className="mb-6 pt-6 first:pt-0 pdf-section">
              {section.hide_header ? (
                <div className="pdf-hide flex items-center gap-2 mb-3 pb-2 border-b border-dashed border-gray-300">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Section header hidden</span>
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from('document_sections').update({ hide_header: false }).eq('id', section.id);
                      if (!error) setSections(prev => prev.map(s => s.id === section.id ? { ...s, hide_header: false } : s));
                    }}
                    className="text-xs text-gray-500 hover:text-black underline"
                  >
                    Restore header
                  </button>
                  <button
                    onClick={() => setDeleteSectionModal({ sectionId: section.id, sectionName: section.name })}
                    className="text-xs text-red-400 hover:text-red-600 underline ml-auto"
                  >
                    Delete entire section
                  </button>
                </div>
              ) : (
              <div className="pdf-section-header flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 border-b-2 border-black pb-2 gap-2 sm:gap-0">
                <div className="text-lg font-bold uppercase w-full sm:w-auto">
                  <span className="pdf-export-text hidden">{section.name}</span>
                  <input
                    type="text"
                    value={section.name}
                    onChange={(e) => updateSectionNameLocally(section.id, e.target.value)}
                    onBlur={(e) => updateSectionNameInDB(section.id, e.target.value)}
                    className="pdf-hide-input bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full sm:w-auto"
                  />
                </div>
                <div className="flex items-center gap-2 pdf-hide">
                  {isGroupingMode === section.id ? (
                    <>
                      <button
                        onClick={createGroup}
                        disabled={selectedItemsForGrouping.size < 2}
                        className="text-xs sm:text-sm text-white bg-black hover:bg-gray-800 disabled:bg-gray-400 px-3 py-1.5 rounded flex items-center gap-1 whitespace-nowrap"
                      >
                        <Link className="w-3 h-3 sm:w-4 sm:h-4" />
                        GROUP SELECTED ({selectedItemsForGrouping.size})
                      </button>
                      <button
                        onClick={cancelGrouping}
                        className="text-xs sm:text-sm text-gray-500 hover:text-black flex items-center gap-1 whitespace-nowrap"
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startGrouping(section.id)}
                        className="text-xs sm:text-sm text-gray-500 hover:text-black flex items-center gap-1 whitespace-nowrap"
                      >
                        <Link className="w-3 h-3 sm:w-4 sm:h-4" />
                        INCLUSIVE
                      </button>
                      <button
                        onClick={() => addLineItem(section.id)}
                        className="text-xs sm:text-sm text-gray-500 hover:text-black flex items-center gap-1 whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                        ADD LINE ITEM
                      </button>
                      <button
                        onClick={() => setDeleteSectionModal({ sectionId: section.id, sectionName: section.name })}
                        className="text-xs sm:text-sm text-red-500 hover:text-red-700 flex items-center gap-1 whitespace-nowrap"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        DELETE SECTION
                      </button>
                    </>
                  )}
                </div>
              </div>
              )}

              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-4">
                {section.items.map((item, itemIndex) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 uppercase block mb-1">Description</label>
                        <div className="pdf-export-text hidden whitespace-pre-wrap">{item.description}</div>
                        <textarea
                          value={item.description}
                          onChange={(e) =>
                            updateLineItemWithDebounce(item.id, { description: e.target.value })
                          }
                          rows={3}
                          className="pdf-hide-input w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm resize-y"
                        />
                      </div>
                      <div className="pdf-hide flex flex-col gap-1">
                        <button
                          onClick={() => moveLineItem(item.id, 'up')}
                          disabled={itemIndex === 0}
                          className="text-gray-500 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed p-1"
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveLineItem(item.id, 'down')}
                          disabled={itemIndex === section.items.length - 1}
                          className="text-gray-500 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed p-1"
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteLineItem(item.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete line item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase block mb-1">Units</label>
                        <div className="pdf-export-text hidden">{item.units}</div>
                        <input
                          type="number"
                          value={item.units}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateLineItemWithDebounce(item.id, { units: value });
                          }}
                          className="pdf-hide-input w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase block mb-1">Days</label>
                        <div className="pdf-export-text hidden">{item.days}</div>
                        <input
                          type="number"
                          value={item.days}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateLineItemWithDebounce(item.id, { days: value });
                          }}
                          className="pdf-hide-input w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase block mb-1">Unit Cost ({currencySymbol})</label>
                        <div className="pdf-export-text hidden">{currencySymbol}{item.unit_cost.toFixed(currencyDecimalPlaces)}</div>
                        <input
                          type="number"
                          value={item.unit_cost}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateLineItemWithDebounce(item.id, { unit_cost: value });
                          }}
                          className="pdf-hide-input w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-xs text-gray-500 uppercase font-medium">Total</span>
                      <span className="text-lg font-bold">{formatCurrency(item.units * item.days * item.unit_cost)}</span>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase block mb-1">Remarks</label>
                      <div className="pdf-export-text hidden text-sm italic text-gray-600">{item.remarks || ''}</div>
                      <input
                        type="text"
                        value={item.remarks || ''}
                        onChange={(e) =>
                          updateLineItemWithDebounce(item.id, { remarks: e.target.value })
                        }
                        placeholder="e.g., Complimentary"
                        className="pdf-hide-input w-full bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-2 text-sm italic text-gray-600"
                      />
                    </div>
                  </div>
                ))}
                <div className="space-y-3 pt-4 border-t-2 border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Base Subtotal
                    </span>
                    <span className="text-base font-medium">
                      {formatCurrency(calculateSectionSubtotal(section))}
                    </span>
                  </div>
                  <div className={`flex justify-between items-center gap-3${(section.units_multiplier || 1) === 1 ? ' pdf-hide' : ''}`}>
                    <label className="text-xs text-gray-500 uppercase tracking-wide">
                      Units / Multiplier
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">×</span>
                      <div className="pdf-export-text hidden">{section.units_multiplier || 1}</div>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={section.units_multiplier || 1}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 1;
                          updateSectionMultiplierLocally(section.id, value);
                        }}
                        onBlur={(e) => {
                          const value = parseFloat(e.target.value) || 1;
                          updateSectionMultiplierInDB(section.id, value);
                        }}
                        className="pdf-hide-input w-20 bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-1 text-sm text-right"
                      />
                    </div>
                  </div>
                  {!section.hide_header && (
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Section Total
                    </span>
                    <span className="text-xl font-bold">
                      {formatCurrency(calculateSectionSubtotal(section) * (section.units_multiplier || 1))}
                    </span>
                  </div>
                  )}
                </div>
              </div>

              {/* Desktop Table View */}
              <table className="w-full hidden sm:table" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  {isGroupingMode === section.id && <col style={{ width: '4%' }} />}
                  <col style={{ width: isGroupingMode === section.id ? '26%' : '30%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '6%' }} />
                </colgroup>
                <thead className="pdf-section-header">
                  <tr className="text-xs text-gray-500 uppercase tracking-wide">
                    {isGroupingMode === section.id && <th className="text-center pb-3 font-medium">Select</th>}
                    <th className="text-left pb-3 font-medium">Description</th>
                    <th className="text-center pb-3 font-medium">Units</th>
                    <th className="text-center pb-3 font-medium">Days</th>
                    <th className="text-right pb-3 font-medium pr-2">Unit Cost</th>
                    <th className="text-left pb-3 font-medium pl-3 border-l-2 border-gray-200 text-xs">Remarks</th>
                    <th className="text-right pb-3 font-medium pr-2">Total</th>
                    <th className="text-center pb-3 font-medium pdf-hide"></th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item, itemIndex) => {
                    const isInGroup = item.group_id !== null;
                    const isGroupParent = item.is_group_parent;
                    const groupedItems = isInGroup ? section.items.filter(i => i.group_id === item.group_id) : [];
                    const parentItem = isInGroup ? section.items.find(i => i.group_id === item.group_id && i.is_group_parent) : null;

                    let totalCost = 0;
                    if (isInGroup && parentItem) {
                      totalCost = parentItem.days * parentItem.unit_cost;
                    } else if (!isInGroup) {
                      totalCost = item.units * item.days * item.unit_cost;
                    }

                    return (
                    <tr key={item.id} className={`border-t border-gray-100 ${isInGroup ? 'bg-blue-50/30' : ''}`}>
                      {isGroupingMode === section.id && (
                        <td className="py-3 text-center pdf-hide">
                          <input
                            type="checkbox"
                            checked={selectedItemsForGrouping.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            disabled={isInGroup}
                            className="w-4 h-4"
                          />
                        </td>
                      )}
                      <td className="py-3 break-words text-sm">
                        <div className="flex items-center gap-2">
                          {isInGroup && !isGroupParent && <span className="text-gray-400">↳</span>}
                          <div className="flex-1">
                            <div className="pdf-export-text hidden whitespace-pre-wrap">{item.description}</div>
                            <textarea
                              value={item.description}
                              onChange={(e) =>
                                updateLineItemWithDebounce(item.id, { description: e.target.value })
                              }
                              rows={2}
                              className="pdf-hide-input w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-black rounded px-2 py-1 resize-y min-h-[2.5rem]"
                            />
                          </div>
                          {isGroupParent && (
                            <button
                              onClick={() => ungroupItems(item.group_id!)}
                              className="pdf-hide text-gray-500 hover:text-red-600 p-1"
                              title="Ungroup items"
                            >
                              <Unlink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-center text-sm">
                        <div className="pdf-export-text hidden text-center">{item.units}</div>
                        <input
                          type="number"
                          value={item.units}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateLineItemWithDebounce(item.id, { units: value });
                          }}
                          className="pdf-hide-input w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-black rounded px-2 py-1 text-center"
                        />
                      </td>
                      <td className="py-3 text-center text-sm">
                        <div className="pdf-export-text hidden text-center">{item.days}</div>
                        <input
                          type="number"
                          value={item.days}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateLineItemWithDebounce(item.id, { days: value });
                          }}
                          className="pdf-hide-input w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-black rounded px-2 py-1 text-center"
                        />
                      </td>
                      <td className="py-3 text-right pr-2 text-sm">
                        {isInGroup && !isGroupParent ? (
                          <span className="text-xs text-gray-400 italic">Combined Price</span>
                        ) : (
                          <>
                            <div className="pdf-export-text hidden text-right">{formatCurrency(item.unit_cost)}</div>
                            {editingUnitCostId === item.id ? (
                              <input
                                type="number"
                                autoFocus
                                value={item.unit_cost}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  updateLineItemWithDebounce(item.id, { unit_cost: value });
                                  if (isGroupParent && item.group_id) {
                                    section.items
                                      .filter(i => i.group_id === item.group_id && i.id !== item.id)
                                      .forEach(i => updateLineItemWithDebounce(i.id, { unit_cost: value }));
                                  }
                                }}
                                onBlur={() => setEditingUnitCostId(null)}
                                className="pdf-hide-input w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-black rounded px-2 py-1 text-right"
                              />
                            ) : (
                              <div
                                className="pdf-hide-input w-full cursor-text text-right px-2 py-1 hover:bg-gray-50 rounded"
                                onClick={() => setEditingUnitCostId(item.id)}
                              >
                                {formatCurrency(item.unit_cost)}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-3 pl-3 border-l-2 border-gray-200 break-words text-xs">
                        <div className="pdf-export-text hidden text-xs italic text-gray-600">{item.remarks || ''}</div>
                        <input
                          type="text"
                          value={item.remarks || ''}
                          onChange={(e) =>
                            updateLineItemWithDebounce(item.id, { remarks: e.target.value })
                          }
                          placeholder="e.g., Complimentary"
                          className="pdf-hide-input w-full bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-black rounded px-1 py-1 text-xs italic text-gray-600 break-words overflow-wrap-break-word"
                        />
                      </td>
                      <td className="py-3 text-right font-medium pr-2 text-sm">
                        {isInGroup && !isGroupParent ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          formatCurrency(totalCost)
                        )}
                      </td>
                      <td className="py-3 text-center pdf-hide">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => moveLineItem(item.id, 'up')}
                            disabled={itemIndex === 0}
                            className="text-gray-500 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed p-1"
                            title="Move up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveLineItem(item.id, 'down')}
                            disabled={itemIndex === section.items.length - 1}
                            className="text-gray-500 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed p-1"
                            title="Move down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteLineItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete line item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
                {!section.hide_header && <tbody className="pdf-section-footer">
                  <tr className={(section.units_multiplier || 1) === 1 ? 'pdf-hide border-t border-gray-200' : 'border-t border-gray-200'} style={{ pageBreakInside: 'avoid', breakInside: 'avoid', pageBreakBefore: 'avoid', breakBefore: 'avoid' }}>
                    {isGroupingMode === section.id && <td></td>}
                    <td colSpan={5} className="py-2 text-right text-xs uppercase tracking-wide text-gray-500 pr-2">
                      Base Subtotal
                    </td>
                    <td className="py-2 text-right font-medium text-sm pr-2 whitespace-nowrap">
                      {formatCurrency(calculateSectionSubtotal(section))}
                    </td>
                    <td className="py-2 pdf-hide"></td>
                  </tr>
                  <tr className={(section.units_multiplier || 1) === 1 ? 'pdf-hide' : ''} style={{ pageBreakInside: 'avoid', breakInside: 'avoid', pageBreakBefore: 'avoid', breakBefore: 'avoid' }}>
                    {isGroupingMode === section.id && <td></td>}
                    <td colSpan={5} className="py-2 text-right text-xs uppercase tracking-wide text-gray-500 pr-2">
                      Units / Multiplier
                    </td>
                    <td className="py-2 text-right pr-2">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm">×</span>
                        <div className="pdf-export-text hidden">{section.units_multiplier || 1}</div>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={section.units_multiplier || 1}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 1;
                            updateSectionMultiplierLocally(section.id, value);
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 1;
                            updateSectionMultiplierInDB(section.id, value);
                          }}
                          className="pdf-hide-input w-20 bg-transparent border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black rounded px-3 py-1 text-sm text-right"
                        />
                      </div>
                    </td>
                    <td className="py-2 pdf-hide"></td>
                  </tr>
                  <tr className="border-t-2 border-gray-300" style={{ pageBreakInside: 'avoid', breakInside: 'avoid', pageBreakBefore: 'avoid', breakBefore: 'avoid' }}>
                    {isGroupingMode === section.id && <td></td>}
                    <td colSpan={5} className="py-3 text-right font-semibold text-sm uppercase tracking-wide text-gray-700 pr-2">
                      Section Total
                    </td>
                    <td className="py-3 text-right font-bold text-base pr-2 whitespace-nowrap">
                      {formatCurrency(calculateSectionSubtotal(section) * (section.units_multiplier || 1))}
                    </td>
                    <td className="py-3 pdf-hide"></td>
                  </tr>
                </tbody>}
              </table>
            </div>
          ))}

          <button
            onClick={addSection}
            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors mb-6 sm:mb-8 pdf-hide w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            ADD NEW SECTION
          </button>

          <div className="border-t-2 border-black pt-6">
            <div className="flex justify-between max-w-full sm:max-w-md sm:ml-auto space-y-3 flex-col">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 uppercase tracking-wide">Subtotal</span>
                <span className="text-xl font-bold whitespace-nowrap">{formatCurrency(subtotal)}</span>
              </div>

              {showDiscount ? (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-500 uppercase tracking-wide">Discount</span>
                  <span className="pdf-export-text hidden text-sm text-center">{discountPercent}</span>
                  <input
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                    onBlur={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                    className="pdf-hide-input w-14 sm:w-16 px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm text-center min-h-[44px] sm:min-h-0"
                  />
                  <span className="text-sm text-gray-500">%</span>
                  <button
                    onClick={async () => {
                      setShowDiscount(false);
                      setDiscountPercent(0);
                      await handleDiscountChange(0);
                    }}
                    className="pdf-hide ml-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove discount"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-base font-medium text-red-600 whitespace-nowrap">
                  -{formatCurrency(discount)}
                </span>
              </div>
              ) : (
              <div className="pdf-hide flex justify-end">
                <button
                  onClick={() => setShowDiscount(true)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Discount
                </button>
              </div>
              )}

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-500 uppercase tracking-wide">Tax</span>
                  <span className="pdf-export-text hidden text-sm text-center">{taxPercent}</span>
                  <input
                    type="number"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                    onBlur={(e) => handleTaxChange(parseFloat(e.target.value) || 0)}
                    className="pdf-hide-input w-14 sm:w-16 px-2 py-1 border border-gray-300 rounded text-xs sm:text-sm text-center min-h-[44px] sm:min-h-0"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <span className="text-base font-medium whitespace-nowrap">{formatCurrency(tax)}</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t-2 border-black">
                <span className="text-sm uppercase tracking-wider font-bold">Grand Total</span>
                <div className="text-right">
                  <div className="text-xl font-bold whitespace-nowrap">{formatCurrency(grandTotal)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div>
              <label className="block text-base font-semibold text-gray-900 mb-3 uppercase">Terms</label>
              <div className="pdf-export-text hidden">
                <p className="text-xs text-gray-600 leading-snug whitespace-pre-wrap">
                  {document.administrative_notes}
                </p>
              </div>
              <textarea
                value={document.administrative_notes || ''}
                onChange={(e) => updateDocument({ administrative_notes: e.target.value })}
                placeholder="Add banking details, payment instructions, or any custom notes..."
                rows={4}
                className="pdf-hide-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm text-gray-700 resize-y"
              />
            </div>
          </div>

          {document.document_type === 'invoice' && (
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t-2 border-gray-200 pdf-hide">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
                <h3 className="text-lg sm:text-xl font-bold">Payment History</h3>
                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  disabled={remainingBalance === 0}
                  className="w-full sm:w-auto"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Record Payment
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-1">Total Invoice</p>
                  <p className="text-xl sm:text-2xl font-bold">{formatCurrency(grandTotal)}</p>
                </div>
                <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-1">Total Paid</p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                </div>
                <div className="bg-orange-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase mb-1">Remaining Balance</p>
                  <p className="text-xl sm:text-2xl font-bold text-orange-600">{formatCurrency(remainingBalance)}</p>
                </div>
              </div>

              {payments.length > 0 ? (
                <>
                  {/* Mobile Card View */}
                  <div className="block sm:hidden space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-xs text-gray-500 uppercase">Date</p>
                            <p className="text-sm font-medium">
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="text-right">
                              <p className="text-xs text-gray-500 uppercase">Amount</p>
                              <p className="text-lg font-bold text-green-600">
                                {formatCurrency(payment.amount)}
                              </p>
                            </div>
                            <button
                              onClick={() => openEditPayment(payment)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors mt-0.5"
                              title="Edit payment"
                            >
                              <SquarePen className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletePaymentModal({ payment, isDeleting: false })}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors mt-0.5"
                              title="Delete payment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-100 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-500">Account:</span>
                            <span className="text-sm text-gray-900">{payment.account_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-500">Method:</span>
                            <span className="text-sm text-gray-900">{payment.payment_method.replace('_', ' ')}</span>
                          </div>
                          {payment.reference_number && (
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">Reference:</span>
                              <span className="text-sm text-gray-900">{payment.reference_number}</span>
                            </div>
                          )}
                          {payment.notes && (
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">Notes:</span>
                              <span className="text-sm text-gray-900">{payment.notes}</span>
                            </div>
                          )}
                          {payment.attachments && payment.attachments.length > 0 && (
                            <div className="pt-2 mt-1 border-t border-gray-100">
                              <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                Attachments ({payment.attachments.length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {payment.attachments.map((att) => {
                                  const isImage = att.file_type.startsWith('image/');
                                  return (
                                    <a
                                      key={att.id}
                                      href={att.signed_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 transition-colors max-w-[180px]"
                                    >
                                      {isImage ? (
                                        <img src={att.signed_url} alt={att.file_name} className="w-4 h-4 object-cover rounded flex-shrink-0" />
                                      ) : (
                                        <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                                      )}
                                      <span className="truncate">{att.file_name}</span>
                                      <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attachments</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-gray-50 align-top">
                            <td className="px-4 py-3 text-sm">
                              {new Date(payment.payment_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{payment.account_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {payment.payment_method.replace('_', ' ')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {payment.reference_number || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {payment.notes || '-'}
                            </td>
                            <td className="px-4 py-3">
                              {payment.attachments && payment.attachments.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {payment.attachments.map((att) => {
                                    const isImage = att.file_type.startsWith('image/');
                                    return (
                                      <a
                                        key={att.id}
                                        href={att.signed_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 transition-colors max-w-[160px]"
                                        title={att.file_name}
                                      >
                                        {isImage ? (
                                          <img src={att.signed_url} alt={att.file_name} className="w-4 h-4 object-cover rounded flex-shrink-0" />
                                        ) : (
                                          <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                                        )}
                                        <span className="truncate">{att.file_name}</span>
                                        <ExternalLink className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                      </a>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openEditPayment(payment)}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                  title="Edit payment"
                                >
                                  <SquarePen className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeletePaymentModal({ payment, isDeleting: false })}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete payment"
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
                </>
              ) : (
                <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
                  <p className="text-sm sm:text-base text-gray-500 mb-4">No payments recorded yet</p>
                  <Button onClick={() => setIsPaymentModalOpen(true)} className="w-full sm:w-auto">
                    Record First Payment
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex justify-end">
              <Button onClick={exportPDF} className="pdf-hide w-full sm:w-auto">
                <FileDown className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
          </div>
        </div>

        <PaymentModal
          isOpen={isPaymentModalOpen}
          documentId={document?.id || ''}
          documentCurrency={document?.currency || 'USD'}
          remainingAmount={remainingBalance}
          onClose={closePaymentModal}
          onPaymentAdded={handlePaymentAdded}
          editPayment={editingPayment}
        />

        <DeleteModal
          isOpen={!!deletePaymentModal.payment}
          title="Delete Payment"
          message="Are you sure you want to delete this payment? The account balance will be adjusted accordingly."
          itemName=""
          isLoading={deletePaymentModal.isDeleting}
          onConfirm={handleConfirmDeletePayment}
          onCancel={() => setDeletePaymentModal({ payment: null, isDeleting: false })}
        />

        {deleteSectionModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Remove Section</h2>
                <p className="text-sm text-gray-500 mt-1">
                  What would you like to do with <span className="font-semibold text-gray-700">{deleteSectionModal.sectionName}</span>?
                </p>
              </div>
              <div className="p-6 space-y-3">
                <button
                  onClick={async () => {
                    await removeSectionHeaderOnly(deleteSectionModal.sectionId);
                    setDeleteSectionModal(null);
                  }}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
                      <X className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-800">Remove section header only</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Keep all line items. The section title and section total are hidden — the invoice becomes a simple flat list with Description, Unit, Days, Unit Cost, Remarks, and Total.
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={async () => {
                    await deleteSection(deleteSectionModal.sectionId);
                    setDeleteSectionModal(null);
                  }}
                  className="w-full text-left p-4 rounded-lg border border-red-100 hover:border-red-300 hover:bg-red-50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-50 group-hover:bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-red-700">Delete entire section</div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Permanently removes the section and all its line items. This cannot be undone.
                      </div>
                    </div>
                  </div>
                </button>
              </div>
              <div className="px-6 pb-6">
                <button
                  onClick={() => setDeleteSectionModal(null)}
                  className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
