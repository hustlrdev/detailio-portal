"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Logo } from "./Logo";

const I = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  bookings: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
  reviews: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />,
  payments: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></>,
  setup: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  admin: <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />,
  tools: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z" />,
  out: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
};
type IconKey = keyof typeof I;
function Icon({ k }: { k: IconKey }) {
  return (
    <svg className="sb-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[k]}</svg>
  );
}

type Item = { href: string; label: string; icon: IconKey; exact?: boolean };
const BUSINESS: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/bookings", label: "Bookings", icon: "bookings" },
  { href: "/reviews", label: "Reviews", icon: "reviews" },
  { href: "/payments", label: "Payments", icon: "payments" },
  { href: "/setup", label: "Set up", icon: "setup" },
];
const ADMIN: Item[] = [
  { href: "/admin", label: "Admin", icon: "admin", exact: true },
  { href: "/admin/payments", label: "Payment tools", icon: "tools" },
];

function Links({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const on = (i: Item) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/"));
  const row = (i: Item) => (
    <Link key={i.href} href={i.href} className={on(i) ? "sb-link sb-on" : "sb-link"} aria-current={on(i) ? "page" : undefined}>
      <Icon k={i.icon} /><span>{i.label}</span>
    </Link>
  );
  return (
    <>
      <div className="sb-group">{BUSINESS.map(row)}</div>
      {isAdmin && (
        <div className="sb-group">
          <div className="sb-heading">Admin</div>
          {ADMIN.map(row)}
        </div>
      )}
      <form action="/auth/signout" method="post" className="sb-signout">
        <button className="sb-link" type="submit"><Icon k="out" /><span>Sign out</span></button>
      </form>
    </>
  );
}

function Brand() {
  return (
    <span className="sb-brand"><Logo /><span className="tag-business">Business</span></span>
  );
}

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside className="sb" aria-label="Main">
      <Brand />
      <nav className="sb-nav"><Links isAdmin={isAdmin} /></nav>
    </aside>
  );
}

export function MobileBar({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (ref.current) ref.current.open = false; }, [path]);
  return (
    <header className="mb">
      <Brand />
      <details ref={ref} className="mb-menu">
        <summary aria-label="Menu"><span className="burger" aria-hidden="true" /></summary>
        <nav className="mb-sheet" aria-label="Mobile"><Links isAdmin={isAdmin} /></nav>
      </details>
    </header>
  );
}