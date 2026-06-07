import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, ArrowRight } from 'lucide-react';
import { Footer } from '../components/Footer';

export default function Home() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (clean) navigate(`/${clean}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      <div className="flex-grow flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-6 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">nogna.app</h1>
          <p className="text-gray-500 mb-10">
            Enter your workspace name to sign in
          </p>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 text-left mb-2">
                Workspace
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-slate-500 focus-within:border-transparent">
                <span className="pl-4 pr-1 text-gray-400 text-sm whitespace-nowrap select-none">
                  nogna.app/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="your-company"
                  className="flex-1 py-3 pr-4 text-gray-900 placeholder-gray-400 text-sm focus:outline-none bg-transparent"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!slug.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 text-white rounded-lg font-medium text-sm hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-xs text-gray-400">
            Don't know your workspace name? Contact your company administrator.
          </p>
        </div>
      </div>
      <div className="py-4 text-center">
        <Link to="/login" className="text-xs text-transparent hover:text-gray-400 transition-colors select-none">
          Platform admin
        </Link>
      </div>
      <Footer />
    </div>
  );
}
