import { StudentSearch } from '@/components/student-search';

export default function HomePage(): React.JSX.Element {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16">
      <StudentSearch />
    </main>
  );
}
