"use client";

export function ExtractionProgress({
  current,
  total,
  label,
  onCancel,
}: {
  current: number;
  total: number;
  label: string;
  onCancel?: () => void;
}) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-gray-600 mb-3">{label}</p>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">{percent}%</p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
