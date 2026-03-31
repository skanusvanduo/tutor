"use client";

import { useState, memo } from "react";
import type { Exercise } from "@/lib/types";
import { getEffectiveCrop } from "@/lib/crop";

const difficultyBadgeColors: Record<number, string> = {
  1: "bg-emerald-500 text-white",
  2: "bg-teal-500 text-white",
  3: "bg-amber-500 text-white",
  4: "bg-orange-500 text-white",
  5: "bg-rose-500 text-white",
};

const difficultyBorderColors: Record<number, string> = {
  1: "border-l-emerald-400",
  2: "border-l-teal-400",
  3: "border-l-amber-400",
  4: "border-l-orange-400",
  5: "border-l-rose-400",
};

const difficultyLabels: Record<number, string> = {
  1: "Easy",
  2: "Medium",
  3: "Standard",
  4: "Hard",
  5: "Expert",
};

export async function copyImageToClipboard(
  dataUrl: string
): Promise<boolean> {
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    if (!blob) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}

export const ExerciseCard = memo(function ExerciseCard({
  exercise,
  onToggleSelect,
  onImageClick,
  animationIndex = 0,
}: {
  exercise: Exercise;
  onToggleSelect: (id: string) => void;
  onImageClick: (id: string) => void;
  animationIndex?: number;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );

  const handleCopy = async () => {
    const dataUrl = await getEffectiveCrop(
      exercise.croppedDataUrl,
      exercise.fullCroppedDataUrl,
      exercise.uncropPad,
      exercise.uncropExpand
    );
    const success = await copyImageToClipboard(dataUrl);
    if (success) {
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } else {
      setCopyState("failed");
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => setCopyState("idle"), 1500);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-copy-btn]") ||
      target.closest("[data-img-btn]")
    )
      return;
    onToggleSelect(exercise.id);
  };

  const truncatedFile =
    exercise.sourceFile.length > 25
      ? exercise.sourceFile.slice(0, 22) + "..."
      : exercise.sourceFile;

  const sourceInfo = exercise.topic
    ? `${truncatedFile} · ${exercise.topic}`
    : truncatedFile;

  const borderColor = exercise.selected
    ? "border-l-blue-500"
    : difficultyBorderColors[exercise.difficulty] || "border-l-gray-300";

  const cardImageSrc =
    exercise.croppedDataUrl !== exercise.displayCroppedDataUrl
      ? exercise.croppedDataUrl
      : exercise.displayCroppedDataUrl;

  return (
    <div
      className={`border border-gray-200 border-l-4 ${borderColor} rounded-lg bg-white overflow-hidden cursor-pointer transition-all duration-150 hover:shadow-md ${
        exercise.selected
          ? "ring-2 ring-blue-500 bg-blue-50"
          : "shadow-sm"
      }`}
      onClick={handleCardClick}
      style={{
        animation: `fade-in-up 0.35s ease-out ${animationIndex * 40}ms both`,
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={exercise.selected}
            readOnly
            className="w-5 h-5 accent-blue-600 pointer-events-none"
          />
          <span className="font-semibold text-sm">
            Ex. {exercise.exerciseNumber}
          </span>
        </div>
        <span
          className={`px-2 h-6 flex items-center text-[11px] font-bold rounded-full ${difficultyBadgeColors[exercise.difficulty] || "bg-gray-400 text-white"}`}
          title={difficultyLabels[exercise.difficulty]}
        >
          {difficultyLabels[exercise.difficulty]}
        </span>
      </div>

      <div
        data-img-btn
        className="p-2 cursor-pointer"
        onClick={() => onImageClick(exercise.id)}
        title="Click to adjust crop"
      >
        {exercise.bboxInvalid && (
          <div className="mb-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
            Full page shown — AI returned an oversized bounding box
          </div>
        )}
        <div className="flex items-center justify-center bg-gray-50 rounded overflow-hidden max-h-80 min-h-[100px]">
          <img
            src={cardImageSrc}
            alt={`Exercise ${exercise.exerciseNumber}`}
            className="max-w-full max-h-80 object-contain hover:opacity-90 transition-opacity"
          />
        </div>
      </div>

      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="text-xs text-gray-400 truncate" title={exercise.sourceFile}>
          {sourceInfo}
        </span>
        <button
          data-copy-btn
          onClick={handleCopy}
          className={`text-sm px-3 py-1.5 rounded-md cursor-pointer shrink-0 ml-2 transition-colors ${
            copyState === "copied"
              ? "border border-green-400 text-green-600 bg-green-50"
              : copyState === "failed"
                ? "border border-amber-400 text-amber-600"
                : "border border-gray-300 text-gray-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"
          }`}
        >
          {copyState === "copied"
            ? "Copied!"
            : copyState === "failed"
              ? "Opened"
              : "Copy"}
        </button>
      </div>
    </div>
  );
});
