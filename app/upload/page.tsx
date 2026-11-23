import { UploadManager } from '@/components/upload-manager';
import { getSessionUsername } from '@/lib/auth/session';
import { getActiveArrangement } from '@/lib/db/database';

export default async function UploadPage(): Promise<React.JSX.Element> {
  const isLoggedIn = Boolean(await getSessionUsername());
  const arrangement = isLoggedIn ? await getActiveArrangement() : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
      <UploadManager
        initialArrangement={arrangement ? { ...arrangement, student_count: arrangement.student_count || 0 } : null}
        initialLoggedIn={isLoggedIn}
      />
    </main>
  );
}
