import { useState, useEffect } from 'react';
import { Save, Palette, Zap } from 'lucide-react';
import { Button } from './Button';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeSettings() {
  const { colors, shadows, updateColors, updateShadows, loading } = useTheme();
  const [localColors, setLocalColors] = useState(colors);
  const [localShadows, setLocalShadows] = useState(shadows);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setLocalColors(colors);
  }, [colors]);

  useEffect(() => {
    setLocalShadows(shadows);
  }, [shadows]);

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
      setMessage({ type: 'success', text: 'Theme settings updated successfully!' });
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

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Theme Colors</h2>
        <p className="text-sm text-gray-600 mb-6">
          Customize the color scheme for your entire application. Changes will be applied immediately across all pages.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Background Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={localColors.primaryColor}
                onChange={(e) => setLocalColors({ ...localColors, primaryColor: e.target.value })}
                className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={localColors.primaryColor}
                onChange={(e) => setLocalColors({ ...localColors, primaryColor: e.target.value })}
                placeholder="#3b82f6"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This color is used for the header and main background areas
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={localColors.textColor}
                onChange={(e) => setLocalColors({ ...localColors, textColor: e.target.value })}
                className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={localColors.textColor}
                onChange={(e) => setLocalColors({ ...localColors, textColor: e.target.value })}
                placeholder="#000000"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This color is used for text in the header and navigation
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Accent Color (Buttons & Icons)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={localColors.accentColor}
                onChange={(e) => setLocalColors({ ...localColors, accentColor: e.target.value })}
                className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={localColors.accentColor}
                onChange={(e) => setLocalColors({ ...localColors, accentColor: e.target.value })}
                placeholder="#000000"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This color is used for buttons, icons, and interactive elements in the header
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Card Background Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={localColors.cardColor}
                onChange={(e) => setLocalColors({ ...localColors, cardColor: e.target.value })}
                className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={localColors.cardColor}
                onChange={(e) => setLocalColors({ ...localColors, cardColor: e.target.value })}
                placeholder="#FFFFFF"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This color is used for cards, panels, and content areas throughout the application
            </p>
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
                className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={localColors.bodyBgColor}
                onChange={(e) => setLocalColors({ ...localColors, bodyBgColor: e.target.value })}
                placeholder="#f3f4f6"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This color is used for the main page background behind all content
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Border Color
            </label>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={localColors.borderColor}
                onChange={(e) => setLocalColors({ ...localColors, borderColor: e.target.value })}
                className="w-20 h-12 rounded-lg border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                value={localColors.borderColor}
                onChange={(e) => setLocalColors({ ...localColors, borderColor: e.target.value })}
                placeholder="#e5e7eb"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This color is used for borders on cards, tables, and dividers
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
              <div className="flex items-start gap-3">
                <Palette className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Preview your changes</p>
                  <p className="text-blue-800">
                    Look at the header above to see how your color changes will appear. Colors are applied in real-time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Shadow Effects</h2>
        <p className="text-sm text-gray-600 mb-6">
          Control shadow effects across the entire application. Adjust intensity or disable completely for a flat design.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enable Shadows
              </label>
              <p className="text-xs text-gray-500">
                Toggle shadow effects on cards, buttons, and other elements
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
                  <div className="text-center">
                    <div className="text-sm font-medium text-gray-900 capitalize mb-1">
                      {intensity}
                    </div>
                    <div className="text-xs text-gray-500">
                      {intensity === 'none' && 'Flat'}
                      {intensity === 'subtle' && 'Light'}
                      {intensity === 'medium' && 'Balanced'}
                      {intensity === 'strong' && 'Dramatic'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 mb-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-medium mb-1">Live preview</p>
                  <p className="text-amber-800">
                    Shadow changes are applied instantly. Disable shadows for a modern flat design, or increase intensity for more depth.
                  </p>
                </div>
              </div>
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
