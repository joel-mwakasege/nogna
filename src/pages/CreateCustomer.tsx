import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/auth-utils';
import { useAuth } from '../contexts/AuthContext';

export function CreateCustomer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string; id?: string }>();
  const p = (path: string) => `/${slug}${path}`;
  const { userProfile } = useAuth();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const returnTo = location.state?.returnTo || p('/customers');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditing);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    if (isEditing && id) {
      loadCustomer();
    }
  }, [id, isEditing]);

  const loadCustomer = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        navigate(p('/customers'));
        return;
      }

      setName(data.name);
      setEmail(data.email);
    } catch (error) {
      console.error('Error loading customer:', error);
      navigate(p('/customers'));
    } finally {
      setIsFetching(false);
    }
  };

  const validateForm = () => {
    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Customer name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      if (isEditing && id) {
        const { error } = await supabase
          .from('customers')
          .update({
            name: name.trim(),
            email: email.trim(),
          })
          .eq('id', id);

        if (error) throw error;

        navigate(returnTo, { state: { message: 'Customer updated successfully' } });
      } else {
        const userId = await getCurrentUserId();
        if (!userId) {
          throw new Error('Not authenticated');
        }

        const { error } = await supabase.from('customers').insert({
          name: name.trim(),
          email: email.trim(),
          user_id: userId,
          company_id: userProfile?.company_id || null,
        });

        if (error) throw error;

        navigate(returnTo, { state: { message: 'Customer created successfully' } });
      }
    } catch (error) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} customer:`, error);
      setErrors({ email: `Failed to ${isEditing ? 'update' : 'create'} customer. Please try again.` });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading customer...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="mb-8 sm:mb-10 lg:mb-12">
          <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">
            {isEditing ? 'UPDATE RELATIONSHIP' : 'NEW RELATIONSHIP'}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight mb-2">
            {isEditing ? 'EDIT' : 'CREATE'}
          </h1>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight">CUSTOMER</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 lg:space-y-8">
          <div>
            <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
              Customer Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              placeholder="Enter company or individual name"
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              } rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent`}
            />
            {errors.name && <p className="mt-2 text-xs sm:text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="name@company.com"
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              } rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent`}
            />
            {errors.email && <p className="mt-2 text-xs sm:text-sm text-red-600">{errors.email}</p>}
          </div>

          <div className="pt-2 sm:pt-4">
            <Button type="submit" size="lg" isLoading={isLoading}>
              {isEditing ? 'UPDATE CUSTOMER' : 'CREATE CUSTOMER'}
            </Button>
          </div>
        </form>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0 text-xs text-gray-500">
          <p className="text-center sm:text-left">© 2025 KAVS GROUP — INTERNAL SYSTEM</p>
          <div className="flex gap-4 sm:gap-6">
            <button className="hover:text-black">SECURITY</button>
            <button className="hover:text-black">SUPPORT</button>
            <button className="hover:text-black">SYSTEM STATUS</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
