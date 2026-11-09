import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DETAILIO Business", template: "%s | DETAILIO Business" },
  description: "Manage your detailing business on DETAILIO.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#101114" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a href="#main" className="skip">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
