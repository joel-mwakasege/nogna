const fetchOutstandingData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    let query = supabase
      .from('outstanding_invoices_view')
      .select('*')
      .eq('company_id', companyId)
      .gte('issue_date', from)
      .lte('issue_date', to);

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    const documentIds = (!error && data) ? (data as any[]).map(d => d.document_id || d.id).filter(Boolean) : [];
    const docNumberMap: Record<string, string> = {};

    if (documentIds.length > 0) {
      // Direct lookup on documents table to get exact auto/manual invoice numbers
      const { data: rawDocs } = await supabase
        .from('documents')
        .select('id, document_number, invoice_number, number, doc_number, prefix')
        .in('id', documentIds);

      if (rawDocs) {
        (rawDocs as any[]).forEach(d => {
          let num = d.document_number || d.invoice_number || d.number || d.doc_number || '';
          if (d.prefix && num && !String(num).startsWith(d.prefix)) {
            num = `${d.prefix}${num}`;
          }
          if (num) docNumberMap[d.id] = String(num);
        });
      }
    }

    if (!error && data && data.length > 0) {
      const formatted = (data as any[]).map(d => {
        const docId = d.document_id || d.id || '';
        const resolvedNumber = docNumberMap[docId] || d.document_number || d.invoice_number || d.number || d.doc_number || d.document_no || '—';
        return {
          document_id: docId,
          document_number: resolvedNumber,
          customer_name: d.customer_name || d.name || d.client_name || '—',
          customer_email: d.customer_email || d.email || '',
          currency: d.currency || 'TZS',
          issue_date: d.issue_date || d.date || d.created_at || '',
          status: d.status || 'unpaid',
          days_outstanding: Number(d.days_outstanding ?? d.days_overdue ?? (d.issue_date ? Math.max(0, Math.floor((new Date().getTime() - new Date(d.issue_date).getTime()) / (1000 * 60 * 60 * 24))) : 0)),
          amount_due: Number(d.amount_due ?? d.total_amount ?? d.total ?? 0),
          amount_paid: Number(d.amount_paid ?? d.paid ?? d.paid_amount ?? 0),
          balance_due: Number(d.balance_due ?? d.balance ?? d.outstanding_amount ?? (Number(d.total_amount || 0) - Number(d.paid || 0)))
        };
      });
      setOutstandingData(formatted);
    }
  };

  const fetchDocumentData = async (from = dateFrom, to = dateTo, currency = selectedCurrency) => {
    if (!companyId) return;
    let query = supabase
      .from('document_totals_view')
      .select('*')
      .eq('document_type', 'invoice')
      .eq('company_id', companyId)
      .gte('issue_date', from)
      .lte('issue_date', to)
      .order('issue_date', { ascending: false });

    if (currency !== 'all') {
      query = query.eq('currency', currency);
    }

    const { data, error } = await query;
    if (!error && data) {
      const documentIds = (data as any[]).map(d => d.document_id || d.id).filter(Boolean);
      const customFieldsMap: Record<string, { project?: string; location?: string }> = {};
      const paymentsMap: Record<string, number> = {};
      const paymentsListMap: Record<string, Array<{ date: string; amount: number }>> = {};
      const docNumberMap: Record<string, string> = {};

      if (documentIds.length > 0) {
        const { data: rawDocs } = await supabase
          .from('documents')
          .select('id, document_number, invoice_number, number, doc_number, prefix')
          .in('id', documentIds);

        if (rawDocs) {
          (rawDocs as any[]).forEach(d => {
            let num = d.document_number || d.invoice_number || d.number || d.doc_number || '';
            if (d.prefix && num && !String(num).startsWith(d.prefix)) {
              num = `${d.prefix}${num}`;
            }
            if (num) docNumberMap[d.id] = String(num);
          });
        }

        const { data: customFields } = await supabase
          .from('client_custom_fields')
          .select('document_id, field_label, field_value')
          .in('document_id', documentIds);

        if (customFields) {
          (customFields as any[]).forEach(field => {
            const label = field.field_label.trim().toLowerCase();
            const docId = field.document_id;
            if (!customFieldsMap[docId]) customFieldsMap[docId] = {};
            if (['project/events', 'project/event', 'project', 'event'].includes(label)) {
              customFieldsMap[docId].project = field.field_value || '';
            } else if (label === 'location') {
              customFieldsMap[docId].location = field.field_value || '';
            }
          });
        }

        const { data: payments } = await supabase
          .from('payments')
          .select('document_id, amount, payment_date')
          .in('document_id', documentIds)
          .is('deleted_at', null);

        if (payments) {
          (payments as any[]).forEach(payment => {
            const docId = payment.document_id;
            paymentsMap[docId] = (paymentsMap[docId] || 0) + Number(payment.amount);
            if (!paymentsListMap[docId]) paymentsListMap[docId] = [];
            paymentsListMap[docId].push({
              date: payment.payment_date,
              amount: Number(payment.amount)
            });
          });
        }
      }

      const enrichedData = (data as any[]).map(doc => {
        const docId = doc.document_id || doc.id;
        const project = customFieldsMap[docId]?.project || '';
        const location = customFieldsMap[docId]?.location || '';
        const paid = paymentsMap[docId] || 0;
        const balance = (Number(doc.total_amount) || 0) - paid;
        const resolvedDocNumber = docNumberMap[docId] || doc.document_number || doc.invoice_number || doc.number || doc.doc_number || doc.document_no || '—';

        return {
          ...doc,
          document_id: docId,
          document_number: resolvedDocNumber,
          project_events: project,
          location: location,
          paid: paid,
          balance: balance,
          payment_history: paymentsListMap[docId] || []
        } as DocumentTotal;
      });

      setDocumentData(enrichedData);
    }
  };
