import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/dashboard/NavBar";

export const metadata: Metadata = {
  title: "SignalLens",
  description: "AI-powered public company risk intelligence dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
