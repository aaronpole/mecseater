import { StudentSearch } from '@/components/student-search';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-start justify-center px-4 py-10">
      <div className="w-full">
        <StudentSearch />
      </div>
    </main>
  );
}
