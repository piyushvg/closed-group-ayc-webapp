import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { withBase } from "@/lib/paths";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "AYC Member Portal",
  description: "Sign in to view and update your AYC member profile.",
  icons: { icon: withBase("/ayc-logo.png") },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}