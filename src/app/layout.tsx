import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ErrorBoundary from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "เผ่าปัญญา ทรานสปอร์ต - คำนวณ CBM และราคาขนส่ง",
  description: "เครื่องมือช่วยคำนวณ CBM (ปริมาตรสินค้า) ตรวจสอบการจัดวางสินค้าในรถแบบ 3D และคำนวณราคาค่าขนส่ง สำหรับ หจก.เผ่าปัญญา ทรานสปอร์ต รองรับ รถกระบะ รถ 4 ล้อจัมโบ้ และรถ 6 ล้อ",
  keywords: ["CBM", "คำนวณ CBM", "ค่าขนส่ง", "รถขนส่ง", "เผ่าปัญญา", "3D Bin Packing", "ราคาน้ำมันดีเซล", "คำนวณราคาขนส่ง"],
  authors: [{ name: "หจก.เผ่าปัญญา ทรานสปอร์ต" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "เผ่าปัญญา ทรานสปอร์ต - คำนวณ CBM และราคาขนส่ง",
    description: "เครื่องมือช่วยคำนวณ CBM ตรวจสอบการจัดวางสินค้า 3D และคำนวณราคาค่าขนส่ง",
    type: "website",
    locale: "th_TH",
    siteName: "เผ่าปัญญา ทรานสปอร์ต",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
