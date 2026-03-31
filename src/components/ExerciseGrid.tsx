"use client";

import { useState, useMemo } from "react";
import type { Exercise } from "@/lib/types";
import { ExerciseCard } from "./ExerciseCard";

const filterLevels = ["all", "1", "2", "3", "4", "5"];

export function ExerciseGrid({
  exercises,
  totalCount,
  selectedCount,
  difficultyFilter,
  difficultyCounts,
  onDifficultyFilter,
  onToggleSelect,
  onSelectAllVisible,
  onDeselectAll,
  onImageClick,
}: {
  exercises: Exercise[];
  totalCount: number;
  selectedCount: number;
  difficultyFilter: string;
  difficultyCounts: Record<string, number>;
  onDifficultyFilter: (f: string) => void;
  onToggleSelect: (id: string) => void;
  onSelectAllVisible: () => void;
  onDeselectAll: () => void;
  onImageClick: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [groupByFile, setGroupByFile] = useState(false);

  const uniqueFileCount = useMemo(
    () => new Set(exercises.map((e) => e.sourceFile)).size,
    [exercises]
  );

  const displayExercises = useMemo(() => {
    let list = [...exercises];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.exerciseNumber.toLowerCase().includes(q) ||
          e.topic.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.sourceFile.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "number":
        list.sort((a, b) => {
          const na = parseInt(a.exerciseNumber);
          const nb = parseInt(b.exerciseNumber);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.exerciseNumber.localeCompare(b.exerciseNumber);
        });
        break;
      case "difficulty-asc":
        list.sort((a, b) => a.difficulty - b.difficulty);
        break;
      case "difficulty-desc":
        list.sort((a, b) => b.difficulty - a.difficulty);
        break;
    }

    return list;
  }, [exercises, searchQuery, sortBy]);

  const grouped = useMemo(() => {
    if (!groupByFile) return null;
    const groups = new Map<string, Exercise[]>();
    for (const ex of displayExercises) {
      const list = groups.get(ex.sourceFile) || [];
      list.push(ex);
      groups.set(ex.sourceFile, list);
    }
    return groups;
  }, [displayExercises, groupByFile]);

  const gridClasses =
    "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

  const renderCards = (list: Exercise[], indexOffset = 0) =>
    list.map((ex, i) => (
      <ExerciseCard
        key={ex.id}
        exercise={ex}
        onToggleSelect={onToggleSelect}
        onImageClick={onImageClick}
        animationIndex={indexOffset + i}
      />
    ));

  return (
    <div>
      {/* Filter & controls bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm text-gray-500">
          Showing <strong>{displayExercises.length}</strong> of{" "}
          <strong>{totalCount}</strong>
          {searchQuery && " (filtered)"}
        </span>

        <div className="flex items-center gap-1.5 ml-3">
          {filterLevels.map((level) => {
            const count = difficultyCounts[level] ?? 0;
            const isActive = difficultyFilter === level;
            const isEmpty = count === 0 && level !== "all";
            return (
              <button
                key={level}
                onClick={() => onDifficultyFilter(level)}
                className={`px-2.5 py-1 text-xs rounded-full cursor-pointer transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : isEmpty
                      ? "bg-white text-gray-600 border border-gray-300 opacity-40"
                      : "bg-white text-gray-600 border border-gray-300 hover:bg-blue-50 hover:border-blue-300"
                }`}
              >
                {level === "all" ? "All" : level} ({count})
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onSelectAllVisible}
            className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 cursor-pointer transition-colors"
          >
            Select all visible
          </button>
          {selectedCount > 0 && (
            <button
              onClick={onDeselectAll}
              className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 cursor-pointer transition-colors"
            >
              Deselect all
            </button>
          )}
        </div>
      </div>

      {/* Search, sort, group bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by number, topic..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent w-52 bg-white"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="default">Default order</option>
          <option value="number">By number</option>
          <option value="difficulty-asc">Difficulty ↑</option>
          <option value="difficulty-desc">Difficulty ↓</option>
        </select>
        {uniqueFileCount > 1 && (
          <button
            onClick={() => setGroupByFile(!groupByFile)}
            className={`px-2.5 py-1.5 text-xs rounded-lg border cursor-pointer transition-colors ${
              groupByFile
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Group by file
          </button>
        )}
      </div>

      {/* Cards */}
      {displayExercises.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-400">
            {searchQuery
              ? `No exercises matching "${searchQuery}".`
              : difficultyFilter !== "all"
                ? `No exercises with difficulty ${difficultyFilter}.`
                : "No exercises to show."}
          </p>
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([file, exs], groupIdx) => {
            const offset = Array.from(grouped.values())
              .slice(0, groupIdx)
              .reduce((s, g) => s + g.length, 0);
            return (
              <div key={file}>
                <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1 flex items-center gap-2">
                  <span className="text-base">📄</span>
                  {file}
                  <span className="text-xs font-normal text-gray-400">
                    ({exs.length} exercise{exs.length !== 1 ? "s" : ""})
                  </span>
                </h3>
                <div className={gridClasses}>{renderCards(exs, offset)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={gridClasses}>{renderCards(displayExercises)}</div>
      )}
    </div>
  );
}
