// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

// export const runtime = 'edge';

// 确保布局不会被缓存
export const dynamic = 'force-dynamic'
export const revalidate = 0

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "单词学习App - 基于艾宾浩斯记忆曲线",
  description: "高效记忆单词的学习应用，支持自定义词库和科学的复习计划",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}
      >
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            {/* 可选：添加页脚 */}
            <footer className="bg-white border-t border-gray-200 py-6 mt-8">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
                <p>单词学习App - 让记忆更科学，让学习更高效</p>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}