import { useEffect, useRef, useState } from 'react'
import { exportRaw, importRaw } from '../lib/storage'
import { cloudSave, cloudRestore, CLOUD_ENABLED } from '../lib/backup'
import Icon from './Icon'

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

const btn = (primary = false) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
  padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  background: primary ? '#22c55e' : 'rgba(255,255,255,0.08)', color: primary ? '#06210f' : '#fff',
  border: primary ? 'none' : '1px solid rgba(255,255,255,0.16)',
})

export default function Settings({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [restoreCode, setRestoreCode] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    try { importRaw(await f.text()); location.reload() }
    catch { setMsg({ kind: 'err', text: 'That file isn’t a valid REX backup.' }) }
  }

  const doCloudSave = async () => {
    setBusy(true); setMsg(null)
    try {
      const c = await cloudSave(JSON.parse(exportRaw()), code ?? undefined)
      setCode(c); setMsg({ kind: 'ok', text: 'Backed up! Save this code to restore later.' })
    } catch (e) { setMsg({ kind: 'err', text: (e as Error).message }) }
    finally { setBusy(false) }
  }

  const doCloudRestore = async () => {
    if (restoreCode.trim().length !== 6) { setMsg({ kind: 'err', text: 'Enter your 6-character code.' }); return }
    setBusy(true); setMsg(null)
    try { const data = await cloudRestore(restoreCode); importRaw(JSON.stringify(data)); location.reload() }
    catch (e) { setMsg({ kind: 'err', text: (e as Error).message }) }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Settings"
        style={{ width: '100%', maxWidth: 480, maxHeight: '88dvh', overflowY: 'auto', borderRadius: '24px 24px 0 0', background: '#15151F', border: '1px solid rgba(255,255,255,0.1)', padding: '18px 20px calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Settings</div>
          <button onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={17} /></button>
        </div>
        <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, marginBottom: 16 }}>
          Your watchlist, ratings, and learned taste live on this device only. Back them up so you don’t lose them if your browser clears data.
        </div>

        {/* On-device file backup */}
        <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Backup file</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <button onClick={() => download('rex-backup.json', exportRaw())} style={btn()}><Icon name="download" size={17} /> Download</button>
          <button onClick={() => fileRef.current?.click()} style={btn()}><Icon name="upload" size={17} /> Restore</button>
          <input ref={fileRef} type="file" accept="application/json" onChange={onFile} style={{ display: 'none' }} />
        </div>

        {/* Cloud backup by code */}
        {CLOUD_ENABLED && (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Cloud backup (restore on any device)</div>
            <button onClick={doCloudSave} disabled={busy} style={{ ...btn(true), opacity: busy ? 0.6 : 1, marginBottom: 10 }}>
              <Icon name="gear" size={16} /> {busy ? 'Working…' : 'Back up to cloud'}
            </button>
            {code && (
              <div style={{ textAlign: 'center', margin: '4px 0 14px', padding: '12px', borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)' }}>
                <div style={{ fontSize: 11.5, opacity: 0.7 }}>Your restore code</div>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '0.22em', marginTop: 2 }}>{code}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input value={restoreCode} onChange={e => setRestoreCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="Enter code"
                style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, letterSpacing: '0.15em', textAlign: 'center', padding: '11px', borderRadius: 12, outline: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.16)' }} />
              <button onClick={doCloudRestore} disabled={busy} style={{ ...btn(), width: 'auto', padding: '11px 18px', opacity: busy ? 0.6 : 1 }}>Restore</button>
            </div>
          </>
        )}

        {msg && (
          <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600, color: msg.kind === 'ok' ? '#86efac' : '#fca5a5' }}>{msg.text}</div>
        )}
      </div>
    </div>
  )
}
