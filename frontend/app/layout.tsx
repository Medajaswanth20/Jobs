import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "DataJobs — Data Analyst & Engineer Job Board",
  description:
    "Curated, real-time job board for data professionals. Find data analyst, data integrity, data engineer, and analytics engineer roles — updated every 4 hours from top job APIs.",
  keywords: "data analyst jobs, data engineer jobs, data integrity jobs, analytics engineer, remote data jobs",
  openGraph: {
    title: "DataJobs — Data Analyst & Engineer Job Board",
    description: "Curated real-time job board for data professionals.",
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
