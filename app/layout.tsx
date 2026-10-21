import type { Metadata } from "next";
import { Archivo, Figtree, JetBrains_Mono } from "next/font/google";
import { Dock } from "@/components/dock";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Free stand-ins for Bump's faces (DESIGN.md §3): Figtree for UI text, Archivo's width axis for
// compressed display type, JetBrains Mono for mono labels
const figtree = Figtree({ variable: "--font-sans", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-display", subsets: ["latin"], axes: ["wdth"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "QuestFinder", template: "%s · QuestFinder" },
  description: "Plan hangouts and climbing sessions with your friend group.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${archivo.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Dock />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
