import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "เครื่องมือคำนวณ CBM & ราคาค่าขนส่ง — หจก.เผ่าปัญญา ทรานสปอร์ต",
  description: "เครื่องมือช่วยคำนวณ CBM คำนวณราคาค่าขนส่ง และค้นหาระยะทางอัตโนมัติ สำหรับหจก.เผ่าปัญญา ทรานสปอร์ต",
  icons: {
    icon: "/images/3_20251016_054221_0002.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
