export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-3 p-4" aria-busy aria-label="Loading tenders">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton min-h-0 flex-1" />
    </div>
  );
}
