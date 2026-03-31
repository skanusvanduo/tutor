"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import type { Exercise, UncropPad } from "@/lib/types";
import { cropFromFull } from "@/lib/crop";
import { copyImageToClipboard } from "./ExerciseCard";

export function ZoomModal({
  exercises,
  currentId,
  onClose,
  onNavigate,
  onSaveExpand,
}: {
  exercises: Exercise[];
  currentId: string;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onSaveExpand: (
    id: string,
    expand: UncropPad,
    adjustedDataUrl?: string
  ) => void;
}) {
  const currentIndex = exercises.findIndex((e) => e.id === currentId);
  const exercise = exercises[currentIndex];

  const [expand, setExpand] = useState<UncropPad>(
    exercise?.uncropExpand ?? { top: 0, right: 0, bottom: 0, left: 0 }
  );
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [dragging, setDragging] = useState<
    "top" | "bottom" | "left" | "right" | null
  >(null);
  const [imgNatural, setImgNatural] = useState<{
    w: number;
    h: number;
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const startPosRef = useRef(0);
  const startExpandRef = useRef(0);

  // Compute adjusted crop from current expand state
  const computeAndSave = useCallback(
    async (ex: Exercise, exp: UncropPad) => {
      const hasExpansion =
        exp.top !== 0 || exp.right !== 0 || exp.bottom !== 0 || exp.left !== 0;
      if (!hasExpansion) {
        // Reset to original display crop stored in fullCroppedDataUrl context
        // We need the original — but we don't have it separately. If expand is
        // all zeros, the original croppedDataUrl was already the display crop.
        // Only recompute if there was a previous expand that we're resetting from.
        if (
          ex.uncropExpand.top !== 0 ||
          ex.uncropExpand.right !== 0 ||
          ex.uncropExpand.bottom !== 0 ||
          ex.uncropExpand.left !== 0
        ) {
          // Recompute display crop (expand=0 means show original tight crop)
          const dataUrl = await cropFromFull(
            ex.fullCroppedDataUrl,
            ex.uncropPad,
            { top: 0, right: 0, bottom: 0, left: 0 }
          );
          onSaveExpand(ex.id, exp, dataUrl);
        } else {
          onSaveExpand(ex.id, exp);
        }
      } else {
        const dataUrl = await cropFromFull(
          ex.fullCroppedDataUrl,
          ex.uncropPad,
          exp
        );
        onSaveExpand(ex.id, exp, dataUrl);
      }
    },
    [onSaveExpand]
  );

  // Save expand when switching exercises
  const saveAndNavigate = useCallback(
    (newId: string) => {
      if (exercise) computeAndSave(exercise, expand);
      const newEx = exercises.find((e) => e.id === newId);
      setExpand(
        newEx?.uncropExpand ?? { top: 0, right: 0, bottom: 0, left: 0 }
      );
      setCopyState("idle");
      setImgNatural(null);
      onNavigate(newId);
    },
    [exercise, expand, exercises, computeAndSave, onNavigate]
  );

  const handleClose = useCallback(() => {
    if (exercise) computeAndSave(exercise, expand);
    onClose();
  }, [exercise, expand, computeAndSave, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) saveAndNavigate(exercises[currentIndex - 1].id);
  }, [currentIndex, exercises, saveAndNavigate]);

  const goNext = useCallback(() => {
    if (currentIndex < exercises.length - 1)
      saveAndNavigate(exercises[currentIndex + 1].id);
  }, [currentIndex, exercises, saveAndNavigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose, goPrev, goNext]);

  if (!exercise) return null;

  const pad = exercise.uncropPad;
  const hasFullCrop = exercise.fullCroppedDataUrl !== exercise.croppedDataUrl;

  // Clip percentages (of the full image) for the dimmed overlay
  const clipTopPct = imgNatural
    ? ((pad.top - expand.top) / imgNatural.h) * 100
    : 0;
  const clipBottomPct = imgNatural
    ? ((pad.bottom - expand.bottom) / imgNatural.h) * 100
    : 0;
  const clipLeftPct = imgNatural
    ? ((pad.left - expand.left) / imgNatural.w) * 100
    : 0;
  const clipRightPct = imgNatural
    ? ((pad.right - expand.right) / imgNatural.w) * 100
    : 0;

  const handlePointerDown = (
    edge: "top" | "bottom" | "left" | "right",
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(edge);
    startPosRef.current =
      edge === "top" || edge === "bottom" ? e.clientY : e.clientX;
    startExpandRef.current = expand[edge];
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !imgRef.current || !imgNatural) return;
    const rect = imgRef.current.getBoundingClientRect();

    let delta: number;
    let scale: number;
    let maxExpand: number;

    // Display area dimensions (full image minus padding)
    const displayH = imgNatural.h - pad.top - pad.bottom;
    const displayW = imgNatural.w - pad.left - pad.right;

    if (dragging === "top") {
      delta = startPosRef.current - e.clientY;
      scale = imgNatural.h / rect.height;
      maxExpand = pad.top;
    } else if (dragging === "bottom") {
      delta = e.clientY - startPosRef.current;
      scale = imgNatural.h / rect.height;
      maxExpand = pad.bottom;
    } else if (dragging === "left") {
      delta = startPosRef.current - e.clientX;
      scale = imgNatural.w / rect.width;
      maxExpand = pad.left;
    } else {
      delta = e.clientX - startPosRef.current;
      scale = imgNatural.w / rect.width;
      maxExpand = pad.right;
    }

    // Allow negative values (crop inward) but keep at least 10% of display area visible
    const isVertical = dragging === "top" || dragging === "bottom";
    const oppositeExpand = isVertical
      ? expand[dragging === "top" ? "bottom" : "top"]
      : expand[dragging === "left" ? "right" : "left"];
    const displayDim = isVertical ? displayH : displayW;
    // Min visible = 10% of display crop dimension
    const minVisible = displayDim * 0.1;
    const minExpand = -(displayDim - minVisible - Math.min(0, oppositeExpand));

    const newVal = Math.max(
      minExpand,
      Math.min(maxExpand, startExpandRef.current + delta * scale)
    );
    setExpand((prev) => ({ ...prev, [dragging]: newVal }));
  };

  const handlePointerUp = () => {
    setDragging(null);
  };

  const handleCopy = async () => {
    let dataUrl: string;
    if (
      expand.top === 0 &&
      expand.right === 0 &&
      expand.bottom === 0 &&
      expand.left === 0
    ) {
      dataUrl = exercise.croppedDataUrl;
    } else {
      dataUrl = await cropFromFull(
        exercise.fullCroppedDataUrl,
        pad,
        expand
      );
    }
    const success = await copyImageToClipboard(dataUrl);
    setCopyState(success ? "copied" : "idle");
    if (success) setTimeout(() => setCopyState("idle"), 1500);
    if (!success) {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-4xl max-h-[90vh] w-full flex flex-col overflow-hidden max-sm:max-h-full max-sm:rounded-none max-sm:m-0"
        onClick={(e) => e.stopPropagation()}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="text-sm font-medium">
            Exercise {exercise.exerciseNumber} — {exercise.sourceFile} (p
            {exercise.pageNumber})
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {currentIndex + 1} / {exercises.length}
            </span>
            {hasFullCrop && (
              <span className="text-xs text-blue-500">
                Drag edges to adjust crop
              </span>
            )}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none cursor-pointer px-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Image with uncrop overlays */}
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
          <div className="relative inline-block">
            <img
              ref={imgRef}
              src={exercise.fullCroppedDataUrl}
              alt={`Exercise ${exercise.exerciseNumber}`}
              className="max-w-full border rounded block"
              onLoad={() => {
                if (imgRef.current) {
                  setImgNatural({
                    w: imgRef.current.naturalWidth,
                    h: imgRef.current.naturalHeight,
                  });
                }
              }}
            />

            {/* Dimmed overlays for padding areas */}
            {hasFullCrop && imgNatural && (
              <>
                {/* Top dim */}
                {clipTopPct > 0.5 && (
                  <div
                    className="absolute left-0 right-0 top-0 bg-black/25 pointer-events-none"
                    style={{ height: `${clipTopPct}%` }}
                  />
                )}
                {/* Bottom dim */}
                {clipBottomPct > 0.5 && (
                  <div
                    className="absolute left-0 right-0 bottom-0 bg-black/25 pointer-events-none"
                    style={{ height: `${clipBottomPct}%` }}
                  />
                )}
                {/* Left dim */}
                {clipLeftPct > 0.5 && (
                  <div
                    className="absolute left-0 bg-black/25 pointer-events-none"
                    style={{
                      top: `${clipTopPct}%`,
                      bottom: `${clipBottomPct}%`,
                      width: `${clipLeftPct}%`,
                    }}
                  />
                )}
                {/* Right dim */}
                {clipRightPct > 0.5 && (
                  <div
                    className="absolute right-0 bg-black/25 pointer-events-none"
                    style={{
                      top: `${clipTopPct}%`,
                      bottom: `${clipBottomPct}%`,
                      width: `${clipRightPct}%`,
                    }}
                  />
                )}

                {/* Drag handles — always shown for bidirectional crop */}
                {/* Top handle */}
                <div
                  className="absolute left-0 right-0 cursor-ns-resize z-10"
                  style={{
                    top: `calc(${clipTopPct}% - 8px)`,
                    height: "16px",
                  }}
                  onPointerDown={(e) => handlePointerDown("top", e)}
                >
                  <div className="mx-auto w-20 h-1.5 bg-blue-400 rounded-full mt-[7px]" />
                </div>
                {/* Bottom handle */}
                <div
                  className="absolute left-0 right-0 cursor-ns-resize z-10"
                  style={{
                    bottom: `calc(${clipBottomPct}% - 8px)`,
                    height: "16px",
                  }}
                  onPointerDown={(e) => handlePointerDown("bottom", e)}
                >
                  <div className="mx-auto w-20 h-1.5 bg-blue-400 rounded-full mt-[7px]" />
                </div>
                {/* Left handle */}
                <div
                  className="absolute top-0 bottom-0 cursor-ew-resize z-10"
                  style={{
                    left: `calc(${clipLeftPct}% - 8px)`,
                    width: "16px",
                  }}
                  onPointerDown={(e) => handlePointerDown("left", e)}
                >
                  <div className="my-auto h-20 w-1.5 bg-blue-400 rounded-full ml-[7px] mt-[40%]" />
                </div>
                {/* Right handle */}
                <div
                  className="absolute top-0 bottom-0 cursor-ew-resize z-10"
                  style={{
                    right: `calc(${clipRightPct}% - 8px)`,
                    width: "16px",
                  }}
                  onPointerDown={(e) => handlePointerDown("right", e)}
                >
                  <div className="my-auto h-20 w-1.5 bg-blue-400 rounded-full ml-[7px] mt-[40%]" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="min-w-[44px] min-h-[44px] px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            Prev
          </button>
          <button
            onClick={handleCopy}
            className={`px-4 py-1.5 rounded text-sm font-medium cursor-pointer ${
              copyState === "copied"
                ? "bg-green-100 text-green-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {copyState === "copied" ? "Copied!" : "Copy to Clipboard"}
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex === exercises.length - 1}
            className="min-w-[44px] min-h-[44px] px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
