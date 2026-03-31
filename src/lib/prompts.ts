export const PAGE_CLASSIFICATION_PROMPT = `Look at this math textbook page. Classify it as one of these types:

- "exercise_sheet": A page that is mostly numbered exercises for students to solve. Exercises are listed sequentially (1, 2, 3... or with sub-items a, b, c). Minimal decoration. Example: a page titled "Kvadratinės nelygybės" with exercises numbered 1-16.

- "workbook_exercises": A colorful workbook page that contains exercises mixed with theory, examples, and diagrams. Exercises are in colored numbered circles or boxes. There are section headers like "SPRENDŽIAME UŽDAVINIUS" (We solve exercises) or "Pasitikriname" (Self-check).

- "theory_only": A page that contains only explanations, definitions, proofs, or worked examples (marked "pavyzdys" or "Sprendimas") with NO exercises for the student to solve independently.

- "answers": A page containing solutions or answers to exercises. Key indicators: dense small text, lists of results in the format 'a) x∈(...); b) x∈(...)' or similar interval/set notation, exercise numbers followed immediately by their solutions rather than the problem text, no workspace or blank areas. Often appears at the end of the PDF. If a page looks like it contains results rather than questions, classify it as answers.

- "title_page": A decorative title/intro page with no exercises.

- "mixed": A page with both theory/examples AND exercises. Exercises usually appear in the lower portion of the page under headers like "SPRENDŽIAME UŽDAVINIUS".

Return ONLY a JSON object with these fields:
{
  "page_type": "exercise_sheet" | "workbook_exercises" | "theory_only" | "answers" | "title_page" | "mixed",
  "has_exercises": true | false,
  "exercise_count_estimate": number,
  "notes": "brief description of what's on this page"
}

No markdown. No explanation. Just the JSON.`;

export const EXERCISE_SHEET_PROMPT = `You are analyzing a Lithuanian math exercise sheet. This page contains numbered exercises for students to solve.

YOUR TASK: Identify every individual exercise on this page and provide its location as a bounding box.

IMPORTANT RULES FOR IDENTIFYING EXERCISES:

Every exercise starts with a bold or prominent number followed by a period (e.g., 1., 2., 3., etc.). The exercise number is ALWAYS the anchor point — find all exercise numbers on the page first, then determine each exercise's boundaries.
Exercise numbers on this page should be sequential. If you find exercises 1, 2, 3, 4, 6 — you likely missed exercise 5. Go back and look for it. Every number in the sequence must be accounted for.
An exercise's content includes everything to the RIGHT of and BELOW its number, until the next exercise number appears. This includes any diagrams, sub-items (a, b, c, d), graphs, number lines, or answer choices that belong to that exercise.
Some exercises are very short — just one line of text with no diagram. These are still individual exercises. Do not skip them or merge them with the next exercise.
The bounding box for each exercise must start at or slightly above the exercise number and extend down to just before the next exercise number begins.
Scan the page in column order: all exercises in the left column first (top to bottom), then all exercises in the right column (top to bottom). Exercise numbers should increase as you go down each column.
Do NOT confuse sub-items within an exercise with new exercises. Sub-items use formats like a), b), c), d) or 1), 2), 3), 4) — note the closing parenthesis. Actual exercise numbers use a number followed by a period and a space: 1. 2. 3. etc. Sub-items belong to the exercise above them and must be included in that exercise's bounding box. If you see 1) 2) 3) 4) those are answer choices or sub-problems within one exercise, NOT separate exercises.

IMPORTANT: The exercise_id must match the actual number printed on the page next to the exercise (e.g., if the exercise starts with "42." then exercise_id is "42"). Do not renumber exercises sequentially across pages. Read the number directly from the page.

ADDITIONAL RULES:
1. If an exercise has sub-items (a, b, c, d, etc.), treat the ENTIRE exercise including ALL sub-items as ONE exercise. Do NOT split sub-items into separate exercises.
2. Multiple-choice questions (A, B, C, D options) are ONE exercise including all options.
3. If an exercise references a diagram or number line drawing, the bounding box MUST include the diagram.
4. Ignore page headers, page numbers, and chapter titles.
5. Ignore answer sections if present.
6. CRITICAL: Page titles, chapter titles, and section headers are NOT exercises. These are typically at the very top of the page, in a larger or different font, and describe the topic of the page (e.g., "28. Tekstiniai uždaviniai", "22. Kvadratinės nelygybės", "39. Lygiagretainis"). They often include the chapter/section number followed by a period and a title in words. Do NOT include these as exercises. Exercises are the numbered problems in the body of the page that ask the student to solve something. A title describes a topic. An exercise asks a question or gives a task. If the first item you detect is a title or header, skip it entirely and start counting from the first actual exercise below it.

BOUNDING BOX FORMAT:
Provide coordinates as percentages of the page dimensions:
- top: distance from top of page (0 = very top, 100 = very bottom)
- left: distance from left edge (0 = left edge, 100 = right edge)
- bottom: where the exercise ends vertically
- right: where the exercise ends horizontally

For exercises in a two-column layout: make sure left/right values correctly reflect which column the exercise is in. Left column is roughly 0-48, right column is roughly 52-100.

When estimating bounding boxes, aim for accuracy. It is slightly better to include 1% too much than to cut off content, but do not add large margins.

CRITICAL BOTTOM BOUNDARY RULE: When an exercise has multiple-choice answers (A, B, C, D) arranged in two rows (e.g., A and B on one line, C and D on the next line), your bottom boundary MUST be below the SECOND row of answers, not the first. When an exercise has sub-items (a, b, c, d, e, f...) arranged in columns, your bottom boundary must be below the LAST sub-item, including any that wrap to additional lines. It is ALWAYS better to include a small amount of the next exercise than to cut off content from the current exercise.

CRITICAL TOP BOUNDARY RULE: The top edge of each bounding box MUST include the exercise number itself (the bold number like "42." or "1."). The exercise number is the FIRST element that should be visible in the crop. Set the top coordinate AT or slightly ABOVE the top of the exercise number text — never below it. For text-only exercises without diagrams, the number is especially critical to capture. Err on the side of including 1-2% extra space above the number rather than cutting it off.

CRITICAL VALIDATION RULES:

Every exercise starts with a BOLD number followed by a period (e.g., 1. 2. 3.). This is the ONLY pattern that indicates a new exercise.
Sub-exercises use letters or numbers with CLOSING PARENTHESES: a), b), c) or 1), 2), 3). These are NOT new exercises — they belong to the exercise above them.
Each exercise_id MUST match the actual printed number on the page. Read the number directly from the page. Do not guess or renumber.
Each bounding box must contain EXACTLY ONE exercise number (the bold number with a period). If your bounding box contains two bold numbers like both "4." and "5.", your box is too large — split it into two separate exercises.
ONE exercise number = ONE bounding box. No exceptions.

DIFFICULTY RATING:
1 = Direct substitution or single-step (e.g., solve x² > 0)
2 = Two steps, basic factoring or standard method
3 = Multi-step, requires choosing a method or combining concepts
4 = Word problems, proofs, or multi-part problems requiring deeper reasoning
5 = Competition-level or problems requiring creative insight

FINAL CHECK BEFORE RESPONDING: Count your exercises. Are any numbers missing from the sequence? If the left column ends at exercise 22 and the right column starts at 26, you MUST go back and find exercises 23, 24, and 25. Do not submit your response until every number in the sequence is accounted for. If exercises are genuinely not on this page, note that in your response.

Return ONLY a JSON array. No markdown, no backticks, no explanation:
[
  {
    "exercise_id": "1",
    "bbox": { "top": 8, "left": 2, "bottom": 18, "right": 48 },
    "difficulty": 2,
    "has_diagram": false,
    "sub_items": ["a", "b", "c", "d"],
    "topic": "quadratic inequalities"
  }
]

If no exercises found, return: []`;

export const WORKBOOK_PROMPT = `You are analyzing a Lithuanian math workbook page. This page may contain a mix of theory, worked examples ("pavyzdys"), and exercises for students to solve.

YOUR TASK: Identify ONLY the exercises that students need to solve independently. Ignore everything else.

WHAT IS AN EXERCISE (include these):
- Items with colored numbered circles (1, 2, 3...) under sections titled "SPRENDŽIAME UŽDAVINIUS" (We solve exercises)
- Items under "Pasitikriname" (Self-check) sections
- Items under "Čempionų lyga" (Champions league) sections
- Items under "Argumentuokime" sections
- Items with a red/orange circle icon next to the number (homework exercises)
- Items with a green circle icon (practice exercises)
- Multiple choice questions in "Pasitikriname" sections

WHAT IS NOT AN EXERCISE (ignore these):
- Worked examples labeled "pavyzdys" or "Sprendimas" — these show HOW to solve, they're not for the student
- Theory text and definitions
- "Svarbu!" (Important) boxes — these are reference material
- "Prisimename" (We remember) sections — these are review material
- QR codes and decorative elements
- Page headers and titles
- "Ką veikiame" (What we'll do) and "Šiame cikle" (In this cycle) sections — these are introductions
- "Įsivertinu" (Self-assessment) rubric tables
- "Ko išmokau?" and "Kodėl tai svarbu?" footer banners

BOUNDING BOX RULES:
- The bounding box MUST include the exercise number, ALL text, ALL sub-items, and ALL associated diagrams/figures
- If a geometry exercise has a triangle diagram next to it, the box must include the diagram
- These pages have colored backgrounds — the box should capture the content, not the background decoration
- Be generous with the box — it's better to include a little extra margin than to cut off a diagram

When estimating bounding boxes, aim for accuracy. It is slightly better to include 1% too much than to cut off content, but do not add large margins.

DIFFICULTY RATING:
1 = Direct application of a formula with given values
2 = Standard problem requiring one concept
3 = Combining multiple concepts or multi-step solution
4 = Word problems, proofs, or problems requiring setup
5 = "Čempionų lyga" or "Argumentuokime" level problems

Return ONLY a JSON array. No markdown, no backticks, no explanation:
[
  {
    "exercise_id": "7",
    "bbox": { "top": 45, "left": 52, "bottom": 68, "right": 98 },
    "difficulty": 3,
    "has_diagram": true,
    "sub_items": ["a", "b"],
    "topic": "sine and cosine of rotation angle"
  }
]

If this page has no exercises (only theory/examples), return: []`;
