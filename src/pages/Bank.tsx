import { useSearchParams } from 'react-router-dom';
import { Wallet, TrendingDown, TrendingUp } from 'lucide-react';
import { AccountsList } from './AccountsList';
import ExpenseList from './ExpenseList';
import DepositList from './DepositList';

type TabType = 'accounts' | 'expenses' | 'deposits';

const VALID_TABS: TabType[] = ['accounts', 'expenses', 'deposits'];

export default function Bank() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType | null;
  const activeTab: TabType = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'accounts';

  const setActiveTab = (tab: TabType) => {
    setSearchParams(tab === 'accounts' ? {} : { tab });
  };

  const tabs = [
    { id: 'accounts' as TabType, label: 'Accounts', icon: Wallet },
    { id: 'expenses' as TabType, label: 'Expenses', icon: TrendingDown },
    { id: 'deposits' as TabType, label: 'Deposits', icon: TrendingUp },
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

      <div className="max-w-7xl mx-auto">
        {activeTab === 'accounts' && <AccountsList />}
        {activeTab === 'expenses' && <ExpenseList />}
        {activeTab === 'deposits' && <DepositList />}
      </div>
    </div>
  );
}
