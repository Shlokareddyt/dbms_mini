/**
 * Phase 3 — Qdrant vector database client.
 *
 * Stores one point per verified alumni mentor: vector = Gemini embedding
 * of their profile text, payload = denormalized fields used to render
 * search results without an extra MySQL round trip (alumni_id is kept
 * as the source of truth / foreign key back into MySQL).
 */
import { QdrantClient } from "@qdrant/js-client-rest";

declare global {
  var __qdrantClient: QdrantClient | undefined;
}

export function isQdrantConfigured(): boolean {
  return Boolean(process.env.QDRANT_URL);
}

export function getQdrantClient(): QdrantClient {
  if (!globalThis.__qdrantClient) {
    globalThis.__qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY || undefined,
    });
  }
  return globalThis.__qdrantClient;
}

export function getCollectionName(): string {
  return process.env.QDRANT_COLLECTION || "alumni_profiles";
}

const VECTOR_SIZE = 768;

/** Idempotently ensures the alumni_profiles collection exists with the right vector config. */
export async function ensureCollection(): Promise<void> {
  const client = getQdrantClient();
  const collection = getCollectionName();

  const exists = await client.collectionExists(collection);
  if (!exists.exists) {
    await client.createCollection(collection, {
      vectors: { size: VECTOR_SIZE, distance: "Cosine" },
    });
  }
}

export interface AlumniVectorPayload {
  alumni_id: number;
  user_id: number;
  name: string;
  current_company: string | null;
  job_title: string | null;
  industry: string | null;
  skills: string[];
  bio: string | null;
  [key: string]: unknown;
}

/** Upserts (creates or replaces) the embedding point for one alumni mentor. */
export async function upsertAlumniVector(
  alumniId: number,
  vector: number[],
  payload: AlumniVectorPayload
): Promise<void> {
  const client = getQdrantClient();
  await ensureCollection();
  await client.upsert(getCollectionName(), {
    wait: true,
    points: [
      {
        id: alumniId,
        vector,
        payload,
      },
    ],
  });
}

export async function deleteAlumniVector(alumniId: number): Promise<void> {
  const client = getQdrantClient();
  await client.delete(getCollectionName(), {
    wait: true,
    points: [alumniId],
  });
}

export interface AlumniSearchHit {
  alumniId: number;
  score: number;
  payload: AlumniVectorPayload;
}

/**
 * Cosine-similarity search for the top-k alumni mentors closest to a
 * query vector. Uses the modern `query()` API (the older `search()`
 * method was removed from recent @qdrant/js-client-rest versions).
 */
export async function searchAlumniByVector(
  vector: number[],
  topK = 3,
  filter?: Record<string, unknown>
): Promise<AlumniSearchHit[]> {
  const client = getQdrantClient();
  const response = await client.query(getCollectionName(), {
    query: vector,
    limit: topK,
    filter: filter as never,
    with_payload: true,
  });

  return response.points.map((point) => ({
    alumniId: Number(point.id),
    score: point.score,
    payload: point.payload as unknown as AlumniVectorPayload,
  }));
}
