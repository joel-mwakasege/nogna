import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Settings } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  visible: boolean;
}

interface ColumnVisibilityControlProps {
  columns: Column[];
  onToggle: (key: string) => void;
}

export function ColumnVisibilityControl({ columns, onToggle }: ColumnVisibilityControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const visibleCount = columns.filter(col => col.visible).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Settings className="w-4 h-4" />
        Columns
        <span className="text-xs text-gray-500">({visibleCount}/{columns.length})</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Show/Hide Columns</h3>
            <p className="text-xs text-gray-500 mt-1">Toggle column visibility</p>
          </div>
          <div className="p-2 max-h-80 overflow-y-auto">
            {columns.map((column) => (
              <label
                key={column.key}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={column.visible}
                  onChange={() => onToggle(column.key)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 flex-1">
                  {column.visible ? (
                    <Eye className="w-4 h-4 text-blue-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={`text-sm ${column.visible ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {column.label}
                  </span>
                </div>
              </label>
            ))}
          </div>
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                columns.forEach(col => {
                  if (!col.visible) onToggle(col.key);
                });
              }}
              className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Show All Columns
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
