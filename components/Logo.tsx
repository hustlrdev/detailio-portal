import Image from "next/image";
import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={light ? "logo logo-light" : "logo"} aria-label="DETAILIO home">
      <Image src="/emblem.png" alt="" width={36} height={28} priority className="logo-mark" />
      <span className="logo-word">DETAILIO</span>
    </Link>
  );
}
