import { UploadManager } from '@/components/upload-manager';
import { getSessionUsername } from '@/lib/auth/session';
import { getActiveArrangement } from '@/lib/db/database';

export default async function UploadPage() {
  const isLoggedIn = Boolean(await getSessionUsername());
  const arrangement = isLoggedIn ? await getActiveArrangement() : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <UploadManager
        initialArrangement={arrangement ? { ...arrangement, student_count: arrangement.student_count || 0 } : null}
        initialLoggedIn={isLoggedIn}
      />
    </main>
  );
}
