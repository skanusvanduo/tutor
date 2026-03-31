"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type {
  PageImage,
  Exercise,
  AppPhase,
  BoundingBox,
  PageClassification,
  PageType,
  UncropPad,
} from "@/lib/types";

const loadPdfRenderer = () =>
  import("@/lib/pdf-renderer").then((m) => m.renderPdfToImages);
const loadCrop = () => import("@/lib/crop").then((m) => m.cropExercise);
const loadCropFull = () =>
  import("@/lib/crop").then((m) => m.cropExerciseFull);
const loadCompress = () =>
  import("@/lib/compress").then((m) => m.compressForApi);

interface ExtractionProgress {
  current: number;
  total: number;
  label: string;
}

interface ApiExercise {
  exercise_id?: string;
  description?: string;
  difficulty?: number;
  has_diagram?: boolean;
  sub_items?: string[];
  topic?: string;
  bbox?: { top?: number; left?: number; bottom?: number; right?: number };
}

const ZERO_PAD: UncropPad = { top: 0, right: 0, bottom: 0, left: 0 };

export function useExercises() {
  const [phase, setPhase] = useState<AppPhase>("upload");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [progress, setProgress] = useState<ExtractionProgress>({
    current: 0,
    total: 0,
    label: "",
  });
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const cancelledRef = useRef(false);

  const selectedExercises = useMemo(
    () => exercises.filter((e) => e.selected),
    [exercises]
  );

  const filteredExercises = useMemo(() => {
    if (difficultyFilter === "all") return exercises;
    const level = parseInt(difficultyFilter, 10);
    if (!isNaN(level)) return exercises.filter((e) => e.difficulty === level);
    return exercises;
  }, [exercises, difficultyFilter]);

  const difficultyCounts = useMemo(() => {
    const counts: Record<string, number> = { all: exercises.length };
    for (let i = 1; i <= 5; i++) {
      counts[String(i)] = exercises.filter((e) => e.difficulty === i).length;
    }
    return counts;
  }, [exercises]);

  // Step 1: User selects files — go straight to processing
  const handleFilesSelected = useCallback((files: File[]) => {
    confirmAndProcess(files);
  }, [confirmAndProcess]);

  // Step 2: User confirms — process all files
  const cancelProcessing = useCallback(() => {
    cancelledRef.current = true;
    setPhase("upload");
    setProgress({ current: 0, total: 0, label: "" });
  }, []);

  const confirmAndProcess = useCallback(async (files?: File[]) => {
    const filesToProcess = files ?? pendingFiles;
    if (filesToProcess.length === 0) return;
    cancelledRef.current = false;
    setError(null);
    setPendingFiles(filesToProcess);
    setPhase("rendering");

    try {
      const renderPdfToImages = await loadPdfRenderer();
      const allPages: (PageImage & { sourceFile: string })[] = [];

      let totalRendered = 0;

      for (let fi = 0; fi < filesToProcess.length; fi++) {
        const file = filesToProcess[fi];
        const pages = await renderPdfToImages(file, (current, total) => {
          setProgress({
            current: totalRendered + current,
            total,
            label: `Rendering ${file.name} — page ${current}/${total} (PDF ${fi + 1}/${filesToProcess.length})`,
          });
        });
        for (const p of pages) {
          allPages.push({ ...p, sourceFile: file.name });
        }
        totalRendered += pages.length;
      }

      // Classify pages
      setPhase("classifying");
      const classifications: (PageClassification & { sourceFile: string })[] =
        [];

      for (let i = 0; i < allPages.length; i++) {
        if (cancelledRef.current) break;
        setProgress({
          current: i + 1,
          total: allPages.length,
          label: `Classifying page ${i + 1} of ${allPages.length} (${allPages[i].sourceFile})...`,
        });

        const compressForApi = await loadCompress();
        const base64 = await compressForApi(allPages[i].dataUrl);

        try {
          const res = await fetch("/api/classify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              pageNumber: allPages[i].pageNumber,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            classifications.push({
              pageNumber: allPages[i].pageNumber,
              pageType: data.pageType as PageType,
              hasExercises: data.hasExercises,
              exerciseCountEstimate: data.exerciseCountEstimate,
              notes: data.notes,
              sourceFile: allPages[i].sourceFile,
            });
          } else {
            classifications.push({
              pageNumber: allPages[i].pageNumber,
              pageType: "mixed",
              hasExercises: true,
              exerciseCountEstimate: 0,
              notes: "Classification request failed",
              sourceFile: allPages[i].sourceFile,
            });
          }
        } catch {
          classifications.push({
            pageNumber: allPages[i].pageNumber,
            pageType: "mixed",
            hasExercises: true,
            exerciseCountEstimate: 0,
            notes: "Classification request error",
            sourceFile: allPages[i].sourceFile,
          });
        }

        if (i < allPages.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (cancelledRef.current) return;

      const pagesWithExercises = classifications.filter((c) => c.hasExercises);
      const skippedCount = allPages.length - pagesWithExercises.length;

      // Extract exercises
      setPhase("extracting");
      const allExercises: Exercise[] = [];
      let lastExerciseId: string | undefined;

      for (let i = 0; i < pagesWithExercises.length; i++) {
        if (cancelledRef.current) break;
        const classification = pagesWithExercises[i];
        setProgress({
          current: i + 1,
          total: pagesWithExercises.length,
          label: `Extracting from page ${classification.pageNumber} of ${classification.sourceFile} (${i + 1}/${pagesWithExercises.length}, skipped ${skippedCount})...`,
        });

        const page = allPages.find(
          (p) =>
            p.pageNumber === classification.pageNumber &&
            p.sourceFile === classification.sourceFile
        )!;
        const compressForApi = await loadCompress();
        const base64 = await compressForApi(page.dataUrl);

        // Log what context is being sent
        const expectedNext = lastExerciseId
          ? parseInt(lastExerciseId, 10) + 1
          : undefined;
        console.log(
          `[${classification.sourceFile} p${classification.pageNumber}] Sending extraction request. lastExerciseId=${lastExerciseId ?? "none"}, expecting exercises to start at ${expectedNext ?? "unknown"}`
        );

        try {
          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              pageNumber: classification.pageNumber,
              pageType: classification.pageType,
              lastExerciseId,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const extracted: ApiExercise[] = data.exercises || [];

            const extractedIds = extracted.map((e: ApiExercise) => e.exercise_id).join(", ");
            console.log(
              `[${classification.sourceFile} p${classification.pageNumber}] Found exercises [${extractedIds}]. Expected to start at ${expectedNext ?? "unknown"}.`
            );
            console.log(
              `[${classification.sourceFile} p${classification.pageNumber}] Raw Claude response:`,
              JSON.stringify(extracted, null, 2)
            );

            for (let j = 0; j < extracted.length; j++) {
              const ex = extracted[j];

              // Per-exercise pixel detection: only convert if THIS exercise has values > 100
              const exHasPixels =
                (ex.bbox?.top ?? 0) > 100 ||
                (ex.bbox?.left ?? 0) > 100 ||
                (ex.bbox?.bottom ?? 0) > 100 ||
                (ex.bbox?.right ?? 0) > 100;

              let bbox: BoundingBox;
              if (exHasPixels) {
                console.warn(
                  `[${classification.sourceFile} p${classification.pageNumber}] Exercise ${ex.exercise_id}: bbox >100 — converting pixels to percentages (${page.width}x${page.height})`,
                  ex.bbox
                );
                bbox = {
                  top: ((ex.bbox?.top ?? 0) / page.height) * 100,
                  left: ((ex.bbox?.left ?? 0) / page.width) * 100,
                  bottom:
                    ((ex.bbox?.bottom ?? page.height) / page.height) * 100,
                  right: ((ex.bbox?.right ?? page.width) / page.width) * 100,
                };
              } else {
                bbox = {
                  top: ex.bbox?.top ?? 0,
                  left: ex.bbox?.left ?? 0,
                  bottom: ex.bbox?.bottom ?? 100,
                  right: ex.bbox?.right ?? 100,
                };
              }

              // Discard full-page detections
              if (bbox.top < 3 && bbox.bottom > 90) {
                console.warn(
                  `[${classification.sourceFile} p${classification.pageNumber}] Exercise ${ex.exercise_id}: DISCARDED — full-page bbox`
                );
                continue;
              }

              // Discard tiny bboxes (likely table cells or answer choices)
              const bboxHeight = bbox.bottom - bbox.top;
              const bboxWidth = bbox.right - bbox.left;
              if (bboxHeight < 3 && bboxWidth < 30) {
                console.warn(
                  `[${classification.sourceFile} p${classification.pageNumber}] Exercise ${ex.exercise_id}: DISCARDED — too small (${bboxHeight.toFixed(1)}% h × ${bboxWidth.toFixed(1)}% w)`
                );
                continue;
              }

              const bboxArea =
                ((bbox.right - bbox.left) * (bbox.bottom - bbox.top)) / 100;
              const bboxInvalid = bboxArea > 40;

              if (bboxInvalid) {
                console.warn(
                  `[${classification.sourceFile} p${classification.pageNumber}] Exercise ${ex.exercise_id}: bbox covers ${bboxArea.toFixed(1)}% — flagged`,
                  bbox
                );
              }

              allExercises.push({
                id: `${classification.sourceFile}-p${classification.pageNumber}-ex${j}`,
                pageNumber: classification.pageNumber,
                exerciseNumber:
                  ex.exercise_id ||
                  `${classification.pageNumber}.${j + 1}`,
                description: ex.topic || ex.description || "",
                difficulty: Math.min(5, Math.max(1, ex.difficulty || 3)),
                hasDiagram: ex.has_diagram || false,
                subItems: ex.sub_items || [],
                topic: ex.topic || "",
                bbox,
                bboxInvalid,
                displayCroppedDataUrl: "",
                croppedDataUrl: "",
                fullCroppedDataUrl: "",
                uncropPad: ZERO_PAD,
                uncropExpand: ZERO_PAD,
                sourceFile: classification.sourceFile,
                selected: false,
              });
            }

            // Track last exercise ID for page context
            if (extracted.length > 0) {
              const lastEx = extracted[extracted.length - 1];
              if (lastEx.exercise_id) {
                lastExerciseId = lastEx.exercise_id;
              }
            }

            // Gap detection + targeted re-scan (once per page)
            if (extracted.length >= 2) {
              // Split into columns and sort
              const withBbox = extracted
                .filter((e: ApiExercise) => e.bbox && e.exercise_id)
                .map((e: ApiExercise) => ({
                  id: parseInt(e.exercise_id!, 10),
                  idStr: e.exercise_id!,
                  left: e.bbox!.left ?? 0,
                  top: e.bbox!.top ?? 0,
                  bottom: e.bbox!.bottom ?? 100,
                }));

              const leftCol = withBbox
                .filter((e) => e.left < 50)
                .sort((a, b) => a.top - b.top);
              const rightCol = withBbox
                .filter((e) => e.left >= 50)
                .sort((a, b) => a.top - b.top);

              type GapInfo = {
                missingIds: string[];
                column: "left" | "right";
                topPct: number;
                bottomPct: number;
              };
              const gaps: GapInfo[] = [];

              for (const [col, colName] of [
                [leftCol, "left"],
                [rightCol, "right"],
              ] as const) {
                for (let k = 0; k < col.length - 1; k++) {
                  const curr = col[k];
                  const next = col[k + 1];
                  if (
                    !isNaN(curr.id) &&
                    !isNaN(next.id) &&
                    next.id - curr.id > 1
                  ) {
                    const missing: string[] = [];
                    for (let m = curr.id + 1; m < next.id; m++) {
                      missing.push(String(m));
                    }
                    if (missing.length > 0 && missing.length <= 5) {
                      console.warn(
                        `[${classification.sourceFile} p${classification.pageNumber}] Gap detected: missing exercises ${missing.join(", ")} between exercise ${curr.id} (bottom: ${curr.bottom.toFixed(0)}%) and exercise ${next.id} (top: ${next.top.toFixed(0)}%) in ${colName} column.`
                      );
                      gaps.push({
                        missingIds: missing,
                        column: colName,
                        topPct: curr.bottom,
                        bottomPct: next.top,
                      });
                    }
                  }
                }
              }

              // Targeted re-scan for each gap (one API call per gap, once per page)
              for (const gap of gaps) {
                console.log(
                  `[${classification.sourceFile} p${classification.pageNumber}] Targeted re-scan for missing exercises [${gap.missingIds.join(", ")}] in ${gap.column} column (${gap.topPct.toFixed(0)}%-${gap.bottomPct.toFixed(0)}%)`
                );
                try {
                  const gapRes = await fetch("/api/extract", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      imageBase64: base64,
                      pageNumber: classification.pageNumber,
                      pageType: classification.pageType,
                      targetedScan: gap,
                    }),
                  });

                  if (gapRes.ok) {
                    const gapData = await gapRes.json();
                    const gapExercises: ApiExercise[] =
                      gapData.exercises || [];
                    console.log(
                      `[${classification.sourceFile} p${classification.pageNumber}] Targeted scan found ${gapExercises.length} exercises: [${gapExercises.map((e: ApiExercise) => e.exercise_id).join(", ")}]`
                    );

                    // Process and add gap exercises
                    for (const gapEx of gapExercises) {
                      // Skip if we already have this exercise
                      const existingIds = new Set(
                        allExercises
                          .filter(
                            (ae) =>
                              ae.sourceFile === classification.sourceFile &&
                              ae.pageNumber === classification.pageNumber
                          )
                          .map((ae) => ae.exerciseNumber)
                      );
                      if (existingIds.has(gapEx.exercise_id || "")) continue;

                      const gapBbox: BoundingBox = {
                        top: gapEx.bbox?.top ?? 0,
                        left: gapEx.bbox?.left ?? 0,
                        bottom: gapEx.bbox?.bottom ?? 100,
                        right: gapEx.bbox?.right ?? 100,
                      };

                      const gapBboxArea =
                        ((gapBbox.right - gapBbox.left) *
                          (gapBbox.bottom - gapBbox.top)) /
                        100;

                      allExercises.push({
                        id: `${classification.sourceFile}-p${classification.pageNumber}-gap-${gapEx.exercise_id}`,
                        pageNumber: classification.pageNumber,
                        exerciseNumber: gapEx.exercise_id || "?",
                        description: gapEx.topic || gapEx.description || "",
                        difficulty: Math.min(
                          5,
                          Math.max(1, gapEx.difficulty || 3)
                        ),
                        hasDiagram: gapEx.has_diagram || false,
                        subItems: gapEx.sub_items || [],
                        topic: gapEx.topic || "",
                        bbox: gapBbox,
                        bboxInvalid: gapBboxArea > 40,
                        displayCroppedDataUrl: "",
                        croppedDataUrl: "",
                        fullCroppedDataUrl: "",
                        uncropPad: ZERO_PAD,
                        uncropExpand: ZERO_PAD,
                        sourceFile: classification.sourceFile,
                        selected: false,
                      });
                    }

                    // Update lastExerciseId if gap exercises extend further
                    if (gapExercises.length > 0) {
                      const allPageIds = allExercises
                        .filter(
                          (ae) =>
                            ae.sourceFile === classification.sourceFile &&
                            ae.pageNumber === classification.pageNumber
                        )
                        .map((ae) => parseInt(ae.exerciseNumber, 10))
                        .filter((n) => !isNaN(n));
                      if (allPageIds.length > 0) {
                        lastExerciseId = String(Math.max(...allPageIds));
                      }
                    }
                  }
                } catch (gapErr) {
                  console.error(
                    `Targeted scan failed for gap [${gap.missingIds.join(", ")}]:`,
                    gapErr
                  );
                }
              }
            }
          }
        } catch (err) {
          console.error(
            `Extraction failed for ${classification.sourceFile} p${classification.pageNumber}:`,
            err
          );
        }

        if (i < pagesWithExercises.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      if (cancelledRef.current) return;

      // Crop exercises (both display and full)
      const cropExercise = await loadCrop();
      const cropExerciseFull = await loadCropFull();
      setPhase("cropping");

      for (let i = 0; i < allExercises.length; i++) {
        if (cancelledRef.current) break;
        setProgress({
          current: i + 1,
          total: allExercises.length,
          label: `Cropping exercise ${i + 1} of ${allExercises.length}...`,
        });

        const page = allPages.find(
          (p) =>
            p.pageNumber === allExercises[i].pageNumber &&
            p.sourceFile === allExercises[i].sourceFile
        )!;

        if (allExercises[i].bboxInvalid) {
          allExercises[i].displayCroppedDataUrl = page.dataUrl;
          allExercises[i].croppedDataUrl = page.dataUrl;
          allExercises[i].fullCroppedDataUrl = page.dataUrl;
          allExercises[i].uncropPad = ZERO_PAD;
        } else {
          const tightCrop = await cropExercise(
            page.dataUrl,
            allExercises[i].bbox
          );
          allExercises[i].displayCroppedDataUrl = tightCrop;
          allExercises[i].croppedDataUrl = tightCrop;
          const full = await cropExerciseFull(
            page.dataUrl,
            allExercises[i].bbox
          );
          allExercises[i].fullCroppedDataUrl = full.dataUrl;
          allExercises[i].uncropPad = full.pad;
        }
      }

      if (cancelledRef.current) return;

      setExercises(allExercises);
      setPendingFiles([]);
      setPhase("review");
    } catch (err) {
      console.error("Processing error:", err);
      setError(
        `Processing failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
      setPhase("upload");
    }
  }, [pendingFiles]);

  // Selection
  const toggleSelection = useCallback((id: string) => {
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e))
    );
  }, []);

  const selectAllVisible = useCallback(() => {
    const visibleIds = new Set(filteredExercises.map((e) => e.id));
    setExercises((prev) =>
      prev.map((e) => (visibleIds.has(e.id) ? { ...e, selected: true } : e))
    );
  }, [filteredExercises]);

  const clearSelection = useCallback(() => {
    setExercises((prev) => prev.map((e) => ({ ...e, selected: false })));
  }, []);

  // Update uncrop expand + adjusted thumbnail for an exercise
  const updateUncropExpand = useCallback(
    (id: string, expand: UncropPad, adjustedDataUrl?: string) => {
      setExercises((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                uncropExpand: expand,
                ...(adjustedDataUrl !== undefined
                  ? { croppedDataUrl: adjustedDataUrl }
                  : {}),
              }
            : e
        )
      );
    },
    []
  );

  const resetApp = useCallback(() => {
    setPhase("upload");
    setExercises([]);
    setProgress({ current: 0, total: 0, label: "" });
    setError(null);
    setPendingFiles([]);
    setDifficultyFilter("all");
  }, []);

  return {
    phase,
    exercises,
    filteredExercises,
    selectedExercises,
    progress,
    difficultyFilter,
    difficultyCounts,
    error,
    setDifficultyFilter,
    handleFilesSelected,
    cancelProcessing,
    toggleSelection,
    selectAllVisible,
    clearSelection,
    updateUncropExpand,
    resetApp,
  };
}
