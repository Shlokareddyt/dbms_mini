/**
 * Phase 3 — Vector embeddings for semantic mentor matching.
 *
 * Uses Google's Gemini embedding API (`embedContent`) over plain `fetch`
 * (no SDK dependency needed). Requires GEMINI_API_KEY to be set; callers
 * should treat a missing key as "vector search unavailable" rather than
 * a hard failure, so the rest of the (relational) app keeps working.
 */

const GEMINI_EMBEDDING_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class EmbeddingUnavailableError extends Error {
  constructor(message = "Semantic search is not configured (missing GEMINI_API_KEY).") {
    super(message);
    this.name = "EmbeddingUnavailableError";
  }
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Converts free text (an alumni bio, or a student's natural-language
 * mentor search query) into a dense embedding vector.
 *
 * `taskType` follows Gemini's embedding task hints: embedding a mentor's
 * bio for storage uses RETRIEVAL_DOCUMENT, embedding a student's search
 * query uses RETRIEVAL_QUERY — using matching task types measurably
 * improves cosine-similarity ranking quality.
 */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new EmbeddingUnavailableError();
  }

  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
  const url = `${GEMINI_EMBEDDING_ENDPOINT}/${model}:embedContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: 768,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(
      `Gemini embedding request failed (${res.status}): ${errBody.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as {
    embedding?: { values?: number[] };
  };

  const values = data.embedding?.values;
  if (!values || !Array.isArray(values)) {
    throw new Error("Gemini embedding response did not contain vector values.");
  }

  return values;
}

/** Builds the canonical text representation of an alumni mentor profile that gets embedded. */
export function buildAlumniEmbeddingText(input: {
  name: string;
  jobTitle: string | null;
  currentCompany: string | null;
  industry: string | null;
  bio: string | null;
  skills: string[];
}): string {
  return [
    `Mentor: ${input.name}`,
    input.jobTitle && input.currentCompany
      ? `Role: ${input.jobTitle} at ${input.currentCompany}`
      : "",
    input.industry ? `Industry: ${input.industry}` : "",
    input.skills.length ? `Expertise: ${input.skills.join(", ")}` : "",
    input.bio ? `Bio: ${input.bio}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}
