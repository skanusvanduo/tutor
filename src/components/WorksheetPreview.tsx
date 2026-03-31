"use client";

import { useEffect, useState, useCallback } from "react";
import type { Exercise } from "@/lib/types";
import { generateWorksheetPages } from "@/lib/worksheet";
import { copyImageToClipboard } from "./ExerciseCard";

export function WorksheetPreview({
  exercises,
  onClose,
}: {
  exercises: Exercise[];
  onClose: () => void;
}) {
  const [pages, setPages] = useState<string[]>([]);
  const [generating, setGenerating] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    generateWorksheetPages(exercises).then((p) => {
      setPages(p);
      setGenerating(false);
    });
  }, [exercises]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleCopyPage = useCallback(async () => {
    if (!pages[currentPage]) return;
    const success = await copyImageToClipboard(pages[currentPage]);
    setCopyState(success ? "copied" : "idle");
    if (success) setTimeout(() => setCopyState("idle"), 1500);
    if (!success) {
      const res = await fetch(pages[currentPage]);
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    }
  }, [pages, currentPage]);

  const handleDownloadPdf = useCallback(async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { getEffectiveCrop } = await import("@/lib/crop");

      // A4 dimensions in mm
      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const marginMm = 12;
      const contentWidthMm = pageWidthMm - marginMm * 2; // 186mm
      const workspaceHeightMm = 80; // blank space for writing below each exercise
      const labelHeightMm = 8;
      const separatorGapMm = 4;

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let yMm = marginMm;
      let pageStarted = true;

      const loadImg = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];

        // Get effective crop for this exercise
        const cropUrl = await getEffectiveCrop(
          ex.croppedDataUrl,
          ex.fullCroppedDataUrl,
          ex.uncropPad,
          ex.uncropExpand
        );

        // Load image and render to a small 1200px-wide canvas as JPEG
        const img = await loadImg(cropUrl);
        const canvasW = 1200;
        const canvasH = Math.round(
          (img.naturalHeight / img.naturalWidth) * canvasW
        );

        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.drawImage(img, 0, 0, canvasW, canvasH);

        const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85);

        // Calculate image height in mm (proportional to width)
        const imgHeightMm = (canvasH / canvasW) * contentWidthMm;
        const sectionHeightMm =
          labelHeightMm + imgHeightMm + workspaceHeightMm + separatorGapMm;

        // Check if we need a new page
        if (
          !pageStarted ||
          yMm + sectionHeightMm > pageHeightMm - marginMm
        ) {
          if (!pageStarted || i > 0) {
            doc.addPage();
            yMm = marginMm;
          }
          pageStarted = false;
        }

        // Exercise label
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`${i + 1}.`, marginMm, yMm + 5);
        yMm += labelHeightMm;

        // Exercise image
        doc.addImage(
          jpegDataUrl,
          "JPEG",
          marginMm,
          yMm,
          contentWidthMm,
          imgHeightMm
        );
        yMm += imgHeightMm;

        // Workspace (blank space)
        yMm += workspaceHeightMm;

        // Separator line (skip for last)
        if (i < exercises.length - 1) {
          doc.setDrawColor(209, 213, 219);
          doc.setLineWidth(0.3);
          doc.line(
            marginMm,
            yMm,
            pageWidthMm - marginMm,
            yMm
          );
          yMm += separatorGapMm;
        }

        // Release the canvas
        canvas.width = 0;
        canvas.height = 0;
      }

      const date = new Date().toISOString().split("T")[0];
      doc.save(`worksheet_${date}.pdf`);
    } catch (err) {
      console.error("PDF download error:", err);
    }
    setDownloading(false);
  }, [exercises]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden w-full max-w-5xl max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 shrink-0">
          <div className="text-sm font-medium">
            Worksheet Preview — {exercises.length} exercise
            {exercises.length !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-3">
            {pages.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.max(0, p - 1))
                  }
                  disabled={currentPage === 0}
                  className="px-2 py-1 text-sm bg-gray-200 rounded disabled:opacity-30 cursor-pointer disabled:cursor-default"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage + 1} of {pages.length}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(pages.length - 1, p + 1)
                    )
                  }
                  disabled={currentPage === pages.length - 1}
                  className="px-2 py-1 text-sm bg-gray-200 rounded disabled:opacity-30 cursor-pointer disabled:cursor-default"
                >
                  Next
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none cursor-pointer px-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content — scrollable, image at full modal width */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
          {generating ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">
                Generating worksheet...
              </p>
            </div>
          ) : pages.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No pages generated.</p>
          ) : (
            <img
              src={pages[currentPage]}
              alt={`Worksheet page ${currentPage + 1}`}
              className="w-full border shadow-lg bg-white rounded"
            />
          )}
        </div>

        {/* Footer */}
        {!generating && pages.length > 0 && (
          <div className="flex items-center justify-center gap-4 px-4 py-3 border-t bg-gray-50 shrink-0">
            <button
              onClick={handleCopyPage}
              className={`px-4 py-2 rounded text-sm font-medium cursor-pointer ${
                copyState === "copied"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {copyState === "copied"
                ? "Copied!"
                : `Copy Page ${currentPage + 1} to Clipboard`}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {downloading ? "Generating PDF..." : "Download All as PDF"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
