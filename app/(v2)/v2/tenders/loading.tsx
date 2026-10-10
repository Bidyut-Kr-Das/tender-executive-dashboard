export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-3 p-4" aria-busy aria-label="Loading tenders">
      <div className="animate-pulse rounded-md bg-hover motion-reduce:animate-none h-8 w-48" />
      <div className="animate-pulse rounded-md bg-hover motion-reduce:animate-none min-h-0 flex-1" />
    </div>
  );
}
