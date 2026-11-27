import { describe, expect, it } from 'vitest';
import { readSearchResponse } from '@/lib/search/response';

const validPayload = {
  results: [{ name: 'Synthetic Student', roll_no: '24ME001', room_no: '107', seat_no: 'A01' }],
  examDate: '23/11/2026',
};

describe('readSearchResponse', () => {
  it('returns results and exam date from a successful JSON response', async () => {
    const response = new Response(JSON.stringify(validPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

    await expect(readSearchResponse(response)).resolves.toEqual(validPayload);
  });

  it('uses a safe message for an HTML server error', async () => {
    const response = new Response('<!DOCTYPE html><html>internal error details</html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    await expect(readSearchResponse(response)).rejects.toThrow(
      'Search is temporarily unavailable. Please try again later.',
    );
  });

  it('reports an unexpected HTML response for a missing endpoint', async () => {
    const response = new Response('<!DOCTYPE html><html>not found</html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });

    await expect(readSearchResponse(response)).rejects.toThrow(
      'Search service returned an unexpected response (HTTP 404). Please try again later.',
    );
  });

  it('surfaces safe JSON API errors without exposing server errors', async () => {
    const response = new Response(JSON.stringify({ error: 'Search is temporarily unavailable.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(readSearchResponse(response)).rejects.toThrow(
      'Search is temporarily unavailable. Please try again later.',
    );
  });

  it('rejects malformed JSON responses', async () => {
    const response = new Response('{invalid', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(readSearchResponse(response)).rejects.toThrow(
      'Search service returned invalid data. Please try again later.',
    );
  });

  it('rejects a successful response with an invalid results or exam date shape', async () => {
    const response = new Response(JSON.stringify({ results: 'not-an-array', examDate: 123 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(readSearchResponse(response)).rejects.toThrow(
      'Search service returned invalid data. Please try again later.',
    );
  });
});
