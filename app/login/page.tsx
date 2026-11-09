import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function Login() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Image src="/logo-lockup.png" alt="DETAILIO. Discover. Book. Detail." width={240} height={48} className="logo-big" priority />
        <p className="auth-sub">Run your detailing business on DETAILIO.</p>
        <LoginForm />
      </div>
    </div>
  );
}
