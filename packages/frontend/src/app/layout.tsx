import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Imposter Game - Find the Imposter",
  description: "A multiplayer party game where you find the imposter among your friends. Play Word Game or Question Game with live voice chat.",
  keywords: ["imposter", "party game", "multiplayer", "word game", "social deduction"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} font-sans antialiased min-h-screen bg-background`}
      >
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
