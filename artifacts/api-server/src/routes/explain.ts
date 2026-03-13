import { Router, type IRouter } from "express";
import { ExplainMcqBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

// Strips Bengali option markers (ক) খ) গ) ঘ) and variants) from ✒️ explanation lines only.
// The original MCQ text (options) is left untouched — only explanation lines are cleaned.
function stripOptionMarkers(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trimStart().startsWith("✒️")) return line;
      // Remove patterns like: ক) ক। ক: খ) খ। etc. (with optional trailing space)
      return line.replace(/[কখগঘ][)।:\s]\s*/g, "");
    })
    .join("\n");
}

async function generateExplanationsForSection(title: string, content: string): Promise<string> {
  const systemPrompt = `You are an expert MCQ explanation assistant for Bangladeshi competitive exams (BCS, BPSC, BTCL, BUET, etc.).

You will receive text containing one or more MCQs. Your job is to insert ✒️ explanations after each MCQ's answer line.

STRUCTURE OF EXPLANATION (always in this order):

1. CORRECT ANSWER EXPLANATION (mandatory):
   ✒️ সঠিক উত্তর: [the correct option letter and text] — [explain clearly WHY this is the correct answer, using definitions, grammar rules, historical facts, logic, or subject knowledge. Give an example if helpful.]

2. WRONG OPTIONS (only when it helps understanding — not always needed):
   ✒️ [wrong option letter]: [brief explanation of why this option is wrong or what it actually means. Only include if a student would likely be confused by it.]

3. ADDITIONAL NOTES (only when there is genuinely useful extra knowledge):
   ✒️ জানা দরকার: [an important related fact, rule, or context that helps the student learn more about this topic. Only include if it adds real value.]

STRICT RULES:
- Keep ALL original MCQ text EXACTLY as written — do not change, remove, or reorder any part of it
- Insert explanations ONLY after each complete MCQ (after the answer line)
- Write all explanations in Bengali (বাংলা)
- Do NOT use any bold, italic, or markdown formatting — no **, no *, no __, no ##
- Do NOT add asterisks or any special symbols other than ✒️
- Do NOT include Bengali option markers (ক, খ, গ, ঘ) or any option labels inside the explanation text — refer to options by their actual content or meaning, never by their letter marker
- Keep language plain, clear, and readable
- Wrong option explanations are optional — only add them when they genuinely help
- Additional notes are optional — only add when there is truly valuable context
- The mandatory part is always the correct answer explanation`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Topic: ${title}\n\nPlease add ✒️ explanations after each MCQ below:\n\n${content}`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    console.error(`Empty response for section "${title}". Finish reason:`, completion.choices[0]?.finish_reason);
    return content;
  }
  return stripOptionMarkers(text);
}

router.post("/text/explain", async (req, res) => {
  try {
    const parsed = ExplainMcqBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }

    const { sections } = parsed.data;

    if (!sections || sections.length === 0) {
      res.status(400).json({ error: "No sections provided." });
      return;
    }

    const CONCURRENCY = 3;
    const results: Array<{ title: string; content: string; explanation: string }> = new Array(sections.length);

    for (let i = 0; i < sections.length; i += CONCURRENCY) {
      const batch = sections.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (section, batchIdx) => {
          const explanation = await generateExplanationsForSection(section.title, section.content);
          return { title: section.title, content: section.content, explanation };
        })
      );
      batchResults.forEach((r, batchIdx) => {
        results[i + batchIdx] = r;
      });
    }

    res.json({ sections: results });
  } catch (error) {
    console.error("Error generating explanations:", error);
    res.status(500).json({ error: "An error occurred while generating explanations." });
  }
});

export default router;
