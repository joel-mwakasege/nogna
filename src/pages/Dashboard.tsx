import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import StatusBadge from '../components/StatusBadge';
import { supabase } from '../lib/supabase';
import { FileText, Users, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Dashboard() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { userProfile, companyId } = useAuth();
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalCustomers: 0,
    draftDocuments: 0,
    paidDocuments: 0,
  });
  const [recentDocuments, setRecentDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [userProfile]);

  const loadDashboardData = async () => {
    try {
      const { data: documents } = await supabase
        .from('documents')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      const { count: totalDocumentCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null);

      const { count: draftCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft')
        .is('deleted_at', null);

      const { count: paidCount } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'paid')
        .is('deleted_at', null);

      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .is('deleted_at', null);

      const docsWithCustomers = await Promise.all(
        (documents || []).map(async (doc) => {
          if (doc.customer_id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('name')
              .eq('id', doc.customer_id)
              .single();

            return {
              ...doc,
              customer_name: customer?.name || 'Unknown',
            };
          }
          return {
            ...doc,
            customer_name: 'No Customer',
          };
        })
      );

      setRecentDocuments(docsWithCustomers);

      setStats({
        totalDocuments: totalDocumentCount || 0,
        totalCustomers: customers?.length || 0,
        draftDocuments: draftCount || 0,
        paidDocuments: paidCount || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-600">Welcome to your billing management system</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <FileText className="w-6 h-6 text-slate-700" />
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalDocuments}</p>
            <p className="text-sm text-gray-600">Total Documents</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <Users className="w-6 h-6 text-slate-700" />
              </div>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalCustomers}</p>
            <p className="text-sm text-gray-600">Total Customers</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-100 rounded-lg">
                <Clock className="w-6 h-6 text-slate-600" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.draftDocuments}</p>
            <p className="text-sm text-gray-600">Draft Documents</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 rounded-lg">
                <FileText className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.paidDocuments}</p>
            <p className="text-sm text-gray-600">Paid Invoices</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Recent Documents</h2>
              <Button variant="outline" size="sm" onClick={() => navigate(p('/documents'))}>
                View All
              </Button>
            </div>

            {recentDocuments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">No documents yet</p>
                <Button onClick={() => navigate(p('/documents/new'))}>Create First Document</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(p(`/documents/${doc.id}`))}
                    className="p-4 border border-gray-200 rounded-lg hover:border-black transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-lg">{doc.document_number}</p>
                        <p className="text-sm text-gray-600">{doc.customer_name}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={doc.status} />
                        <p className="text-sm text-gray-500 mt-2">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
            <div className="space-y-3">
              <Button
                onClick={() => navigate(p('/documents/new'))}
                variant="primary"
                className="w-full justify-center"
              >
                Create Document
              </Button>
              <Button
                onClick={() => navigate(p('/customers/new'))}
                variant="outline"
                className="w-full justify-center"
              >
                Add Customer
              </Button>
              <Button
                onClick={() => navigate(p('/invoices'))}
                variant="secondary"
                className="w-full justify-center"
              >
                View Invoices
              </Button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-bold uppercase text-gray-500 mb-4">System Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Version</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className="font-medium text-emerald-600">Operational</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Sync</span>
                  <span className="font-medium">Just now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
