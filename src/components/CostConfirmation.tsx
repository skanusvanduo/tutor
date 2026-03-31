"use client";

interface CostEstimate {
  files: { name: string; pageCount: number }[];
  totalPages: number;
  estimatedCost: number;
}

export function CostConfirmation({
  estimate,
  onConfirm,
  onCancel,
}: {
  estimate: CostEstimate;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-2xl w-full max-w-md">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Ready to process?
        </h2>

        <div className="mb-4 text-sm text-gray-700 space-y-1.5">
          {estimate.files.map((f) => (
            <div key={f.name} className="flex justify-between">
              <span className="truncate mr-4">{f.name}</span>
              <span className="text-gray-400 shrink-0">
                {f.pageCount} pages
              </span>
            </div>
          ))}
        </div>

        <div className="border-t pt-3 mb-5 text-sm">
          <p>
            <strong>{estimate.files.length}</strong> PDF
            {estimate.files.length !== 1 ? "s" : ""},{" "}
            <strong>~{estimate.totalPages}</strong> pages total
          </p>
          <p className="text-gray-500 mt-1">
            Each page costs ~$0.02. Estimated cost:{" "}
            <strong>~${estimate.estimatedCost.toFixed(2)}</strong>
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 cursor-pointer"
          >
            Proceed
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
