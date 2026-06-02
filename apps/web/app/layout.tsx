import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreatorJoy — AI Video Analyzer",
  description:
    "Paste two YouTube URLs. Ask why one outperformed the other.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full bg-[#0a0a0a] text-[var(--text-primary)] antialiased font-sans">
        <div className="md:hidden fixed inset-0 bg-[var(--bg)] flex items-center justify-center z-[100] p-8">
          <div className="text-center">
            <div className="text-4xl font-mono text-[var(--border)] mb-4">[CJ]</div>
            <p className="text-sm text-[var(--text-secondary)]">CreatorJoy works best on a desktop browser.</p>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
