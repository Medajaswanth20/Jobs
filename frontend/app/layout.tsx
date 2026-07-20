import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Job Hub — Data & DevOps Job Board",
  description:
    "Curated, real-time job board for data and DevOps professionals. Find data analyst, data integrity, data engineer, DevOps, site reliability, and cloud engineer roles.",
  keywords: "data analyst jobs, data engineer jobs, DevOps engineer jobs, SRE, cloud engineer, remote jobs",
  openGraph: {
    title: "Job Hub — Data & DevOps Job Board",
    description: "Curated real-time job board for data and DevOps professionals.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
