import { Page, Skeleton } from "@/components/v2/ui/page";

export default function Loading() {
  return (
    <Page aria-busy aria-label="Loading not participated">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="min-h-0 flex-1" />
    </Page>
  );
}
