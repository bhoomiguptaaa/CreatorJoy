"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

interface NavbarProps {
  onNewAnalysis?: () => void;
  onExport?: () => void;
}

export function Navbar({
  onNewAnalysis,
  onExport,
}: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const isDark = theme === "dark";

  return (
    <nav className="sticky top-0 z-50 h-14 bg-white/80 dark:bg-[#0a0a0f]/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5 w-full px-6 flex items-center justify-between font-sans transition-colors duration-200">
      {/* Left: Logo group */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 border border-gray-200 dark:border-white/8 rounded-md font-mono text-xs font-bold text-gray-900 dark:text-white/95 bg-gray-50 dark:bg-[#181826] select-none">
          CJ
        </div>
        <span className="font-semibold text-[15px] text-gray-900 dark:text-white/95 select-none tracking-tight">
          CreatorJoy
        </span>
      </div>

      {/* Center: Empty */}
      <div className="flex-1" />

      {/* Right: Action items */}
      <div className="flex items-center gap-3">
        {/* Export Report button (Ghost style) */}
        <button
          onClick={onExport}
          className="bg-transparent text-gray-600 dark:text-white/40 hover:text-gray-900 dark:hover:text-white px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 rounded-lg focus-visible:ring-2 focus-visible:ring-[#7C3AED]/50 focus-visible:outline-none"
        >
          Export Report
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="w-9 h-9 rounded-full flex items-center justify-center bg-transparent text-gray-500 hover:bg-gray-100 dark:text-white/40 dark:hover:bg-white/5 transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#7C3AED]/50 focus-visible:outline-none"
        >
          {mounted ? (
            isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />
          ) : (
            <div className="w-4 h-4" />
          )}
        </button>

        {/* New Analysis button (Filled purple pill) */}
        <button
          onClick={onNewAnalysis}
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#7C3AED]/50 focus-visible:outline-none"
        >
          + New Analysis
        </button>
      </div>
    </nav>
  );
}
