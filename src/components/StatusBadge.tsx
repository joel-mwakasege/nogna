type Status = 'draft' | 'unpaid' | 'paid' | 'partially_paid' | 'overdue' | 'active' | 'inactive';

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusStyle = (status: Status) => {
    const baseStyle = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wide';

    switch (status) {
      case 'paid':
      case 'active':
        return `${baseStyle} bg-green-50 text-green-700 border border-green-200`;
      case 'unpaid':
        return `${baseStyle} bg-amber-50 text-amber-700 border border-amber-200`;
      case 'overdue':
        return `${baseStyle} bg-red-50 text-red-700 border border-red-200`;
      case 'partially_paid':
        return `${baseStyle} bg-sky-50 text-sky-700 border border-sky-200`;
      case 'draft':
      case 'inactive':
      default:
        return `${baseStyle} bg-slate-50 text-slate-700 border border-slate-200`;
    }
  };

  const icons = {
    draft: '○',
    unpaid: '●',
    paid: '●',
    partially_paid: '◐',
    overdue: '●',
    active: '●',
    inactive: '○',
  };

  const labels = {
    draft: 'Draft',
    unpaid: 'Unpaid',
    paid: 'Full Paid',
    partially_paid: 'Partial Paid',
    overdue: 'Overdue',
    active: 'Active',
    inactive: 'Inactive',
  };

  return (
    <span className={getStatusStyle(status)}>
      <span className="text-xs">{icons[status]}</span>
      {labels[status]}
    </span>
  );
}
