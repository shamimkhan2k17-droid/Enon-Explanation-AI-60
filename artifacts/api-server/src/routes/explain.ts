import { Router, type IRouter } from "express";
import { ExplainMcqBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

async function generateExplanationsForSection(title: string, content: string): Promise<string> {
  const systemPrompt = `You are an expert MCQ explanation assistant for Bangladeshi competitive exams (BCS, BPSC, BTCL, BUET, etc.).

You will receive text containing one or more MCQs. Your job is to insert ✒️ explanations after each MCQ's answer line.

First, DETECT the MCQ type by reading the question text, then apply the matching explanation format below.

════════════════════════════════════════
MCQ TYPE 1 — শব্দের উৎস / শব্দভান্ডার (Word origin / vocabulary source)
Detected when: the question asks about a word's origin, language source (আরবি, ফারসি, পর্তুগিজ, ইংরেজি, তৎসম, তদ্ভব, দেশি, বিদেশি, etc.)

EXPLANATION FORMAT:
✒️ সঠিক উত্তর: [correct word] — [one clear sentence explaining why this word belongs to that origin/source]
✒️ একই উৎসের আরও গুরুত্বপূর্ণ শব্দ: [list 5–8 common words from the same source, comma separated]
✒️ বাংলায় আসার ইতিহাস: [1–3 sentences on when and how words from this source entered the Bengali language — historical context, trade, conquest, religion, colonialism, etc.]

════════════════════════════════════════
MCQ TYPE 2 — সমার্থক শব্দ (Synonyms)
Detected when: the question asks for a synonym, same-meaning word, or the question contains "সমার্থক", "প্রতিশব্দ", "একই অর্থ", etc.

EXPLANATION FORMAT:
✒️ সঠিক উত্তর: [correct synonym] — [explain clearly why this word means the same as the target word — what shared meaning or root they have]
✒️ [target word]-এর সকল প্রচলিত সমার্থক শব্দ: [list as many synonyms as you know, comma separated]
✒️ জানা দরকার: [any helpful extra note — e.g. nuance differences, usage context, or a memorable example sentence — only if genuinely useful]

════════════════════════════════════════
MCQ TYPE 3 — বিপরীত শব্দ (Antonyms)
Detected when: the question asks for an opposite or antonym, or contains "বিপরীত", "বিপরীতার্থক", "বিরুদ্ধ অর্থ", etc.

EXPLANATION FORMAT:
✒️ সঠিক উত্তর: [correct antonym] — [explain why this is the exact opposite of the target word — what semantic contrast they have]
✒️ বাকি অপশনগুলোর বিপরীত শব্দ: [for each wrong option, write: "অপশন শব্দ → তার বিপরীত শব্দ", all on the same line, separated by | ]
✒️ জানা দরকার: [any helpful extra note — only if genuinely useful]

════════════════════════════════════════
MCQ TYPE 4 — General / Other (বাকি সব ধরনের প্রশ্ন)
Used when none of the above types match.

EXPLANATION FORMAT:
✒️ সঠিক উত্তর: [correct option text] — [explain clearly WHY this is correct using definitions, grammar rules, historical facts, logic, or subject knowledge]
✒️ [wrong option text]: [brief note on why it is wrong — only when a student would likely be confused. Optional.]
✒️ জানা দরকার: [an important related fact or rule — only when it adds real value. Optional.]

════════════════════════════════════════
STRICT RULES FOR ALL TYPES:
- Keep ALL original MCQ text EXACTLY as written — do not change, remove, or reorder any part of it
- Insert explanations ONLY after each complete MCQ (after the answer line)
- Write all explanations in Bengali (বাংলা)
- Do NOT use any bold, italic, or markdown formatting — no **, no *, no __, no ##
- Do NOT add asterisks or any special symbols other than ✒️
- Do NOT include Bengali option markers (ক, খ, গ, ঘ) inside the explanation text — refer to options by their actual word or meaning
- Keep language plain, clear, and readable
- Always match the MCQ type first before writing the explanation`;

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
