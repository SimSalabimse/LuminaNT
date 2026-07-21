import { CapitalPlanPanel } from "@/components/capital/CapitalPlanPanel";

/** Dedicated bankroll plan view */
export function CapitalPlan() {
  return (
    <div className="page-shell !max-w-[1720px] !space-y-5">
      <div>
        <h1 className="page-title">Plan</h1>
        <p className="page-subtitle">
          Bankroll rules · live rooms · secure buffer · freeze audit
        </p>
      </div>
      <CapitalPlanPanel />
    </div>
  );
}
