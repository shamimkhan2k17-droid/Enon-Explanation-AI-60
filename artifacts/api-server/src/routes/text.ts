import { Router, type IRouter, type Request } from "express";
import { OrganizeTextBody } from "@workspace/api-zod";
import { openai as defaultOpenai } from "@workspace/integrations-openai-ai-server";
import OpenAI from "openai";

const router: IRouter = Router();

function getOpenAIClient(req: Request) {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  const baseURL = req.headers["x-api-base-url"] as string | undefined;
  const model = (req.headers["x-api-model"] as string | undefined) || "gpt-4o";

  if (apiKey && apiKey.trim()) {
    return {
      client: new OpenAI({ apiKey: apiKey.trim(), ...(baseURL ? { baseURL: baseURL.trim() } : {}) }),
      model,
    };
  }
  return { client: defaultOpenai, model: "gpt-5.2" };
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

router.post("/text/organize", async (req, res) => {
  try {
    const parsed = OrganizeTextBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body. 'text' field is required." });
      return;
    }

    const { text } = parsed.data;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: "Text cannot be empty." });
      return;
    }

    const paragraphs = splitIntoParagraphs(text);

    if (paragraphs.length === 0) {
      res.status(400).json({ error: "No content found in the provided text." });
      return;
    }

    const paragraphPreviews = paragraphs
      .map((p, i) => `[${i}]: ${p.slice(0, 150)}${p.length > 150 ? "..." : ""}`)
      .join("\n");

    const systemPrompt = `You are a text analysis assistant. You will be given a numbered list of paragraphs from a text.
Your job is to:
1. Identify all distinct topics/themes across all paragraphs
2. Assign each paragraph index to exactly one topic
3. Return ONLY a compact JSON object — do NOT include any paragraph text in your response

Output format (strict JSON):
{
  "topics": [
    { "title": "Topic Title", "paragraphIndices": [0, 3, 5] },
    { "title": "Another Topic", "paragraphIndices": [1, 2, 4] }
  ]
}

Rules:
- Every paragraph index (0 to ${paragraphs.length - 1}) must appear in exactly one topic
- Topic titles should be clear and descriptive (2-6 words)
- Group related paragraphs together under the same topic
- Order topics logically
- Do NOT include any paragraph text in your response — only indices`;

    const { client, model } = getOpenAIClient(req);

    const completion = await client.chat.completions.create({
      model,
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here are the ${paragraphs.length} paragraphs (numbered):\n\n${paragraphPreviews}\n\nPlease identify topics and assign paragraph indices.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      console.error("Empty response from OpenAI. Finish reason:", completion.choices[0]?.finish_reason);
      res.status(500).json({ error: "No response from AI service. The text may be too complex — try breaking it into smaller pieces." });
      return;
    }

    let aiResult: { topics: Array<{ title: string; paragraphIndices: number[] }> };
    try {
      aiResult = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse AI JSON:", responseText.slice(0, 500));
      res.status(500).json({ error: "Failed to parse AI response." });
      return;
    }

    if (!aiResult.topics || !Array.isArray(aiResult.topics)) {
      res.status(500).json({ error: "Invalid response structure from AI." });
      return;
    }

    const sections = aiResult.topics.map((topic) => {
      const content = topic.paragraphIndices
        .filter((i) => i >= 0 && i < paragraphs.length)
        .map((i) => paragraphs[i])
        .join("\n\n");

      return { title: topic.title, content };
    });

    res.json({ sections });
  } catch (error) {
    console.error("Error organizing text:", error);
    res.status(500).json({ error: "An error occurred while organizing the text." });
  }
});

export default router;
