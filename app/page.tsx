import { StudentSearch } from '@/components/student-search';

export default function HomePage(): React.JSX.Element {
  return (
    <main className="mx-auto w-full max-w-3xl px-3 pb-16 pt-6 sm:px-6 sm:pt-12">
      <StudentSearch />
    </main>
  );
}
