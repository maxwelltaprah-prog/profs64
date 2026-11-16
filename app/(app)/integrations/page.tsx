import { redirect } from "next/navigation";

import { IntegrationGrid } from "@/components/integrations/integration-grid";
import { getOptionalUser } from "@/lib/db/auth";
import { interestedIntegrations } from "@/lib/db/waitlist";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?next=/integrations");
  const interested = await interestedIntegrations();

  return (
    <>
      <main id="main" className="min-w-0 flex-1 px-6 py-10 md:px-10 md:py-14">
        <div className="mx-auto w-full max-w-5xl">
          <p className="page-in text-muted text-[13px]">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-muted mt-2 max-w-xl text-sm">
            Connect Buildr to the tools you already use. None are connected yet; tell us which you
            want first and we will build those in that order.
          </p>
          <div className="mt-8">
            <IntegrationGrid interested={interested} />
          </div>
        </div>
      </main>
    </>
  );
}
