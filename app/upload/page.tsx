import { UploadManager } from '@/components/upload-manager';
import { getSessionUsername } from '@/lib/auth/session';
import { getActiveArrangement } from '@/lib/db/database';

export default async function UploadPage() {
  const isLoggedIn = Boolean(await getSessionUsername());
  const arrangement = isLoggedIn ? await getActiveArrangement() : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-start justify-center px-4 py-10">
      <div className="w-full">
        <UploadManager initialArrangement={arrangement ? { ...arrangement, student_count: arrangement.student_count || 0 } : null} initialLoggedIn={isLoggedIn} />
      </div>
    </main>
  );
}
