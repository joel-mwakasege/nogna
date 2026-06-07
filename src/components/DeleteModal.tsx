import { Button } from './Button';

interface DeleteModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteModal({
  isOpen,
  title,
  message,
  itemName,
  isLoading = false,
  onConfirm,
  onCancel,
}: DeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 lg:p-8 max-w-md w-full">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">{title}</h2>
        <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
          {message} <span className="font-semibold">{itemName}</span>
        </p>
        <p className="text-xs sm:text-sm text-red-600 bg-red-50 p-3 rounded mb-4 sm:mb-6">
          This action cannot be undone.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 w-full"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isLoading}
            className="flex-1 w-full bg-red-600 hover:bg-red-700"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
