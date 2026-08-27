import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import KakaoInAppHandler from "@/components/KakaoInAppHandler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://math-academy-app.vercel.app"),
  title: "품수학",
  description: "품수학 학원 학습 관리 및 알림",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "품수학",
  },
  openGraph: {
    title: "품수학 학원 전용 앱",
    description: "숙제 공지 및 1:1 질의응답 실시간 알림 서비스",
    url: "https://math-academy-app.vercel.app",
    siteName: "품수학",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "품수학 학원 로고",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "품수학 학원 전용 앱",
    description: "숙제 공지 및 1:1 질의응답 실시간 알림 서비스",
    images: ["/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="품수학" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <KakaoInAppHandler />
        {children}
      </body>
    </html>
  );
}
