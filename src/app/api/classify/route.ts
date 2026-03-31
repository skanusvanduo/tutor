import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PAGE_CLASSIFICATION_PROMPT } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: { imageBase64: string; pageNumber: number };
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

  try {
    const text = await callClaude(
      apiKey,
      body.imageBase64,
      PAGE_CLASSIFICATION_PROMPT
    );
    const classification = parseClaudeJSON(text) as Record<string, unknown>;

    return NextResponse.json({
      pageNumber: body.pageNumber,
      pageType: classification.page_type || "theory_only",
      hasExercises: classification.has_exercises ?? false,
      exerciseCountEstimate: classification.exercise_count_estimate ?? 0,
      notes: classification.notes || "",
    });
  } catch (err) {
    console.error("Classification error:", err);
    // On failure, assume it might have exercises so we don't skip it
    return NextResponse.json({
      pageNumber: body.pageNumber,
      pageType: "mixed",
      hasExercises: true,
      exerciseCountEstimate: 0,
      notes: "Classification failed, defaulting to mixed",
    });
  }
}
