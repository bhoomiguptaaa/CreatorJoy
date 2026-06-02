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

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="h-full bg-[#F5F5F7] dark:bg-[#0a0a0f] text-gray-900 dark:text-[#F9FAFB] antialiased font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <div className="md:hidden fixed inset-0 bg-[#F5F5F7] dark:bg-[#0a0a0f] flex items-center justify-center z-[100] p-8">
            <div className="text-center">
              <div className="text-4xl font-mono text-gray-200 dark:text-white/10 mb-4">[CJ]</div>
              <p className="text-sm text-gray-400 dark:text-[#6B7280]">CreatorJoy works best on a desktop browser.</p>
            </div>
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
