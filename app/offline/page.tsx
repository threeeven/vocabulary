// app/offline/page.tsx 或 pages/offline.tsx
export default function OfflinePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1>离线模式</h1>
      <p>你当前处于离线状态。请检查网络连接。</p>
      <p>部分内容可能无法访问。</p>
      <button onClick={() => window.location.reload()}>
        重试
      </button>
    </div>
  )
}