// app/pwa-test/page.tsx 或 pages/pwa-test.tsx
'use client'

import { useState } from 'react'

export default function PWATestPage() {
  const [installationStatus, setInstallationStatus] = useState('')

  const checkPWA = () => {
    const checks = {
      'Service Worker': 'serviceWorker' in navigator,
      'Manifest': !!document.querySelector('link[rel="manifest"]'),
      'HTTPS': window.location.protocol === 'https:',
      'Standalone': window.matchMedia('(display-mode: standalone)').matches,
    }

    const results = Object.entries(checks)
      .map(([key, value]) => `${key}: ${value ? '✅' : '❌'}`)
      .join('\n')

    setInstallationStatus(results)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>PWA 功能测试</h1>
      
      <button onClick={checkPWA} style={{ marginBottom: '20px' }}>
        检查 PWA 功能
      </button>
      
      {installationStatus && (
        <pre style={{
          background: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
          whiteSpace: 'pre-wrap'
        }}>
          {installationStatus}
        </pre>
      )}
      
      <div style={{ marginTop: '40px' }}>
        <h3>如何安装到手机桌面：</h3>
        <ul>
          <li><strong>Safari (iOS):</strong> 点击分享按钮 → "添加到主屏幕"</li>
          <li><strong>Chrome (Android):</strong> 点击菜单 → "添加到主屏幕"</li>
          <li><strong>Firefox:</strong> 点击菜单 → "安装"</li>
        </ul>
      </div>
    </div>
  )
}