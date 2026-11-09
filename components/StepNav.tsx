import Link from "next/link";

const steps = [
  ["/setup/business", "Business"],
  ["/setup/location", "Location"],
  ["/setup/services", "Services"],
  ["/setup/hours", "Hours"],
  ["/setup/photos", "Photos"],
  ["/setup/documents", "Documents"],
  ["/setup/review", "Review"],
];

export function StepNav({ current }: { current: string }) {
  return (
    <nav className="steps-nav" aria-label="Set-up steps">
      <Link href="/setup">Overview</Link>
      {steps.map(([href, label]) => (
        <Link key={href} href={href} aria-current={href === current ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}