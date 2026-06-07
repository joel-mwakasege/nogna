import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Users, Receipt, BarChart3 } from 'lucide-react';
import { CustomerList } from './CustomerList';
import { InvoiceList } from './InvoiceList';
import Reports from './Reports';

type TabType = 'customers' | 'invoices' | 'reports';

const VALID_TABS: TabType[] = ['customers', 'invoices', 'reports'];

export default function Customers() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const tabParam = new URLSearchParams(location.search).get('tab') as TabType | null;
  const activeTab: TabType = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'customers';

  const setActiveTab = (tab: TabType) => {
    navigate(tab === 'customers' ? p('/customers') : p(`/customers?tab=${tab}`), { replace: true });
  };

  const tabs = [
    { id: 'customers' as TabType, label: 'Customers', icon: Users },
    { id: 'invoices' as TabType, label: 'Invoices', icon: Receipt },
    { id: 'reports' as TabType, label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={activeTab === 'reports' ? '' : 'max-w-7xl mx-auto'}>
        {activeTab === 'customers' && <CustomerList />}
        {activeTab === 'invoices' && <InvoiceList />}
        {activeTab === 'reports' && <Reports />}
      </div>
    </div>
  );
}
