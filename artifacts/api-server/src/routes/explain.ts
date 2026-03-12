import { Router, type IRouter } from "express";
import { ExplainMcqBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

async function generateExplanationsForSection(title: string, content: string): Promise<string> {
  const systemPrompt = `You are an expert MCQ explanation assistant for Bangladeshi competitive exams (BCS, BPSC, BTCL, BUET, etc.).

You will receive text containing one or more MCQs. Your job is to:
1. Keep ALL original MCQ text EXACTLY as written — do not change, remove, or reorder anything
2. After each MCQ's answer line, insert detailed ✒️ explanations for EVERY option
3. For the CORRECT option (marked with ✔): explain WHY it is correct using grammar rules, logic, definitions, or subject knowledge. Give an example sentence.
4. For each WRONG option: explain what it actually is (e.g., it is a verb, not a noun) and why it doesn't fit. Give an example.
5. Write explanations in Bengali (বাংলা) since the MCQs appear to be Bengali competitive exam questions
6. Use this exact format for explanations, starting on a new line after the answer:

✒️ [option word/phrase]: [explanation in Bengali]. উদাহরণ: [example sentence].

Rules:
- Insert explanations ONLY after each complete MCQ (after the last option or answer line)
- Do NOT modify the original MCQ text in any way
- Explain every single option (ক, খ, গ, ঘ) with ✒️
- Keep explanations concise but thorough — 1-2 sentences + example per option
- The goal is that students understand exactly why each option is right or wrong`;

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
  return text;
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
