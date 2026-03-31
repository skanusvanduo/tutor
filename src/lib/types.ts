export interface PageImage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface BoundingBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export type PageType =
  | "exercise_sheet"
  | "workbook_exercises"
  | "theory_only"
  | "answers"
  | "title_page"
  | "mixed";

export interface PageClassification {
  pageNumber: number;
  pageType: PageType;
  hasExercises: boolean;
  exerciseCountEstimate: number;
  notes: string;
}

export interface UncropPad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Exercise {
  id: string;
  pageNumber: number;
  exerciseNumber: string;
  description: string;
  difficulty: number;
  hasDiagram: boolean;
  subItems: string[];
  topic: string;
  bbox: BoundingBox;
  bboxInvalid: boolean;
  /** Tight display crop — the AI bbox + small padding. NEVER overwritten after extraction. Used for card thumbnails. */
  displayCroppedDataUrl: string;
  /** Working crop — starts as tight crop, updated when user adjusts in ZoomModal. Used for copy/worksheet. */
  croppedDataUrl: string;
  /** Full overcapture crop with 30% padding — only shown inside ZoomModal for adjustment. */
  fullCroppedDataUrl: string;
  uncropPad: UncropPad;
  uncropExpand: UncropPad;
  sourceFile: string;
  selected: boolean;
}

export type AppPhase =
  | "upload"
  | "confirming"
  | "rendering"
  | "classifying"
  | "extracting"
  | "cropping"
  | "review"
  | "exporting";
