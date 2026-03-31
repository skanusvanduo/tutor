"use client";

import { useState } from "react";
import { useExercises } from "@/hooks/useExercises";
import { FileUpload } from "@/components/FileUpload";
import { ExtractionProgress } from "@/components/ExtractionProgress";
import { ExerciseGrid } from "@/components/ExerciseGrid";
import { ZoomModal } from "@/components/ZoomModal";
import { WorksheetPreview } from "@/components/WorksheetPreview";

export default function Home() {
  const {
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
  } = useExercises();

  const [zoomExerciseId, setZoomExerciseId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [showWorksheet, setShowWorksheet] = useState(false);

  const handleClearAll = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    setClearConfirm(false);
    resetApp();
  };

  const uniqueFiles = new Set(exercises.map((e) => e.sourceFile));

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-white">
          Tutor Exercise Picker
        </h1>
        <div className="flex items-center gap-4">
          {phase === "review" && (
            <span className="text-sm text-white/80">
              {uniqueFiles.size} PDF{uniqueFiles.size !== 1 ? "s" : ""},{" "}
              {exercises.length} exercises
            </span>
          )}
          {phase !== "upload" && (
            <button
              onClick={handleClearAll}
              className={`text-sm cursor-pointer px-3 py-1 rounded ${
                clearConfirm
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              {clearConfirm
                ? `Clear all ${exercises.length} exercises? Click to confirm`
                : "Clear All"}
            </button>
          )}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Upload phase */}
      {phase === "upload" && (
        <FileUpload onFilesSelected={handleFilesSelected} />
      )}

      {/* Processing phases */}
      {(phase === "rendering" ||
        phase === "classifying" ||
        phase === "extracting" ||
        phase === "cropping") && (
        <ExtractionProgress
          current={progress.current}
          total={progress.total}
          label={progress.label}
          onCancel={cancelProcessing}
        />
      )}

      {/* Review phase */}
      {phase === "review" && (
        <main className="flex-1 overflow-y-auto p-4 pb-20">
          <ExerciseGrid
            exercises={filteredExercises}
            totalCount={exercises.length}
            selectedCount={selectedExercises.length}
            difficultyFilter={difficultyFilter}
            difficultyCounts={difficultyCounts}
            onDifficultyFilter={setDifficultyFilter}
            onToggleSelect={toggleSelection}
            onSelectAllVisible={selectAllVisible}
            onDeselectAll={clearSelection}
            onImageClick={setZoomExerciseId}
          />
        </main>
      )}

      {/* Sticky bottom selection bar */}
      {phase === "review" && selectedExercises.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_-2px_10px_rgba(0,0,0,0.15)] px-4 py-3 flex items-center justify-between z-40 max-sm:flex-col max-sm:gap-2">
          <span className="text-sm font-medium text-white">
            {selectedExercises.length} exercise
            {selectedExercises.length !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm text-white/80 hover:text-white border border-white/30 rounded cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setShowWorksheet(true)}
              className="px-4 py-1.5 text-sm bg-white text-blue-700 rounded font-bold hover:bg-blue-50 cursor-pointer"
            >
              Generate Worksheet ({selectedExercises.length})
            </button>
          </div>
        </div>
      )}

      {/* Zoom modal */}
      {zoomExerciseId && (
        <ZoomModal
          exercises={filteredExercises}
          currentId={zoomExerciseId}
          onClose={() => setZoomExerciseId(null)}
          onNavigate={setZoomExerciseId}
          onSaveExpand={updateUncropExpand}
        />
      )}

      {/* Worksheet preview modal */}
      {showWorksheet && selectedExercises.length > 0 && (
        <WorksheetPreview
          exercises={selectedExercises}
          onClose={() => setShowWorksheet(false)}
        />
      )}
    </div>
  );
}
