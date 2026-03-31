"use client";

import { useRef, useState } from "react";

export function FileUpload({
  onFilesSelected,
}: {
  onFilesSelected: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className={`border-2 border-dashed rounded-2xl p-12 w-full max-w-md text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? "border-blue-500 bg-blue-100/60 scale-[1.02] shadow-lg"
            : "border-blue-300 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-500"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="text-4xl mb-4">{dragging ? "📥" : "📄"}</div>
        <h2 className="text-lg font-semibold text-blue-600 mb-1">
          Upload PDFs
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Drag PDF files here or click to browse
        </p>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium cursor-pointer transition-colors">
          Choose Files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const fileList = e.target.files;
            if (fileList && fileList.length > 0) {
              onFilesSelected(Array.from(fileList));
            }
          }}
        />
      </div>
    </div>
  );
}
