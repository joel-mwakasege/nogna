import { useState, useEffect } from 'react';
import { Save, Palette, Building2 } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';

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
  textPrimary: string;
  textSecondary: string;
}

interface ShadowSettings {
  enabled: boolean;
  intensity: 'none' | 'subtle' | 'medium' | 'strong';
}

interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface AdminThemeSettingsProps {
  companies: Company[];
}

const SUPPORTED_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Merriweather',
  'Lora',
  'Source Code Pro',
  'JetBrains Mono',
  'Outfit',
  'Plus Jakarta Sans'
];

const THEME_PRESETS = [
  {
    name: 'Modern Slate',
    colors: {
      primaryColor: '#2596be',
      textColor: '#ffffff',
      accentColor: '#1e40af',
      cardColor: '#ffffff',
      bodyBgColor: '#f3f4f6',
      borderColor: '#e5e7eb',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      errorColor: '#ef4444',
      infoColor: '#2596be',
      textPrimary: '#111827',
      textSecondary: '#4b5563',
    },
    fontFamily: 'Inter',
  },
  {
    name: 'Monochrome Chic',
    colors: {
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
    },
    fontFamily: 'Outfit',
  },
  {
    name: 'Premium Dark',
    colors: {
      primaryColor: '#0f172a',
      textColor: '#ffffff',
      accentColor: '#38bdf8',
      cardColor: '#1e293b',
      bodyBgColor: '#0f172a',
      borderColor: '#334155',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      errorColor: '#f43f5e',
      infoColor: '#38bdf8',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
    },
    fontFamily: 'Outfit',
  },
  {
    name: 'Nordic Forest',
    colors: {
      primaryColor: '#1e3f20',
      textColor: '#ffffff',
      accentColor: '#2d6a4f',
      cardColor: '#ffffff',
      bodyBgColor: '#f4f6f4',
      borderColor: '#d8e2dc',
      textPrimary: '#1b4332',
      textSecondary: '#40916c',
      successColor: '#52b788',
      warningColor: '#f59e0b',
      errorColor: '#ef4444',
      infoColor: '#2d6a4f',
    },
    fontFamily: 'Plus Jakarta Sans',
  },
  {
    name: 'Royal Indigo',
    colors: {
      primaryColor: '#31108f',
      textColor: '#ffffff',
      accentColor: '#6366f1',
      cardColor: '#ffffff',
      bodyBgColor: '#f5f3ff',
      borderColor: '#e9e3ff',
      textPrimary: '#1e1b4b',
      textSecondary: '#4f46e5',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      errorColor: '#ef4444',
      infoColor: '#6366f1',
    },
    fontFamily: 'Poppins',
  },
  {
    name: 'Warm Sunset',
    colors: {
      primaryColor: '#7c2d12',
      textColor: '#ffffff',
      accentColor: '#ea580c',
      cardColor: '#ffffff',
      bodyBgColor: '#fff7ed',
      borderColor: '#ffedd5',
      textPrimary: '#431407',
      textSecondary: '#c2410c',
      successColor: '#16a34a',
      warningColor: '#ca8a04',
      errorColor: '#dc2626',
      infoColor: '#ea580c',
    },
    fontFamily: 'Montserrat',
  },
];

export function AdminThemeSettings({ companies }: AdminThemeSettingsProps) {
  const [themeScope, setThemeScope] = useState<'system' | 'company'>('system');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [colors, setColors] = useState<ThemeColors>({
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
  });
  const [shadows, setShadows] = useState<ShadowSettings>({
    enabled: true,
    intensity: 'subtle',
  });
  const [fontFamily, setFontFamily] = useState<string>('Outfit');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (themeScope === 'system') {
      loadSystemThemeSettings();
    } else if (selectedCompanyId) {
      loadCompanyThemeSettings();
    }
  }, [themeScope, selectedCompanyId]);

  const loadSystemThemeSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('system_theme_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setColors({
          primaryColor: data.theme_primary_color || '#09090b',
          textColor: data.theme_text_color || '#ffffff',
          accentColor: data.theme_accent_color || '#18181b',
          cardColor: data.theme_card_color || '#ffffff',
          bodyBgColor: data.theme_body_bg_color || '#fafafa',
          borderColor: data.theme_border_color || '#e4e4e7',
          successColor: data.theme_success_color || '#10b981',
          warningColor: data.theme_warning_color || '#f59e0b',
          errorColor: data.theme_error_color || '#ef4444',
          infoColor: data.theme_info_color || '#18181b',
          textPrimary: data.theme_text_primary || '#09090b',
          textSecondary: data.theme_text_secondary || '#71717a',
        });
        setShadows({
          enabled: data.theme_shadow_enabled ?? true,
          intensity: (data.theme_shadow_intensity as 'none' | 'subtle' | 'medium' | 'strong') || 'subtle',
        });
        setFontFamily(data.theme_font_family || 'Outfit');
      }
    } catch (error) {
      console.error('Error loading system theme settings:', error);
      setMessage({ type: 'error', text: 'Failed to load system theme settings' });
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyThemeSettings = async () => {
    if (!selectedCompanyId) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('company_settings')
        .select('theme_primary_color, theme_text_color, theme_accent_color, theme_card_color, theme_body_bg_color, theme_border_color, theme_shadow_enabled, theme_shadow_intensity, theme_text_primary, theme_text_secondary, theme_success_color, theme_warning_color, theme_error_color, theme_info_color, theme_font_family')
        .eq('company_id', selectedCompanyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setColors({
          primaryColor: data.theme_primary_color || '#09090b',
          textColor: data.theme_text_color || '#ffffff',
          accentColor: data.theme_accent_color || '#18181b',
          cardColor: data.theme_card_color || '#ffffff',
          bodyBgColor: data.theme_body_bg_color || '#fafafa',
          borderColor: data.theme_border_color || '#e4e4e7',
          successColor: data.theme_success_color || '#10b981',
          warningColor: data.theme_warning_color || '#f59e0b',
          errorColor: data.theme_error_color || '#ef4444',
          infoColor: data.theme_info_color || '#18181b',
          textPrimary: data.theme_text_primary || '#09090b',
          textSecondary: data.theme_text_secondary || '#71717a',
        });
        setShadows({
          enabled: data.theme_shadow_enabled ?? true,
          intensity: (data.theme_shadow_intensity as 'none' | 'subtle' | 'medium' | 'strong') || 'subtle',
        });
        setFontFamily(data.theme_font_family || 'Outfit');
      }
    } catch (error) {
      console.error('Error loading theme settings:', error);
      setMessage({ type: 'error', text: 'Failed to load theme settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (themeScope === 'company' && !selectedCompanyId) {
      setMessage({ type: 'error', text: 'Please select a company first' });
      return;
    }

    setSaving(true);
    try {
      if (themeScope === 'system') {
        const { data: existingTheme } = await (supabase as any)
          .from('system_theme_settings')
          .select('id')
          .maybeSingle();

        if (existingTheme) {
          const { error } = await (supabase as any)
            .from('system_theme_settings')
            .update({
              theme_primary_color: colors.primaryColor,
              theme_text_color: colors.textColor,
              theme_accent_color: colors.accentColor,
              theme_card_color: colors.cardColor,
              theme_body_bg_color: colors.bodyBgColor,
              theme_border_color: colors.borderColor,
              theme_success_color: colors.successColor,
              theme_warning_color: colors.warningColor,
              theme_error_color: colors.errorColor,
              theme_info_color: colors.infoColor,
              theme_text_primary: colors.textPrimary,
              theme_text_secondary: colors.textSecondary,
              theme_font_family: fontFamily,
              theme_shadow_enabled: shadows.enabled,
              theme_shadow_intensity: shadows.intensity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingTheme.id);

          if (error) throw error;
        } else {
          const { error } = await (supabase as any)
            .from('system_theme_settings')
            .insert({
              theme_primary_color: colors.primaryColor,
              theme_text_color: colors.textColor,
              theme_accent_color: colors.accentColor,
              theme_card_color: colors.cardColor,
              theme_body_bg_color: colors.bodyBgColor,
              theme_border_color: colors.borderColor,
              theme_success_color: colors.successColor,
              theme_warning_color: colors.warningColor,
              theme_error_color: colors.errorColor,
              theme_info_color: colors.infoColor,
              theme_text_primary: colors.textPrimary,
              theme_text_secondary: colors.textSecondary,
              theme_font_family: fontFamily,
              theme_shadow_enabled: shadows.enabled,
              theme_shadow_intensity: shadows.intensity,
            });

          if (error) throw error;
        }

        window.dispatchEvent(new Event('system-theme-updated'));
        setMessage({ type: 'success', text: 'System-wide theme updated successfully!' });
      } else {
        const { error } = await (supabase as any)
          .from('company_settings')
          .update({
            theme_primary_color: colors.primaryColor,
            theme_text_color: colors.textColor,
            theme_accent_color: colors.accentColor,
            theme_card_color: colors.cardColor,
            theme_body_bg_color: colors.bodyBgColor,
            theme_border_color: colors.borderColor,
            theme_success_color: colors.successColor,
            theme_warning_color: colors.warningColor,
            theme_error_color: colors.errorColor,
            theme_info_color: colors.infoColor,
            theme_text_primary: colors.textPrimary,
            theme_text_secondary: colors.textSecondary,
            theme_font_family: fontFamily,
            theme_shadow_enabled: shadows.enabled,
            theme_shadow_intensity: shadows.intensity,
          })
          .eq('company_id', selectedCompanyId);

        if (error) throw error;

        window.dispatchEvent(new Event('company-theme-updated'));
        setMessage({ type: 'success', text: 'Company theme settings updated successfully!' });
      }
    } catch (error) {
      console.error('Error updating theme settings:', error);
      setMessage({ type: 'error', text: 'Failed to update theme settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setColors(preset.colors);
    setFontFamily(preset.fontFamily);
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6 border border-blue-200">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Theme Scope
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setThemeScope('system');
                  setSelectedCompanyId('');
                }}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  themeScope === 'system'
                    ? 'border-blue-600 bg-blue-50 shadow-md'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                <Palette className={`w-6 h-6 ${themeScope === 'system' ? 'text-blue-600' : 'text-gray-600'}`} />
                <div className="text-left">
                  <div className={`font-semibold ${themeScope === 'system' ? 'text-blue-900' : 'text-gray-900'}`}>
                    System-Wide Theme
                  </div>
                  <div className={`text-sm ${themeScope === 'system' ? 'text-blue-700' : 'text-gray-600'}`}>
                    Default theme for all companies
                  </div>
                </div>
              </button>
              <button
                onClick={() => setThemeScope('company')}
                className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                  themeScope === 'company'
                    ? 'border-blue-600 bg-blue-50 shadow-md'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                <Building2 className={`w-6 h-6 ${themeScope === 'company' ? 'text-blue-600' : 'text-gray-600'}`} />
                <div className="text-left">
                  <div className={`font-semibold ${themeScope === 'company' ? 'text-blue-900' : 'text-gray-900'}`}>
                    Company-Specific Theme
                  </div>
                  <div className={`text-sm ${themeScope === 'company' ? 'text-blue-700' : 'text-gray-600'}`}>
                    Override theme per company
                  </div>
                </div>
              </button>
            </div>
          </div>

          {themeScope === 'company' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Company
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select a Company --</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} ({company.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {(themeScope === 'system' || selectedCompanyId) && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading theme settings...</div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Theme Presets */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Theme Presets</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Quickly populate colors and fonts from these curated preset values.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="flex flex-col items-stretch p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-500 hover:shadow transition-all text-left"
                    >
                      <span className="text-xs font-semibold text-gray-900 truncate mb-1">{preset.name}</span>
                      <div className="flex h-6 rounded overflow-hidden border border-gray-100">
                        <div className="flex-1" style={{ backgroundColor: preset.colors.primaryColor }} />
                        <div className="flex-1" style={{ backgroundColor: preset.colors.bodyBgColor }} />
                        <div className="flex-1" style={{ backgroundColor: preset.colors.cardColor }} />
                        <div className="flex-1" style={{ backgroundColor: preset.colors.accentColor }} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Typography Selector */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Typography</h2>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Global Font Family
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                  >
                    {SUPPORTED_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              {/* Colors panel */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Theme Colors</h2>
                
                <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                  <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">Brand Colors</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Background / Header Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.primaryColor}
                          onChange={(e) => setColors({ ...colors, primaryColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.primaryColor}
                          onChange={(e) => setColors({ ...colors, primaryColor: e.target.value })}
                          placeholder="#09090b"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Header Text Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.textColor}
                          onChange={(e) => setColors({ ...colors, textColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.textColor}
                          onChange={(e) => setColors({ ...colors, textColor: e.target.value })}
                          placeholder="#ffffff"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accent / Buttons Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.accentColor}
                          onChange={(e) => setColors({ ...colors, accentColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.accentColor}
                          onChange={(e) => setColors({ ...colors, accentColor: e.target.value })}
                          placeholder="#18181b"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 pt-4 mb-4">Structure Colors</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Card Background Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.cardColor}
                          onChange={(e) => setColors({ ...colors, cardColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.cardColor}
                          onChange={(e) => setColors({ ...colors, cardColor: e.target.value })}
                          placeholder="#ffffff"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Body Background Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.bodyBgColor}
                          onChange={(e) => setColors({ ...colors, bodyBgColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.bodyBgColor}
                          onChange={(e) => setColors({ ...colors, bodyBgColor: e.target.value })}
                          placeholder="#fafafa"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Border Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.borderColor}
                          onChange={(e) => setColors({ ...colors, borderColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.borderColor}
                          onChange={(e) => setColors({ ...colors, borderColor: e.target.value })}
                          placeholder="#e4e4e7"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 pt-4 mb-4">Text & Status Colors</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Text Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.textPrimary}
                          onChange={(e) => setColors({ ...colors, textPrimary: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.textPrimary}
                          onChange={(e) => setColors({ ...colors, textPrimary: e.target.value })}
                          placeholder="#09090b"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Secondary Text Color (Muted)
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.textSecondary}
                          onChange={(e) => setColors({ ...colors, textSecondary: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.textSecondary}
                          onChange={(e) => setColors({ ...colors, textSecondary: e.target.value })}
                          placeholder="#71717a"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Success Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.successColor}
                          onChange={(e) => setColors({ ...colors, successColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.successColor}
                          onChange={(e) => setColors({ ...colors, successColor: e.target.value })}
                          placeholder="#10b981"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Warning Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.warningColor}
                          onChange={(e) => setColors({ ...colors, warningColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.warningColor}
                          onChange={(e) => setColors({ ...colors, warningColor: e.target.value })}
                          placeholder="#f59e0b"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Error Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.errorColor}
                          onChange={(e) => setColors({ ...colors, errorColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.errorColor}
                          onChange={(e) => setColors({ ...colors, errorColor: e.target.value })}
                          placeholder="#ef4444"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Info Color
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={colors.infoColor}
                          onChange={(e) => setColors({ ...colors, infoColor: e.target.value })}
                          className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={colors.infoColor}
                          onChange={(e) => setColors({ ...colors, infoColor: e.target.value })}
                          placeholder="#18181b"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Shadows section */}
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Shadow Effects</h2>
                <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Enable Shadows
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Toggle shadow effects throughout the application
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShadows({ ...shadows, enabled: !shadows.enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        shadows.enabled ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          shadows.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {shadows.enabled && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Shadow Intensity
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {(['none', 'subtle', 'medium', 'strong'] as const).map((intensity) => (
                          <button
                            key={intensity}
                            type="button"
                            onClick={() => setShadows({ ...shadows, intensity })}
                            className={`px-4 py-3 rounded-lg border-2 transition-all capitalize ${
                              shadows.intensity === intensity
                                ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {intensity}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  size="lg"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? 'Saving...' : 'Save Theme Settings'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
