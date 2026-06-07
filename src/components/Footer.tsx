import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function Footer() {
  const { userProfile } = useAuth();
  const [footerContent, setFooterContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userProfile?.company_id) {
      loadFooterContent();
    } else {
      setIsLoading(false);
    }

    const handleSettingsUpdate = () => {
      if (userProfile?.company_id) {
        loadFooterContent();
      }
    };

    window.addEventListener('company-settings-updated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('company-settings-updated', handleSettingsUpdate);
    };
  }, [userProfile?.company_id]);

  const loadFooterContent = async () => {
    if (!userProfile?.company_id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('footer_content')
        .eq('company_id', userProfile.company_id)
        .maybeSingle();

      if (error) throw error;

      setFooterContent(data?.footer_content || '');
    } catch (error) {
      console.error('Error loading footer content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !footerContent.trim()) {
    return null;
  }

  return (
    <footer className="bg-gray-900 text-gray-300 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center text-sm">
          {footerContent}
        </div>
      </div>
    </footer>
  );
}
