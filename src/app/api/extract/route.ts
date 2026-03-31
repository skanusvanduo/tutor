import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { EXERCISE_SHEET_PROMPT, WORKBOOK_PROMPT } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: {
    imageBase64: string;
    pageNumber: number;
    pageType: string;
    lastExerciseId?: string;
    targetedScan?: {
      missingIds: string[];
      column: "left" | "right";
      topPct: number;
      bottomPct: number;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageBase64) {
    return NextResponse.json(
      { error: "imageBase64 is required" },
      { status: 400 }
    );
  }

  // Pick the right prompt based on page type
  let prompt: string;

  if (body.targetedScan) {
    // Targeted re-scan for missing exercises in a specific region
    const { missingIds, column, topPct, bottomPct } = body.targetedScan;
    prompt = `You are analyzing a Lithuanian math exercise sheet. I have already identified most exercises on this page but I am missing exercises [${missingIds.join(", ")}]. These should be located in the ${column} column between approximately ${topPct.toFixed(0)}% and ${bottomPct.toFixed(0)}% from the top of the page. Find these specific exercises and return their bounding boxes.

Each exercise starts with a bold number followed by a period (e.g., ${missingIds[0]}.). The exercise_id must match the actual printed number on the page.

Provide bounding box coordinates as percentages of the page (0-100). For the ${column} column, left should be roughly ${column === "left" ? "0-48" : "52-100"}.

Return ONLY a JSON array. No markdown, no backticks, no explanation:
[
  {
    "exercise_id": "${missingIds[0]}",
    "bbox": { "top": ${topPct.toFixed(0)}, "left": ${column === "left" ? 2 : 52}, "bottom": ${bottomPct.toFixed(0)}, "right": ${column === "left" ? 48 : 98} },
    "difficulty": 2,
    "has_diagram": false,
    "sub_items": [],
    "topic": ""
  }
]

If these exercises are genuinely not on this page, return: []`;
  } else {
    prompt =
      body.pageType === "exercise_sheet"
        ? EXERCISE_SHEET_PROMPT
        : WORKBOOK_PROMPT;

    // Add page context if we know the last exercise from the previous page
    if (body.lastExerciseId) {
      prompt += `\n\nPAGE CONTEXT: The previous page ended with exercise ${body.lastExerciseId}. This page should continue from exercise ${parseInt(body.lastExerciseId, 10) + 1} (or higher). If the exercise numbers on this page don't match this expectation, the page may be an answer key, summary, or different section — flag it and still use the numbers printed on the page.`;
    }
  }

  // Try up to 2 times
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const promptText =
        attempt === 0
          ? prompt
          : prompt +
            "\n\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the JSON array, no other text.";

      const text = await callClaude(apiKey, body.imageBase64, promptText);
      const exercises = parseClaudeJSON(text);

      if (!Array.isArray(exercises)) {
        if (attempt === 0) continue;
        return NextResponse.json(
          { error: "Response is not an array" },
          { status: 500 }
        );
      }

      return NextResponse.json({ exercises, pageNumber: body.pageNumber });
    } catch (err) {
      if (attempt === 1) {
        console.error("Extraction error after retry:", err);
        return NextResponse.json(
          { error: "Failed to extract exercises" },
          { status: 500 }
        );
      }
      // First attempt failed, retry
      console.warn("First extraction attempt failed, retrying...", err);
    }
  }

  return NextResponse.json(
    { error: "Failed to extract exercises" },
    { status: 500 }
  );
}
