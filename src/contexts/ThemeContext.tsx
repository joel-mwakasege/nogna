import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface ThemeColors {
  primaryColor: string;
  textColor: string;
  accentColor: string;
  cardColor: string;
  bodyBgColor: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
}

interface ShadowSettings {
  enabled: boolean;
  intensity: 'none' | 'subtle' | 'medium' | 'strong';
}

interface ThemeContextType {
  colors: ThemeColors;
  shadows: ShadowSettings;
  updateColors: (colors: ThemeColors) => Promise<void>;
  updateShadows: (shadows: ShadowSettings) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_CACHE_KEY = 'kavs_theme_cache';

function getCachedTheme(): { colors: ThemeColors; shadows: ShadowSettings } | null {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCachedTheme(colors: ThemeColors, shadows: ShadowSettings) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ colors, shadows }));
  } catch {}
}

const defaultColors: ThemeColors = {
  primaryColor: '#3b82f6',
  textColor: '#ffffff',
  accentColor: '#1e40af',
  cardColor: '#ffffff',
  bodyBgColor: '#f3f4f6',
  borderColor: '#e5e7eb',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
  infoColor: '#3b82f6',
};

const defaultShadows: ShadowSettings = {
  enabled: true,
  intensity: 'medium',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const cached = getCachedTheme();
  const [colors, setColors] = useState<ThemeColors>(cached?.colors ?? defaultColors);
  const [shadows, setShadows] = useState<ShadowSettings>(cached?.shadows ?? defaultShadows);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (user) {
      loadThemeColors();
    } else {
      setLoading(false);
    }

    const handleThemeUpdate = () => {
      if (user) {
        loadThemeColors();
      }
    };

    window.addEventListener('system-theme-updated', handleThemeUpdate);
    window.addEventListener('company-theme-updated', handleThemeUpdate);

    return () => {
      window.removeEventListener('system-theme-updated', handleThemeUpdate);
      window.removeEventListener('company-theme-updated', handleThemeUpdate);
    };
  }, [user]);

  useEffect(() => {
    document.documentElement.style.setProperty('--theme-primary', colors.primaryColor);
    document.documentElement.style.setProperty('--theme-text', colors.textColor);
    document.documentElement.style.setProperty('--theme-accent', colors.accentColor);
    document.documentElement.style.setProperty('--theme-card', colors.cardColor);
    document.documentElement.style.setProperty('--theme-body-bg', colors.bodyBgColor);
    document.documentElement.style.setProperty('--theme-border', colors.borderColor);
    document.documentElement.style.setProperty('--theme-success', colors.successColor);
    document.documentElement.style.setProperty('--theme-warning', colors.warningColor);
    document.documentElement.style.setProperty('--theme-error', colors.errorColor);
    document.documentElement.style.setProperty('--theme-info', colors.infoColor);
  }, [colors]);

  useEffect(() => {
    const shadowValues = {
      none: 'none',
      subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      strong: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    };

    const shadowValue = shadows.enabled ? shadowValues[shadows.intensity] : 'none';
    document.documentElement.style.setProperty('--theme-shadow', shadowValue);

    if (!shadows.enabled) {
      document.documentElement.classList.add('no-shadows');
    } else {
      document.documentElement.classList.remove('no-shadows');
    }
  }, [shadows]);

  const loadThemeColors = async () => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      let themeData = null;

      if (profile?.company_id) {
        const { data: companyTheme } = await supabase
          .from('company_settings')
          .select('theme_primary_color, theme_text_color, theme_accent_color, theme_card_color, theme_body_bg_color, theme_border_color, theme_shadow_enabled, theme_shadow_intensity')
          .eq('company_id', profile.company_id)
          .maybeSingle();

        if (companyTheme && companyTheme.theme_primary_color) {
          themeData = companyTheme;
        }
      }

      if (!themeData) {
        const { data: systemTheme } = await supabase
          .from('system_theme_settings')
          .select('theme_primary_color, theme_text_color, theme_accent_color, theme_card_color, theme_body_bg_color, theme_border_color, theme_shadow_enabled, theme_shadow_intensity')
          .maybeSingle();

        if (systemTheme) {
          themeData = systemTheme;
        }
      }

      if (themeData) {
        const newColors: ThemeColors = {
          primaryColor: themeData.theme_primary_color || '#3b82f6',
          textColor: themeData.theme_text_color || '#ffffff',
          accentColor: themeData.theme_accent_color || '#1e40af',
          cardColor: themeData.theme_card_color || '#ffffff',
          bodyBgColor: themeData.theme_body_bg_color || '#f3f4f6',
          borderColor: themeData.theme_border_color || '#e5e7eb',
          successColor: '#10b981',
          warningColor: '#f59e0b',
          errorColor: '#ef4444',
          infoColor: themeData.theme_primary_color || '#3b82f6',
        };
        const newShadows: ShadowSettings = {
          enabled: themeData.theme_shadow_enabled ?? true,
          intensity: (themeData.theme_shadow_intensity as 'none' | 'subtle' | 'medium' | 'strong') || 'medium',
        };
        setColors(newColors);
        setShadows(newShadows);
        setCachedTheme(newColors, newShadows);
      }
    } catch (error) {
      console.error('Error loading theme colors:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateColors = async (newColors: ThemeColors) => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('No company associated with user');
      }

      const { error } = await supabase
        .from('company_settings')
        .update({
          theme_primary_color: newColors.primaryColor,
          theme_text_color: newColors.textColor,
          theme_accent_color: newColors.accentColor,
          theme_card_color: newColors.cardColor,
          theme_body_bg_color: newColors.bodyBgColor,
          theme_border_color: newColors.borderColor,
        })
        .eq('company_id', profile.company_id);

      if (error) throw error;

      setColors(newColors);
      setCachedTheme(newColors, shadows);
    } catch (error) {
      console.error('Error updating theme colors:', error);
      throw error;
    }
  };

  const updateShadows = async (newShadows: ShadowSettings) => {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('No company associated with user');
      }

      const { error } = await supabase
        .from('company_settings')
        .update({
          theme_shadow_enabled: newShadows.enabled,
          theme_shadow_intensity: newShadows.intensity,
        })
        .eq('company_id', profile.company_id);

      if (error) throw error;

      setShadows(newShadows);
      setCachedTheme(colors, newShadows);
    } catch (error) {
      console.error('Error updating shadow settings:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider value={{ colors, shadows, updateColors, updateShadows, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
