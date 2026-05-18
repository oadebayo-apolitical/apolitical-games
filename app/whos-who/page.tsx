import PageShell from "@/components/PageShell";
import { getRound } from "@/lib/personality-service";
import WhosWho from "./WhosWho";

export const dynamic = "force-dynamic";

export default async function WhosWhoPage() {
  const initial = await getRound();
  return (
    <PageShell>
      <WhosWho initial={initial} />
    </PageShell>
  );
}
