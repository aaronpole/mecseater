import { z } from 'zod';

const searchResultsSchema = z.array(
  z.object({
    name: z.string(),
    roll_no: z.string(),
    room_no: z.string(),
    seat_no: z.string(),
  }),
);

const searchPayloadSchema = z.object({
  results: searchResultsSchema,
  error: z.string().optional(),
});

export async function readSearchResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    if (response.status >= 500) {
      throw new Error('Search is temporarily unavailable. Please try again later.');
    }
    throw new Error(`Search service returned an unexpected response (HTTP ${response.status}). Please try again later.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Search service returned invalid data. Please try again later.');
  }

  if (!response.ok) {
    const safeMessage = searchPayloadSchema.shape.error.safeParse(
      typeof payload === 'object' && payload !== null && 'error' in payload ? payload.error : undefined,
    );
    if (response.status >= 500) {
      throw new Error('Search is temporarily unavailable. Please try again later.');
    }
    throw new Error(safeMessage.success ? safeMessage.data : `Search request failed (HTTP ${response.status}).`);
  }

  const parsed = searchPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Search service returned invalid data. Please try again later.');
  }

  return parsed.data.results;
}
