// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

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

// PWA 相关配置
export const metadata: Metadata = {
  title: "单词学习App - 基于艾宾浩斯记忆曲线",
  description: "高效记忆单词的学习应用，支持自定义词库和科学的复习计划",
  applicationName: "单词学习App",
  manifest: "/manifest.json",
  
  // Apple 特定配置
  appleWebApp: {
    capable: true,
    title: "单词学习App",
    statusBarStyle: "black-translucent",
  },
  
  // 格式检测
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
  
  // Open Graph 配置
  openGraph: {
    type: "website",
    siteName: "单词学习App",
    title: "单词学习App - 基于艾宾浩斯记忆曲线",
    description: "高效记忆单词的学习应用，支持自定义词库和科学的复习计划",
    // 可以在这里添加你的网站URL和图片
    // url: "https://yourdomain.com",
    // images: [{ url: "/og-image.png" }],
  },
  
  // Twitter 配置
  twitter: {
    card: "summary_large_image",
    title: "单词学习App - 基于艾宾浩斯记忆曲线",
    description: "高效记忆单词的学习应用，支持自定义词库和科学的复习计划",
    // 可以在这里添加你的Twitter ID和图片
    // creator: "@yourtwitter",
    // images: ["/twitter-image.png"],
  },
  
  // 其他元数据
  keywords: ["单词学习", "英语学习", "艾宾浩斯", "记忆曲线", "PWA"],
  authors: [{ name: "单词学习App" }],
  creator: "单词学习App",
  publisher: "单词学习App",
  
  // 添加到主屏幕相关
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "msapplication-TileColor": "#000000",
    "msapplication-tap-highlight": "no",
  },
};

// 视口配置 - PWA 必备
export const viewport: Viewport = {
  themeColor: "#3b82f6", // 与你的品牌色保持一致（Tailwind blue-500）
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 基本标签 */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/favicon-48x48.png" type="image/png" sizes="48x48" />
        
        {/* 苹果触摸图标 */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/apple-touch-icon-120x120.png" />
        
        {/* 微软磁贴配置 */}
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-TileImage" content="/icons/mstile-144x144.png" />
        <meta name="msapplication-square310x310logo" content="/icons/mstile-310x310.png" />
        
        {/* 苹果特定标签 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="单词学习App" />
        
        {/* PWA 相关标签 */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="单词学习App" />
        <meta name="format-detection" content="telephone=no" />
        
        {/* 预加载关键资源 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        
        {/* 安装到主屏幕的样式 */}
        <style>{`
          @media (display-mode: standalone) {
            /* PWA 全屏模式下的样式 */
            header, nav {
              padding-top: env(safe-area-inset-top);
              padding-left: env(safe-area-inset-left);
              padding-right: env(safe-area-inset-right);
            }
            
            /* 隐藏浏览器UI的元素 */
            .pwa-only {
              display: block;
            }
          }
          
          /* 安装提示按钮样式 */
          #installButton {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            background: #3b82f6;
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            border: none;
            cursor: pointer;
            display: none; /* 默认隐藏，由JS控制显示 */
          }
          
          #installButton:hover {
            background: #2563eb;
          }
        `}</style>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}
      >
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
            
            {/* 安装提示按钮 */}
            <button id="installButton" aria-label="安装应用到主屏幕">
              安装应用
            </button>
            
            {/* 可选：添加页脚 */}
            <footer className="bg-white border-t border-gray-200 py-6 mt-8">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
                <p>单词学习App - 让记忆更科学，让学习更高效</p>
                <p className="mt-2 text-xs">
                  添加到主屏幕获得更好的体验！
                </p>
              </div>
            </footer>
          </div>
        </AuthProvider>
        
        {/* PWA 安装逻辑 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `              
              // 检测是否可安装到主屏幕
              let deferredPrompt;
              const installButton = document.getElementById('installButton');
              
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                
                // 显示安装按钮
                if (installButton) {
                  installButton.style.display = 'block';
                  
                  // 隐藏按钮后再次显示的条件
                  const alreadyShown = localStorage.getItem('installPromptShown');
                  if (alreadyShown) {
                    // 如果之前已经显示过，可以设置延迟显示或只在特定条件下显示
                    setTimeout(() => {
                      installButton.style.display = 'block';
                    }, 30000); // 30秒后显示
                  } else {
                    installButton.style.display = 'block';
                    localStorage.setItem('installPromptShown', 'true');
                  }
                }
                
                // 添加安装引导说明
                const installGuide = document.createElement('div');
                installGuide.id = 'installGuide';
                installGuide.style.cssText = 
                  'position: fixed; bottom: 80px; right: 20px; ' +
                  'background: white; padding: 15px; border-radius: 8px; ' +
                  'box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 999; ' +
                  'max-width: 250px; display: none;';
                installGuide.innerHTML = 
                  '<p style="margin:0 0 10px 0; font-size:14px;">' +
                  '点击安装按钮，然后选择"添加到主屏幕"</p>' +
                  '<button onclick="this.parentNode.style.display=\\'none\\'" ' +
                  'style="background:#ef4444; color:white; border:none; ' +
                  'padding:5px 10px; border-radius:4px; cursor:pointer;">' +
                  '知道了</button>';
                document.body.appendChild(installGuide);
              });
              
              // 安装按钮点击事件
              if (installButton) {
                installButton.addEventListener('click', async () => {
                  if (!deferredPrompt) return;
                  
                  // 显示引导
                  const guide = document.getElementById('installGuide');
                  if (guide) guide.style.display = 'block';
                  
                  // 触发安装提示
                  deferredPrompt.prompt();
                  
                  // 等待用户选择
                  const choiceResult = await deferredPrompt.userChoice;
                  
                  if (choiceResult.outcome === 'accepted') {
                    console.log('用户接受了安装');
                    installButton.style.display = 'none';
                    if (guide) guide.style.display = 'none';
                    
                    // 可以在这里发送安装成功的事件到分析工具
                    if (typeof gtag !== 'undefined') {
                      gtag('event', 'install', {
                        event_category: 'PWA',
                        event_label: '安装成功'
                      });
                    }
                  } else {
                    console.log('用户拒绝了安装');
                    // 可以设置稍后提醒的逻辑
                    setTimeout(() => {
                      installButton.style.display = 'block';
                    }, 60000); // 1分钟后再次显示
                  }
                  
                  deferredPrompt = null;
                });
              }
              
              // 检测是否已安装
              window.addEventListener('appinstalled', (evt) => {
                console.log('应用已安装到主屏幕');
                if (installButton) installButton.style.display = 'none';
                
                // 可以发送已安装事件到分析工具
                if (typeof gtag !== 'undefined') {
                  gtag('event', 'installed', {
                    event_category: 'PWA',
                    event_label: '已安装'
                  });
                }
              });
              
              // 检测显示模式
              function detectDisplayMode() {
                const displayMode = window.matchMedia('(display-mode: standalone)').matches 
                  ? 'standalone' 
                  : 'browser';
                
                if (displayMode === 'standalone') {
                  document.documentElement.classList.add('pwa-mode');
                  if (installButton) installButton.style.display = 'none';
                }
                
                // 发送显示模式事件
                if (typeof gtag !== 'undefined') {
                  gtag('event', 'display_mode', {
                    event_category: 'PWA',
                    event_label: displayMode
                  });
                }
              }
              
              // 初始检测
              detectDisplayMode();
              
              // 监听显示模式变化
              window.matchMedia('(display-mode: standalone)').addListener(detectDisplayMode);
              
              // 离线检测
              function updateOnlineStatus() {
                const status = navigator.onLine ? 'online' : 'offline';
                document.documentElement.setAttribute('data-network', status);
                
                if (!navigator.onLine) {
                  // 显示离线提示
                  const offlineToast = document.createElement('div');
                  offlineToast.id = 'offlineToast';
                  offlineToast.style.cssText = 
                    'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); ' +
                    'background: #f59e0b; color: white; padding: 10px 20px; ' +
                    'border-radius: 8px; z-index: 1000; display: flex; ' +
                    'align-items: center; gap: 10px;';
                  offlineToast.innerHTML = 
                    '<span>⚠️ 网络连接已断开，正在使用离线模式</span>' +
                    '<button onclick="this.parentNode.remove()" style="' +
                    'background:transparent; border:none; color:white; ' +
                    'cursor:pointer;">×</button>';
                  
                  if (!document.getElementById('offlineToast')) {
                    document.body.appendChild(offlineToast);
                  }
                } else {
                  const offlineToast = document.getElementById('offlineToast');
                  if (offlineToast) offlineToast.remove();
                }
              }
              
              window.addEventListener('online', updateOnlineStatus);
              window.addEventListener('offline', updateOnlineStatus);
              updateOnlineStatus(); // 初始检测
            `,
          }}
        />
      </body>
    </html>
  );
}