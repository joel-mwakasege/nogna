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

export function AdminThemeSettings({ companies }: AdminThemeSettingsProps) {
  const [themeScope, setThemeScope] = useState<'system' | 'company'>('system');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [colors, setColors] = useState<ThemeColors>({
    primaryColor: '#3b82f6',
    textColor: '#ffffff',
    accentColor: '#1e40af',
    cardColor: '#ffffff',
    bodyBgColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  });
  const [shadows, setShadows] = useState<ShadowSettings>({
    enabled: true,
    intensity: 'medium',
  });
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
      const { data, error } = await supabase
        .from('system_theme_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setColors({
          primaryColor: data.theme_primary_color || '#3b82f6',
          textColor: data.theme_text_color || '#ffffff',
          accentColor: data.theme_accent_color || '#1e40af',
          cardColor: data.theme_card_color || '#ffffff',
          bodyBgColor: data.theme_body_bg_color || '#f3f4f6',
          borderColor: data.theme_border_color || '#e5e7eb',
        });
        setShadows({
          enabled: data.theme_shadow_enabled ?? true,
          intensity: (data.theme_shadow_intensity as 'none' | 'subtle' | 'medium' | 'strong') || 'medium',
        });
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
      const { data, error } = await supabase
        .from('company_settings')
        .select('theme_primary_color, theme_text_color, theme_accent_color, theme_card_color, theme_body_bg_color, theme_border_color, theme_shadow_enabled, theme_shadow_intensity')
        .eq('company_id', selectedCompanyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setColors({
          primaryColor: data.theme_primary_color || '#3b82f6',
          textColor: data.theme_text_color || '#ffffff',
          accentColor: data.theme_accent_color || '#1e40af',
          cardColor: data.theme_card_color || '#ffffff',
          bodyBgColor: data.theme_body_bg_color || '#f3f4f6',
          borderColor: data.theme_border_color || '#e5e7eb',
        });
        setShadows({
          enabled: data.theme_shadow_enabled ?? true,
          intensity: (data.theme_shadow_intensity as 'none' | 'subtle' | 'medium' | 'strong') || 'medium',
        });
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
        const { data: existingTheme } = await supabase
          .from('system_theme_settings')
          .select('id')
          .maybeSingle();

        if (existingTheme) {
          const { error } = await supabase
            .from('system_theme_settings')
            .update({
              theme_primary_color: colors.primaryColor,
              theme_text_color: colors.textColor,
              theme_accent_color: colors.accentColor,
              theme_card_color: colors.cardColor,
              theme_body_bg_color: colors.bodyBgColor,
              theme_border_color: colors.borderColor,
              theme_shadow_enabled: shadows.enabled,
              theme_shadow_intensity: shadows.intensity,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingTheme.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('system_theme_settings')
            .insert({
              theme_primary_color: colors.primaryColor,
              theme_text_color: colors.textColor,
              theme_accent_color: colors.accentColor,
              theme_card_color: colors.cardColor,
              theme_body_bg_color: colors.bodyBgColor,
              theme_border_color: colors.borderColor,
              theme_shadow_enabled: shadows.enabled,
              theme_shadow_intensity: shadows.intensity,
            });

          if (error) throw error;
        }

        window.dispatchEvent(new Event('system-theme-updated'));
        setMessage({ type: 'success', text: 'System-wide theme updated successfully!' });
      } else {
        const { error } = await supabase
          .from('company_settings')
          .update({
            theme_primary_color: colors.primaryColor,
            theme_text_color: colors.textColor,
            theme_accent_color: colors.accentColor,
            theme_card_color: colors.cardColor,
            theme_body_bg_color: colors.bodyBgColor,
            theme_border_color: colors.borderColor,
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
            <>
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Theme Colors</h2>
                <p className="text-sm text-gray-600 mb-6">
                  {themeScope === 'system'
                    ? 'Customize the default color scheme for the entire system. These colors apply to all companies unless they have custom themes.'
                    : 'Customize the color scheme for the selected company. Changes will be applied to all users in this company.'}
                </p>

                <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary Background Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={colors.primaryColor}
                        onChange={(e) => setColors({ ...colors, primaryColor: e.target.value })}
                        className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={colors.primaryColor}
                        onChange={(e) => setColors({ ...colors, primaryColor: e.target.value })}
                        placeholder="#3b82f6"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Used for header backgrounds and primary UI elements
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Text Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={colors.textColor}
                        onChange={(e) => setColors({ ...colors, textColor: e.target.value })}
                        className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={colors.textColor}
                        onChange={(e) => setColors({ ...colors, textColor: e.target.value })}
                        placeholder="#000000"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Primary text color on header backgrounds
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Accent Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={colors.accentColor}
                        onChange={(e) => setColors({ ...colors, accentColor: e.target.value })}
                        className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={colors.accentColor}
                        onChange={(e) => setColors({ ...colors, accentColor: e.target.value })}
                        placeholder="#000000"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Secondary text and icon colors
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Card Background Color
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={colors.cardColor}
                        onChange={(e) => setColors({ ...colors, cardColor: e.target.value })}
                        className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={colors.cardColor}
                        onChange={(e) => setColors({ ...colors, cardColor: e.target.value })}
                        placeholder="#FFFFFF"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Background color for cards and content panels
                    </p>
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
                        className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={colors.bodyBgColor}
                        onChange={(e) => setColors({ ...colors, bodyBgColor: e.target.value })}
                        placeholder="#f3f4f6"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Main page background color behind all content
                    </p>
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
                        className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={colors.borderColor}
                        onChange={(e) => setColors({ ...colors, borderColor: e.target.value })}
                        placeholder="#e5e7eb"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Border color for cards, tables, and dividers
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Shadow Effects</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Control shadow effects for cards, buttons, and other UI elements.
                </p>

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

              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Live Preview</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Preview your theme changes before saving. The preview updates as you adjust colors and shadows.
                </p>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div
                    className="rounded-lg p-6 transition-all"
                    style={{
                      backgroundColor: colors.primaryColor,
                      boxShadow: shadows.enabled
                        ? shadows.intensity === 'none'
                          ? 'none'
                          : shadows.intensity === 'subtle'
                          ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                          : shadows.intensity === 'medium'
                          ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                          : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        : 'none',
                    }}
                  >
                    <h3 className="text-2xl font-bold mb-2" style={{ color: colors.textColor }}>
                      Sample Header
                    </h3>
                    <p className="text-sm mb-4" style={{ color: colors.accentColor }}>
                      This is how your theme will look
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div
                        className="rounded-lg p-4 transition-all"
                        style={{
                          backgroundColor: colors.cardColor,
                          boxShadow: shadows.enabled
                            ? shadows.intensity === 'none'
                              ? 'none'
                              : shadows.intensity === 'subtle'
                              ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                              : shadows.intensity === 'medium'
                              ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                              : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                            : 'none',
                        }}
                      >
                        <div className="font-medium text-gray-900 mb-1">Card Title</div>
                        <div className="text-sm text-gray-600">Sample card content</div>
                      </div>
                      <div
                        className="rounded-lg p-4 transition-all"
                        style={{
                          backgroundColor: colors.cardColor,
                          boxShadow: shadows.enabled
                            ? shadows.intensity === 'none'
                              ? 'none'
                              : shadows.intensity === 'subtle'
                              ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                              : shadows.intensity === 'medium'
                              ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                              : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                            : 'none',
                        }}
                      >
                        <div className="font-medium text-gray-900 mb-1">Card Title</div>
                        <div className="text-sm text-gray-600">Sample card content</div>
                      </div>
                      <div
                        className="rounded-lg p-4 transition-all"
                        style={{
                          backgroundColor: colors.cardColor,
                          boxShadow: shadows.enabled
                            ? shadows.intensity === 'none'
                              ? 'none'
                              : shadows.intensity === 'subtle'
                              ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                              : shadows.intensity === 'medium'
                              ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                              : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                            : 'none',
                        }}
                      >
                        <div className="font-medium text-gray-900 mb-1">Card Title</div>
                        <div className="text-sm text-gray-600">Sample card content</div>
                      </div>
                    </div>
                  </div>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
