import { Sidebar, MobileBar } from "./Sidebar";

export function Shell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar isAdmin={isAdmin} />
      <div className="app-body">
        <MobileBar isAdmin={isAdmin} />
        <main id="main" className="app-main"><div className="wrap">{children}</div></main>
      </div>
    </div>
  );
}