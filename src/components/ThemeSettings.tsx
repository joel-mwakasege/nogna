import { useState, useEffect } from 'react';
import { Save, Palette, Zap } from 'lucide-react';
import { Button } from './Button';
import { useTheme } from '../contexts/ThemeContext';

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

export function ThemeSettings() {
  const { colors, shadows, fontFamily, updateColors, updateShadows, updateFontFamily, loading } = useTheme();
  const [localColors, setLocalColors] = useState(colors);
  const [localShadows, setLocalShadows] = useState(shadows);
  const [localFontFamily, setLocalFontFamily] = useState(fontFamily);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setLocalColors(colors);
  }, [colors]);

  useEffect(() => {
    setLocalShadows(shadows);
  }, [shadows]);

  useEffect(() => {
    setLocalFontFamily(fontFamily);
  }, [fontFamily]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading theme settings...</div>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateColors(localColors);
      await updateShadows(localShadows);
      await updateFontFamily(localFontFamily);
      setMessage({ type: 'success', text: 'Theme settings updated successfully!' });
    } catch (error) {
      console.error('Error updating theme settings:', error);
      setMessage({ type: 'error', text: 'Failed to update theme settings' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setLocalColors(preset.colors);
    setLocalFontFamily(preset.fontFamily);
  };

  return (
    <div className="space-y-8">
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

      {/* Theme Presets */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Theme Presets</h2>
        <p className="text-sm text-gray-600 mb-6">
          Instantly apply a curated palette and typography. You can customize the details below after applying.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              className="flex flex-col items-stretch p-3 rounded-xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-md transition-all text-left"
            >
              <span className="text-xs font-semibold text-gray-900 truncate mb-2">{preset.name}</span>
              <div className="flex h-8 rounded-md overflow-hidden border border-gray-100">
                <div className="flex-1" style={{ backgroundColor: preset.colors.primaryColor }} title="Primary" />
                <div className="flex-1" style={{ backgroundColor: preset.colors.bodyBgColor }} title="Body BG" />
                <div className="flex-1" style={{ backgroundColor: preset.colors.cardColor }} title="Card BG" />
                <div className="flex-1" style={{ backgroundColor: preset.colors.accentColor }} title="Accent" />
              </div>
              <span className="text-[10px] text-gray-500 mt-2 font-mono">{preset.fontFamily}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Typography Selector */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Typography</h2>
        <p className="text-sm text-gray-600 mb-4">
          Select a font family for the application interface.
        </p>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Font Family
          </label>
          <select
            value={localFontFamily}
            onChange={(e) => setLocalFontFamily(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
          >
            {SUPPORTED_FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2" style={{ fontFamily: localFontFamily }}>
            Preview text: The quick brown fox jumps over the lazy dog. (Loaded dynamically from Google Fonts)
          </p>
        </div>
      </section>

      {/* Theme Colors */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Theme Colors</h2>
        <p className="text-sm text-gray-600 mb-6">
          Customize the color scheme of your interface.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">Brand Colors</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Header Background Color
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={localColors.primaryColor}
                  onChange={(e) => setLocalColors({ ...localColors, primaryColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.primaryColor}
                  onChange={(e) => setLocalColors({ ...localColors, primaryColor: e.target.value })}
                  placeholder="#2596be"
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
                  value={localColors.textColor}
                  onChange={(e) => setLocalColors({ ...localColors, textColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.textColor}
                  onChange={(e) => setLocalColors({ ...localColors, textColor: e.target.value })}
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
                  value={localColors.accentColor}
                  onChange={(e) => setLocalColors({ ...localColors, accentColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.accentColor}
                  onChange={(e) => setLocalColors({ ...localColors, accentColor: e.target.value })}
                  placeholder="#1e40af"
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
                  value={localColors.cardColor}
                  onChange={(e) => setLocalColors({ ...localColors, cardColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.cardColor}
                  onChange={(e) => setLocalColors({ ...localColors, cardColor: e.target.value })}
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
                  value={localColors.bodyBgColor}
                  onChange={(e) => setLocalColors({ ...localColors, bodyBgColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.bodyBgColor}
                  onChange={(e) => setLocalColors({ ...localColors, bodyBgColor: e.target.value })}
                  placeholder="#f3f4f6"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Border & Dividers Color
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={localColors.borderColor}
                  onChange={(e) => setLocalColors({ ...localColors, borderColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.borderColor}
                  onChange={(e) => setLocalColors({ ...localColors, borderColor: e.target.value })}
                  placeholder="#e5e7eb"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 pt-4 mb-4">Text & Status Colors</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Text Color (on Card/Body)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={localColors.textPrimary}
                  onChange={(e) => setLocalColors({ ...localColors, textPrimary: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.textPrimary}
                  onChange={(e) => setLocalColors({ ...localColors, textPrimary: e.target.value })}
                  placeholder="#111827"
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
                  value={localColors.textSecondary}
                  onChange={(e) => setLocalColors({ ...localColors, textSecondary: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.textSecondary}
                  onChange={(e) => setLocalColors({ ...localColors, textSecondary: e.target.value })}
                  placeholder="#4b5563"
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
                  value={localColors.successColor}
                  onChange={(e) => setLocalColors({ ...localColors, successColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.successColor}
                  onChange={(e) => setLocalColors({ ...localColors, successColor: e.target.value })}
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
                  value={localColors.warningColor}
                  onChange={(e) => setLocalColors({ ...localColors, warningColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.warningColor}
                  onChange={(e) => setLocalColors({ ...localColors, warningColor: e.target.value })}
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
                  value={localColors.errorColor}
                  onChange={(e) => setLocalColors({ ...localColors, errorColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.errorColor}
                  onChange={(e) => setLocalColors({ ...localColors, errorColor: e.target.value })}
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
                  value={localColors.infoColor}
                  onChange={(e) => setLocalColors({ ...localColors, infoColor: e.target.value })}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={localColors.infoColor}
                  onChange={(e) => setLocalColors({ ...localColors, infoColor: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
              <div className="flex items-start gap-3">
                <Palette className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Preview your changes</p>
                  <p className="text-blue-800 text-xs">
                    Colors and fonts are loaded and applied dynamically in real-time. Look at the header and general page elements to preview.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shadows */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Shadow Effects</h2>
        <p className="text-sm text-gray-600 mb-6">
          Toggle card shadows or customize their depth.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enable Shadows
              </label>
              <p className="text-xs text-gray-500">
                Toggle shadows globally across the app
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLocalShadows({ ...localShadows, enabled: !localShadows.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localShadows.enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localShadows.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className={localShadows.enabled ? '' : 'opacity-50 pointer-events-none'}>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Shadow Intensity
            </label>
            <div className="grid grid-cols-4 gap-3">
              {(['none', 'subtle', 'medium', 'strong'] as const).map((intensity) => (
                <button
                  key={intensity}
                  type="button"
                  onClick={() => setLocalShadows({ ...localShadows, intensity })}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    localShadows.intensity === intensity
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  style={{
                    boxShadow:
                      intensity === 'none'
                        ? 'none'
                        : intensity === 'subtle'
                        ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                        : intensity === 'medium'
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div className="text-center text-xs font-semibold capitalize">
                    {intensity}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="pt-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Theme Settings'}
        </Button>
      </div>
    </div>
  );
}
