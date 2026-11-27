import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { searchStudentsMock, getActiveArrangementMock } = vi.hoisted(() => ({
  searchStudentsMock: vi.fn(),
  getActiveArrangementMock: vi.fn(),
}));

vi.mock('@/lib/db/database', () => ({
  searchStudents: searchStudentsMock,
  getActiveArrangement: getActiveArrangementMock,
}));

import { GET } from '@/app/api/search/route';

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveArrangementMock.mockResolvedValue({ exam_date: '23/11/2026' });
  });

  it('returns JSON search results and the active exam date', async () => {
    searchStudentsMock.mockResolvedValue([{ name: 'Synthetic Student', roll_no: '24ME001', room_no: '107', seat_no: 'A01' }]);

    const response = await GET(new NextRequest('https://mecseater.test/api/search?query=24ME001'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      results: [{ name: 'Synthetic Student', roll_no: '24ME001', room_no: '107', seat_no: 'A01' }],
      examDate: '23/11/2026',
    });
    expect(searchStudentsMock).toHaveBeenCalledWith('24ME001');
    expect(getActiveArrangementMock).toHaveBeenCalledOnce();
  });

  it('returns a null exam date when no arrangement is active', async () => {
    searchStudentsMock.mockResolvedValue([]);
    getActiveArrangementMock.mockResolvedValue(null);

    const response = await GET(new NextRequest('https://mecseater.test/api/search'));

    await expect(response.json()).resolves.toEqual({ results: [], examDate: null });
  });

  it('returns a safe JSON error and logs no query or student data when persistence fails', async () => {
    searchStudentsMock.mockRejectedValue(
      Object.assign(new Error('database contains private details'), { code: '08006' }),
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET(new NextRequest('https://mecseater.test/api/search?query=private-student'));

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      error: 'Search is temporarily unavailable. Please try again later.',
    });
    expect(consoleError).toHaveBeenCalledWith('[api/search] Search failed:', '08006');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('private-student');
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('private details');
    consoleError.mockRestore();
  });
});
