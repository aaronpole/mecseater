import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { initializeDatabaseMock, searchStudentsMock } = vi.hoisted(() => ({
  initializeDatabaseMock: vi.fn(),
  searchStudentsMock: vi.fn(),
}));

vi.mock('@/lib/db/database', () => ({
  initializeDatabase: initializeDatabaseMock,
  searchStudents: searchStudentsMock,
}));

import { GET } from '@/app/api/search/route';

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns JSON search results for the query parameter', async () => {
    searchStudentsMock.mockReturnValue([{ name: 'Synthetic Student', roll_no: '24ME001', room_no: '107', seat_no: 'A01' }]);

    const response = await GET(new NextRequest('https://mecseater.test/api/search?query=24ME001'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      results: [{ name: 'Synthetic Student', roll_no: '24ME001', room_no: '107', seat_no: 'A01' }],
    });
    expect(searchStudentsMock).toHaveBeenCalledWith('24ME001');
  });

  it('returns a safe JSON error and logs no query or student data when persistence fails', async () => {
    initializeDatabaseMock.mockImplementation(() => {
      throw Object.assign(new Error('read-only database path contains private details'), { code: 'EROFS' });
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(new NextRequest('https://mecseater.test/api/search?query=private-student'));

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      error: 'Search is temporarily unavailable. Please try again later.',
    });
    expect(consoleError).toHaveBeenCalledWith('[api/search] Search failed:', 'EROFS');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('private-student');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('private details');
    consoleError.mockRestore();
  });
});
