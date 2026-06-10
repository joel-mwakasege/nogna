import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, FileText, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export function QuickCreateFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const p = (path: string) => `/${slug}${path}`;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end" ref={menuRef}>
      <style>{`
        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-slide-up-fade {
          animation: slideUpFade 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="mb-3 w-56 rounded-2xl shadow-2xl border py-2 flex flex-col animate-slide-up-fade overflow-hidden backdrop-blur-md"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-card) 80%, transparent)',
            borderColor: 'color-mix(in srgb, var(--theme-border) 50%, transparent)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div 
            className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            Quick Create
          </div>
          <div className="h-px my-1" style={{ backgroundColor: 'var(--theme-border)' }}></div>
          
          <button
            onClick={() => handleAction(p('/documents/new'))}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[var(--theme-body-bg)] transition-colors text-left w-full"
          >
            <FileText className="w-4 h-4 text-blue-500" />
            <span>Create Invoice</span>
          </button>
          
          <button
            onClick={() => handleAction(p('/expenses/create'))}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[var(--theme-body-bg)] transition-colors text-left w-full"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-500" />
            <span>Create Expense</span>
          </button>
          
          <button
            onClick={() => handleAction(p('/deposits/create'))}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-[var(--theme-body-bg)] transition-colors text-left w-full"
          >
            <ArrowDownLeft className="w-4 h-4 text-green-500" />
            <span>Create Deposit</span>
          </button>
        </div>
      )}

      {/* Trigger FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 themed-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
        aria-label="Quick Create Menu"
        aria-expanded={isOpen}
      >
        <Plus className={`w-6 h-6 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
      </button>
    </div>
  );
}
