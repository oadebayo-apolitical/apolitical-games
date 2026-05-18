import Game from "./Game";
import PageShell from "@/components/PageShell";
import { getPuzzle } from "@/lib/puzzle-service";
import type { Mode } from "@/lib/generate";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const resolved: Mode = mode === "endless" ? "endless" : "daily";
  const initial = await getPuzzle(resolved);
  return (
    <PageShell>
      <Game mode={resolved} initial={initial} />
    </PageShell>
  );
}
