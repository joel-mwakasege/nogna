import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface ThemeColors {
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
  textPrimary: string;
  textSecondary: string;
}

export interface ShadowSettings {
  enabled: boolean;
  intensity: 'none' | 'subtle' | 'medium' | 'strong';
}

interface ThemeContextType {
  colors: ThemeColors;
  shadows: ShadowSettings;
  fontFamily: string;
  updateColors: (colors: ThemeColors) => Promise<void>;
  updateShadows: (shadows: ShadowSettings) => Promise<void>;
  updateFontFamily: (fontFamily: string) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_CACHE_KEY = 'kavs_theme_cache';

interface CachedTheme {
  colors: ThemeColors;
  shadows: ShadowSettings;
  fontFamily: string;
}

function getCachedTheme(): CachedTheme | null {
  try {
    const raw = localStorage.getItem(THEME_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setCachedTheme(colors: ThemeColors, shadows: ShadowSettings, fontFamily: string) {
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ colors, shadows, fontFamily }));
  } catch {}
}

const defaultColors: ThemeColors = {
  primaryColor: '#09090b',
  textColor: '#ffffff',
  accentColor: '#18181b',
  cardColor: '#ffffff',
  bodyBgColor: '#fafafa',
  borderColor: '#e4e4e7',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
  infoColor: '#18181b',
  textPrimary: '#09090b',
  textSecondary: '#71717a',
};

const defaultShadows: ShadowSettings = {
  enabled: true,
  intensity: 'subtle',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const cached = getCachedTheme();
  const [colors, setColors] = useState<ThemeColors>(cached?.colors ?? defaultColors);
  const [shadows, setShadows] = useState<ShadowSettings>(cached?.shadows ?? defaultShadows);
  const [fontFamily, setFontFamily] = useState<string>(cached?.fontFamily ?? 'Outfit');
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

  // Apply Colors CSS Variables
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
    document.documentElement.style.setProperty('--theme-text-primary', colors.textPrimary);
    document.documentElement.style.setProperty('--theme-text-secondary', colors.textSecondary);
  }, [colors]);

  // Apply Dynamic Google Font
  useEffect(() => {
    if (fontFamily) {
      const existingLink = document.getElementById('dynamic-theme-font');
      if (existingLink) {
        existingLink.remove();
      }

      const link = document.createElement('link');
      link.id = 'dynamic-theme-font';
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
      document.head.appendChild(link);

      document.documentElement.style.setProperty('--theme-font-family', `"${fontFamily}", sans-serif`);
    }
  }, [fontFamily]);

  // Apply Shadows
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
      const { data: profile } = await (supabase as any)
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      let themeData = null;

      if (profile?.company_id) {
        const { data: companyTheme } = await (supabase as any)
          .from('company_settings')
          .select('theme_primary_color, theme_text_color, theme_accent_color, theme_card_color, theme_body_bg_color, theme_border_color, theme_shadow_enabled, theme_shadow_intensity, theme_text_primary, theme_text_secondary, theme_success_color, theme_warning_color, theme_error_color, theme_info_color, theme_font_family')
          .eq('company_id', profile.company_id)
          .maybeSingle();

        if (companyTheme && companyTheme.theme_primary_color) {
          themeData = companyTheme;
        }
      }

      if (!themeData) {
        const { data: systemTheme } = await (supabase as any)
          .from('system_theme_settings')
          .select('theme_primary_color, theme_text_color, theme_accent_color, theme_card_color, theme_body_bg_color, theme_border_color, theme_shadow_enabled, theme_shadow_intensity, theme_text_primary, theme_text_secondary, theme_success_color, theme_warning_color, theme_error_color, theme_info_color, theme_font_family')
          .maybeSingle();

        if (systemTheme) {
          themeData = systemTheme;
        }
      }

      if (themeData) {
        const newColors: ThemeColors = {
          primaryColor: themeData.theme_primary_color || '#09090b',
          textColor: themeData.theme_text_color || '#ffffff',
          accentColor: themeData.theme_accent_color || '#18181b',
          cardColor: themeData.theme_card_color || '#ffffff',
          bodyBgColor: themeData.theme_body_bg_color || '#fafafa',
          borderColor: themeData.theme_border_color || '#e4e4e7',
          successColor: themeData.theme_success_color || '#10b981',
          warningColor: themeData.theme_warning_color || '#f59e0b',
          errorColor: themeData.theme_error_color || '#ef4444',
          infoColor: themeData.theme_info_color || '#18181b',
          textPrimary: themeData.theme_text_primary || '#09090b',
          textSecondary: themeData.theme_text_secondary || '#71717a',
        };
        const newShadows: ShadowSettings = {
          enabled: themeData.theme_shadow_enabled ?? true,
          intensity: (themeData.theme_shadow_intensity as 'none' | 'subtle' | 'medium' | 'strong') || 'subtle',
        };
        const newFontFamily = themeData.theme_font_family || 'Outfit';
        
        setColors(newColors);
        setShadows(newShadows);
        setFontFamily(newFontFamily);
        setCachedTheme(newColors, newShadows, newFontFamily);
      }
    } catch (error) {
      console.error('Error loading theme colors:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateColors = async (newColors: ThemeColors) => {
    try {
      const { data: profile } = await (supabase as any)
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('No company associated with user');
      }

      const { error } = await (supabase as any)
        .from('company_settings')
        .update({
          theme_primary_color: newColors.primaryColor,
          theme_text_color: newColors.textColor,
          theme_accent_color: newColors.accentColor,
          theme_card_color: newColors.cardColor,
          theme_body_bg_color: newColors.bodyBgColor,
          theme_border_color: newColors.borderColor,
          theme_text_primary: newColors.textPrimary,
          theme_text_secondary: newColors.textSecondary,
          theme_success_color: newColors.successColor,
          theme_warning_color: newColors.warningColor,
          theme_error_color: newColors.errorColor,
          theme_info_color: newColors.infoColor,
        })
        .eq('company_id', profile.company_id);

      if (error) throw error;

      setColors(newColors);
      setCachedTheme(newColors, shadows, fontFamily);
    } catch (error) {
      console.error('Error updating theme colors:', error);
      throw error;
    }
  };

  const updateShadows = async (newShadows: ShadowSettings) => {
    try {
      const { data: profile } = await (supabase as any)
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('No company associated with user');
      }

      const { error } = await (supabase as any)
        .from('company_settings')
        .update({
          theme_shadow_enabled: newShadows.enabled,
          theme_shadow_intensity: newShadows.intensity,
        })
        .eq('company_id', profile.company_id);

      if (error) throw error;

      setShadows(newShadows);
      setCachedTheme(colors, newShadows, fontFamily);
    } catch (error) {
      console.error('Error updating shadow settings:', error);
      throw error;
    }
  };

  const updateFontFamily = async (newFontFamily: string) => {
    try {
      const { data: profile } = await (supabase as any)
        .from('user_profiles')
        .select('company_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (!profile?.company_id) {
        throw new Error('No company associated with user');
      }

      const { error } = await (supabase as any)
        .from('company_settings')
        .update({
          theme_font_family: newFontFamily,
        })
        .eq('company_id', profile.company_id);

      if (error) throw error;

      setFontFamily(newFontFamily);
      setCachedTheme(colors, shadows, newFontFamily);
    } catch (error) {
      console.error('Error updating font family:', error);
      throw error;
    }
  };

  return (
    <ThemeContext.Provider value={{ colors, shadows, fontFamily, updateColors, updateShadows, updateFontFamily, loading }}>
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
