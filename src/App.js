import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'

// ── Logo (embedded) ───────────────────────────────────────────────────────────
import logo from './logo.jpg'

// ── Constants ─────────────────────────────────────────────────────────────────
const MINISTRIES = [
  { id: 'mininova',     label: 'MiniNova' },
  { id: 'frontline',    label: 'Frontline' },
  { id: 'creative',     label: 'Creative' },
  { id: 'creativetech', label: 'Creative Technology' },
  { id: 'supernova',    label: 'Supernova' },
  { id: 'novauni', label: 'NovaUni' },
  { id: 'building',     label: 'Building Presentation' },
  { id: 'worship',      label: 'Worship' },
  { id: 'staffmr', label: 'Staff/MR' },
]
const PIPELINE = [
  'Ministry Leader (ML)',
  'Team Leader (TL)',
  'Potential Team Leader (PTL)',
  'Leader in Training (LIT)',
  'Team Member (TM)',
  'Staff/MR'
]
const WARNING_DAYS = 60
const SC_YEARS = 3
const WW_YEARS = 5

// ── Helpers ───────────────────────────────────────────────────────────────────
function addYears(d, y) {
  if (!d) return null
  const x = new Date(d)
  x.setFullYear(x.getFullYear() + y)
  return x.toISOString().split('T')[0]
}
function daysDiff(d) {
  if (!d) return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.round((new Date(d) - now) / 86400000)
}
function statusFor(e) {
  if (e === 'pending') return 'pending'
  if (!e) return 'missing'
  const d = daysDiff(e)
  if (d < 0) return 'expired'
  if (d <= WARNING_DAYS) return 'expiring'
  return 'current'
}
function fmtDate(d) {
  if (!d || d === 'pending') return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS = {
  current:  { label: 'Current',        bg: '#F0FAF4', fg: '#1A6B35', dot: '#22A355', border: '#BBE8CC' },
  expiring: { label: 'Expiring Soon',  bg: '#FDFBF0', fg: '#6B5A00', dot: '#C49A00', border: '#EDE09A' },
  expired:  { label: 'Expired',        bg: '#FDF2F2', fg: '#8B1A1A', dot: '#CC2222', border: '#F0BBBB' },
  pending:  { label: 'Pending',        bg: '#F0F4FF', fg: '#1A3A8B', dot: '#3B62E0', border: '#B3C3F5' },
  missing:  { label: 'Not recorded',   bg: '#F5F5F5', fg: '#666',    dot: '#AAA',    border: '#DDD'    },
}

// ── Message templates ─────────────────────────────────────────────────────────
function buildLeaderEmail(ministry, atRisk) {
  const NL = '\n'
  const lines = atRisk.map(p => {
    const sc = statusFor(p.sc_expiry), ww = statusFor(p.wwcc_expiry)
    const issues = []
    if (sc !== 'current') issues.push(`ACC Safer Churches: ${STATUS[sc].label}${p.sc_expiry && p.sc_expiry !== 'pending' ? ` (exp. ${fmtDate(p.sc_expiry)})` : ''}`)
    if (ww !== 'current') issues.push(`WWCC: ${STATUS[ww].label}${p.wwcc_expiry && p.wwcc_expiry !== 'pending' ? ` (exp. ${fmtDate(p.wwcc_expiry)})` : ''}`)
    return `  • ${p.name}${p.role ? ` (${p.role})` : ''}${NL}    ${issues.join('  |  ')}`
  }).join(NL + NL)
  return `Hi,${NL}${NL}I'm following up on some outstanding compliance items for the ${ministry} team.${NL}${NL}The following team members have ACC Safer Churches training or Working With Children Check items that need attention:${NL}${NL}${lines}${NL}${NL}Could you please follow up with each of these team members and let me know once they've completed the required steps?${NL}${NL}For reference:${NL}  — ACC Safer Churches training: acc.org.au/safer-churches${NL}  — WWCC renewals (SA): screening.sa.gov.au${NL}${NL}Thank you for helping us keep our community safe.${NL}${NL}Warm regards,${NL}Nova Church Team`
}

function buildPersonEmail(name, hasSC, hasWWCC) {
  const NL = '\n'
  const fname = name.split(' ')[0]
  const plural = hasSC && hasWWCC ? 's' : ''
  const scBlock = hasSC
    ? `ACC Safer Churches Training${NL}This is a free online training module through ACC (free, ~30 min). You can complete it here:${NL}👉 acc.org.au/safer-churches${NL}${NL}Alternatively, you're welcome to join our next group training session on [DATE & TIME].${NL}${NL}` : ''
  const wwBlock = hasWWCC
    ? `Working With Children Check (WWCC)${NL}A WWCC is required for anyone serving with children or youth. If you're a volunteer and don't yet have one, Nova can initiate the application on your behalf — completely free of charge. All we need is your permission, just reply to this email and we'll take care of it.${NL}${NL}` : ''
  return `Hi ${fname},${NL}${NL}Hope you're doing well! Just following up on the below compliance item${plural}:${NL}${NL}${scBlock}${wwBlock}Thank you! Reach out if you have any questions.${NL}${NL}Nova Church Team`
}

function buildTelegram(name, hasSC, hasWWCC) {
  const NL = '\n'
  const fname = name.split(' ')[0]
  const scBlock = hasSC
    ? `✅ ACC Safer Churches Training${NL}Complete online here: acc.org.au/safer-churches (free, ~30 min)${NL}Or come to our next group training session — [DATE & TIME]${NL}${NL}` : ''
  const wwBlock = hasWWCC
    ? `✅ Working With Children Check (WWCC)${NL}If you don't have one as a volunteer, no worries — Nova can initiate the application on your behalf for free. Just reply here and we'll sort it! 😊${NL}${NL}` : ''
  return `Hey ${fname}! 👋${NL}${NL}Just a quick follow-up on your compliance for Nova — we still need:${NL}${NL}${scBlock}${wwBlock}Thank you! Reach out if any questions 🙏`
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  font: "'Manrope', sans-serif",
  black: '#111',
  white: '#fff',
  off: '#F9F9F9',
  rule: '#E0E0E0',
  ruleLight: '#EEEEEE',
  muted: '#888',
  sub: '#555',
}

const inp = {
  width: '100%', padding: '9px 11px', fontSize: 13,
  border: `1px solid ${s.rule}`, outline: 'none',
  color: s.black, background: s.off,
  fontFamily: s.font, borderRadius: 0, boxSizing: 'border-box',
}

function Btn({ children, onClick, variant = 'outline', size = 'md', style: extra = {} }) {
  const base = {
    fontFamily: s.font, cursor: 'pointer', border: 'none',
    fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
    whiteSpace: 'nowrap', transition: 'opacity .15s',
    padding: size === 'sm' ? '5px 10px' : '8px 14px',
    fontSize: size === 'sm' ? 11 : 11,
  }
  const variants = {
    primary: { background: s.black, color: s.white },
    outline: { background: s.white, color: s.black, border: `1px solid ${s.rule}` },
    danger:  { background: '#CC2222', color: s.white },
  }
  return (
    <button onClick={onClick} style={{ ...base, ...variants[variant], ...extra }}>
      {children}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <span style={{ fontFamily: s.font, fontWeight: 800, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: s.black, whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <span style={{ flex: 1, height: 1, background: s.rule }} />
    </div>
  )
}

function Badge({ status }) {
  const st = STATUS[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: st.bg, color: st.fg, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', padding: '3px 9px', border: `1px solid ${st.border}`, textTransform: 'uppercase', whiteSpace: 'nowrap', fontFamily: s.font }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
      {st.label}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: s.sub, marginBottom: 5, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: s.font }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }} onClick={onClose}>
      <div style={{ background: s.white, width: '100%', maxWidth: wide ? 580 : 520, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', border: `1px solid ${s.rule}`, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: s.font }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 28px 18px', borderBottom: `1px solid ${s.rule}`, flexShrink: 0, position: 'relative' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: s.muted, marginBottom: 6 }}>Nova Church</div>
          <div style={{ fontWeight: 800, fontSize: 18, color: s.black, letterSpacing: '-0.02em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: s.muted, fontFamily: "'Lora', serif", fontStyle: 'italic', marginTop: 3 }}>{subtitle}</div>}
          <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 20, background: 'none', border: 'none', fontSize: 22, color: s.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

// ── PIN Screen ────────────────────────────────────────────────────────────────
function PinScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  async function check() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'pin').single()
    const correct = data?.value || '1234'
    if (pin === correct) { onUnlock() }
    else { setError(true); setPin('') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: s.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, fontFamily: s.font }}>
      <img src={logo} alt="Nova Church" style={{ height: 64, width: 'auto' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: s.black, letterSpacing: '-0.02em' }}>Ministry Compliance</div>
        <div style={{ fontSize: 12, color: s.muted, fontFamily: "'Lora', serif", fontStyle: 'italic', marginTop: 4 }}>Child &amp; Youth Safety</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <input
          type="password" value={pin} onChange={e => { setPin(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="PIN" maxLength={6}
          style={{ ...inp, textAlign: 'center', letterSpacing: '0.3em', fontSize: 20, fontWeight: 800, width: 160 }}
        />
        {error && <div style={{ fontSize: 12, color: '#CC2222', fontWeight: 600 }}>Incorrect PIN. Try again.</div>}
        <Btn variant="primary" onClick={check}>Unlock</Btn>
      </div>
      <div style={{ fontSize: 10, color: '#BBB', textAlign: 'center', maxWidth: 240 }}>Default PIN: 1234 — change it under Settings</div>
    </div>
  )
}

// ── Person Form ───────────────────────────────────────────────────────────────
function PersonForm({ initial, onSave, onCancel, loading }) {
  const blank = { name: '', ministry: MINISTRIES[0].id, role: '', notes: '', sc_date: '', sc_expiry: '', wwcc_number: '', wwcc_date: '', wwcc_expiry: '' }
  const [form, setForm] = useState(initial || blank)
  const scPending = form.sc_expiry === 'pending'
  const wwPending = form.wwcc_expiry === 'pending'

  function set(k, v) {
    setForm(f => {
      const n = { ...f, [k]: v }
      if (k === 'sc_date') n.sc_expiry = addYears(v, SC_YEARS) || ''
      if (k === 'wwcc_date') n.wwcc_expiry = addYears(v, WW_YEARS) || ''
      return n
    })
  }

  return (
    <div>
      <Field label="Full name">
        <input style={inp} value={form.name} placeholder="e.g. Sarah Johnson" onChange={e => set('name', e.target.value)} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Ministry">
          <select style={inp} value={form.ministry} onChange={e => set('ministry', e.target.value)}>
            {MINISTRIES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Leadership Role">
          <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="">— Select position —</option>
            {PIPELINE.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={form.notes || ''} placeholder="e.g. Certificate emailed 12 Jun…" onChange={e => set('notes', e.target.value)} />
      </Field>

      {/* SC Training */}
      <div style={{ marginTop: 8 }}>
        <SectionLabel>ACC Safer Churches Training</SectionLabel>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {['date', 'pending'].map(v => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: s.sub, fontFamily: s.font }}>
              <input type="radio" checked={v === 'pending' ? scPending : !scPending}
                onChange={() => setForm(f => ({ ...f, sc_date: '', sc_expiry: v === 'pending' ? 'pending' : '' }))}
                style={{ accentColor: s.black }} />
              {v === 'pending' ? 'Pending' : 'Has completion date'}
            </label>
          ))}
        </div>
        {!scPending && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Completed date"><input type="date" style={inp} value={form.sc_date || ''} onChange={e => set('sc_date', e.target.value)} /></Field>
            <Field label={`Expiry (auto +${SC_YEARS}yr)`}><input type="date" style={inp} value={form.sc_expiry || ''} onChange={e => set('sc_expiry', e.target.value)} /></Field>
          </div>
        )}
      </div>

      {/* WWCC */}
      <div style={{ marginTop: 8 }}>
        <SectionLabel>Working With Children Check</SectionLabel>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {['date', 'pending'].map(v => (
            <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: s.sub, fontFamily: s.font }}>
              <input type="radio" checked={v === 'pending' ? wwPending : !wwPending}
                onChange={() => setForm(f => ({ ...f, wwcc_date: '', wwcc_expiry: v === 'pending' ? 'pending' : '', wwcc_number: '' }))}
                style={{ accentColor: s.black }} />
              {v === 'pending' ? 'Pending' : 'Has completion date'}
            </label>
          ))}
        </div>
        {!wwPending && (
          <>
            <Field label="WWCC number"><input style={inp} value={form.wwcc_number || ''} placeholder="e.g. WWC0123456A" onChange={e => set('wwcc_number', e.target.value)} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Issue date"><input type="date" style={inp} value={form.wwcc_date || ''} onChange={e => set('wwcc_date', e.target.value)} /></Field>
              <Field label={`Expiry (auto +${WW_YEARS}yr)`}><input type="date" style={inp} value={form.wwcc_expiry || ''} onChange={e => set('wwcc_expiry', e.target.value)} /></Field>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${s.ruleLight}` }}>
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn variant="primary" onClick={() => form.name.trim() && onSave(form)} style={{ opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Saving…' : 'Save person'}
        </Btn>
      </div>
    </div>
  )
}

// ── Reminder Modal ────────────────────────────────────────────────────────────
function ReminderModal({ people, leaders, onClose, onLogReminder }) {
  const [tab, setTab] = useState('leader')
  const [selectedId, setSelectedId] = useState(null)
  const [copied, setCopied] = useState(null)

  const atRisk = people.filter(p => {
    const sc = statusFor(p.sc_expiry), ww = statusFor(p.wwcc_expiry)
    return ['expired', 'expiring', 'missing', 'pending'].some(s => sc === s || ww === s)
  })
  const byMin = MINISTRIES.map(m => {
    const at = atRisk.filter(p => p.ministry === m.id)
    return { ...m, at, email: leaders[m.id] || '' }
  }).filter(m => m.at.length > 0)

  const activePerson = atRisk.find(p => p.id === selectedId) || atRisk[0]

  function copy(key, text, personId) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key); setTimeout(() => setCopied(null), 2500)
    if (personId) onLogReminder(personId)
  }
  function mailto(email, subject, body, personId) {
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
    if (personId) onLogReminder(personId)
  }

  const tabStyle = active => ({
    padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
    borderBottom: active ? `2px solid ${s.black}` : '2px solid transparent',
    color: active ? s.black : s.muted, fontFamily: s.font,
    fontWeight: active ? 800 : 600, fontSize: 11,
    letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
  })

  const personSelect = (
    <select style={{ ...inp, marginBottom: 14 }} value={activePerson?.id || ''} onChange={e => setSelectedId(e.target.value)}>
      {atRisk.map(p => {
        const min = MINISTRIES.find(m => m.id === p.ministry)
        return <option key={p.id} value={p.id}>{p.name} — {min?.label}</option>
      })}
    </select>
  )

  return (
    <Modal title="Reminders" subtitle="Draft messages for ministry compliance" onClose={onClose} wide>
      {atRisk.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: s.black, marginBottom: 6 }}>All compliant</div>
          <div style={{ fontSize: 13, color: s.muted, fontFamily: "'Lora', serif", fontStyle: 'italic' }}>No reminders needed right now.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', borderBottom: `1px solid ${s.rule}`, marginBottom: 20 }}>
            {[['leader', 'Leader Email'], ['person-email', 'Individual Email'], ['person-telegram', 'Telegram']].map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>{l}</button>
            ))}
          </div>

          {tab === 'leader' && (
            <div>
              <p style={{ fontSize: 12, color: s.muted, marginBottom: 16 }}>{byMin.length} ministr{byMin.length > 1 ? 'ies need' : 'y needs'} attention.</p>
              {byMin.map(m => {
                const body = buildLeaderEmail(m.label, m.at)
                const subject = `[Action Required] Compliance Renewal — ${m.label}`
                const k = `leader-${m.id}`
                const lastSent = m.at.flatMap(p => p.reminder_log || []).sort().reverse()[0]
                return (
                  <div key={m.id} style={{ border: `1px solid ${s.rule}`, marginBottom: 10 }}>
                    <div style={{ background: s.off, padding: '10px 14px', borderBottom: `1px solid ${s.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: s.black }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: s.muted, marginTop: 1 }}>{m.at.length} {m.at.length > 1 ? 'people' : 'person'} outstanding</div>
                        {lastSent && <div style={{ fontSize: 10, color: s.muted, fontStyle: 'italic', marginTop: 2 }}>Last reminded: {fmtDateTime(lastSent)}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <Btn size="sm" onClick={() => copy(k, body, null)}>{copied === k ? '✓ Copied' : 'Copy'}</Btn>
                        <Btn size="sm" variant="primary" onClick={() => mailto(m.email, subject, body, null)}>Open in Mail ↗</Btn>
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px', fontSize: 11, color: s.sub, fontFamily: "'Lora', serif", fontStyle: 'italic', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 110, overflowY: 'auto' }}>
                      {body.slice(0, 300)}…
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'person-email' && activePerson && (() => {
            const sc = statusFor(activePerson.sc_expiry), ww = statusFor(activePerson.wwcc_expiry)
            const body = buildPersonEmail(activePerson.name, sc !== 'current', ww !== 'current')
            const subject = 'Compliance — Action Required'
            const k = `person-${activePerson.id}`
            const lastSent = (activePerson.reminder_log || []).slice(-1)[0]
            return (
              <div>
                <p style={{ fontSize: 12, color: s.muted, marginBottom: 14 }}>Personal email drafted for each individual.</p>
                {personSelect}
                <div style={{ border: `1px solid ${s.rule}` }}>
                  <div style={{ background: s.off, padding: '10px 14px', borderBottom: `1px solid ${s.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: s.black }}>{activePerson.name}</div>
                      {lastSent && <div style={{ fontSize: 10, color: s.muted, fontStyle: 'italic', marginTop: 2 }}>Last reminded: {fmtDateTime(lastSent)}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <Btn size="sm" onClick={() => copy(k, body, activePerson.id)}>{copied === k ? '✓ Copied' : 'Copy'}</Btn>
                      <Btn size="sm" variant="primary" onClick={() => mailto('', subject, body, activePerson.id)}>Open in Mail ↗</Btn>
                    </div>
                  </div>
                  <div style={{ padding: 14, fontSize: 12, color: s.sub, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>{body}</div>
                </div>
              </div>
            )
          })()}

          {tab === 'person-telegram' && activePerson && (() => {
            const sc = statusFor(activePerson.sc_expiry), ww = statusFor(activePerson.wwcc_expiry)
            const msg = buildTelegram(activePerson.name, sc !== 'current', ww !== 'current')
            const k = `tg-${activePerson.id}`
            const lastSent = (activePerson.reminder_log || []).slice(-1)[0]
            return (
              <div>
                <p style={{ fontSize: 12, color: s.muted, marginBottom: 14 }}>Short Telegram message ready to copy.</p>
                {personSelect}
                <div style={{ border: `1px solid ${s.rule}` }}>
                  <div style={{ background: s.off, padding: '10px 14px', borderBottom: `1px solid ${s.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13, color: s.black }}>{activePerson.name}</div>
                      {lastSent && <div style={{ fontSize: 10, color: s.muted, fontStyle: 'italic', marginTop: 2 }}>Last reminded: {fmtDateTime(lastSent)}</div>}
                    </div>
                    <Btn size="sm" onClick={() => copy(k, msg, activePerson.id)}>{copied === k ? '✓ Copied' : 'Copy message'}</Btn>
                  </div>
                  <div style={{ padding: 14, fontSize: 13, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#F7F9FC', borderLeft: '3px solid #3B62E0', maxHeight: 240, overflowY: 'auto' }}>{msg}</div>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </Modal>
  )
}

// ── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({ leaders, onSave, onClose }) {
  const [emails, setEmails] = useState(leaders)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (newPin) {
      if (newPin !== confirmPin) { setPinMsg("PINs don't match."); return }
      if (newPin.length < 4) { setPinMsg('PIN must be at least 4 digits.'); return }
    }
    setSaving(true)
    await onSave(emails, newPin || null)
    setSaving(false)
    onClose()
  }

  return (
    <Modal title="Settings" onClose={onClose} wide>
      <SectionLabel>Ministry Leader Emails</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {MINISTRIES.map(m => (
          <Field key={m.id} label={m.label}>
            <input style={inp} value={emails[m.id] || ''} onChange={e => setEmails(em => ({ ...em, [m.id]: e.target.value }))} placeholder={`${m.id}@novachurch.com.au`} />
          </Field>
        ))}
      </div>
      <SectionLabel>Change PIN</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="New PIN"><input type="password" style={inp} value={newPin} onChange={e => { setNewPin(e.target.value); setPinMsg('') }} placeholder="4–6 digits" maxLength={6} /></Field>
        <Field label="Confirm PIN"><input type="password" style={inp} value={confirmPin} onChange={e => { setConfirmPin(e.target.value); setPinMsg('') }} placeholder="Repeat PIN" maxLength={6} /></Field>
      </div>
      {pinMsg && <div style={{ fontSize: 12, color: '#CC2222', marginTop: -8, marginBottom: 8 }}>{pinMsg}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${s.ruleLight}` }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={save}>{saving ? 'Saving…' : 'Save settings'}</Btn>
      </div>
    </Modal>
  )
}

// ── Import Modal ──────────────────────────────────────────────────────────────
function ImportModal({ onImport, onClose }) {
  const [msg, setMsg] = useState('')
  const [msgColor, setMsgColor] = useState('')

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const lines = ev.target.result.split('\n').filter(l => l.trim())
        const imported = lines.slice(1).map(line => {
          const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) || []
          const clean = cols.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"'))
          const minId = MINISTRIES.find(m => m.label.toLowerCase() === (clean[1] || '').toLowerCase() || m.id.toLowerCase() === (clean[1] || '').toLowerCase())
          return { name: clean[0] || '', ministry: minId ? minId.id : MINISTRIES[0].id, role: clean[2] || '', notes: clean[3] || '', sc_date: clean[4] || null, sc_expiry: clean[5] || null, wwcc_number: clean[7] || '', wwcc_date: clean[8] || null, wwcc_expiry: clean[9] || null, reminder_log: [], updated_at: new Date().toISOString() }
        }).filter(p => p.name)
        onImport(imported)
        setMsgColor('#1A6B35'); setMsg(`${imported.length} people imported.`)
        setTimeout(onClose, 1500)
      } catch (err) { setMsgColor('#CC2222'); setMsg('Error parsing CSV: ' + err.message) }
    }
    reader.readAsText(file)
  }

  return (
    <Modal title="Import via CSV" onClose={onClose}>
      <p style={{ fontSize: 12, color: s.sub, marginBottom: 14, lineHeight: 1.6 }}>
        CSV columns: <strong>name, ministry, role, notes, scDate, scExpiry, wwccNumber, wwccDate, wwccExpiry</strong><br />
        Ministry IDs: mininova, frontline, creative, creativetech, supernova, building, worship<br />
        Dates in YYYY-MM-DD. Use "pending" for pending items.
      </p>
      <Field label="Upload CSV"><input type="file" style={{ ...inp, padding: 6 }} accept=".csv" onChange={handleFile} /></Field>
      {msg && <div style={{ fontSize: 12, color: msgColor, marginTop: 8 }}>{msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  )
}

// ── Backup Modal ──────────────────────────────────────────────────────────────
function BackupModal({ people, onRestore, onClose }) {
  const [msg, setMsg] = useState('')
  const [msgColor, setMsgColor] = useState('')

  function exportBackup() {
    const json = JSON.stringify({ people, exportedAt: new Date().toISOString() }, null, 2)
    const a = document.createElement('a')
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json)
    a.download = `nova-compliance-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  function handleRestore(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result)
        if (!d.people) throw new Error('Invalid backup file.')
        onRestore(d.people)
        setMsgColor('#1A6B35'); setMsg('Restored successfully.')
        setTimeout(onClose, 1500)
      } catch (err) { setMsgColor('#CC2222'); setMsg('Error: ' + err.message) }
    }
    reader.readAsText(file)
  }

  return (
    <Modal title="Backup & Restore" onClose={onClose}>
      <SectionLabel>Export Backup</SectionLabel>
      <p style={{ fontSize: 12, color: s.sub, marginBottom: 14 }}>Download all data as a JSON file.</p>
      <Btn variant="primary" onClick={exportBackup} style={{ marginBottom: 24 }}>Download backup JSON</Btn>
      <SectionLabel>Restore from Backup</SectionLabel>
      <p style={{ fontSize: 12, color: s.sub, marginBottom: 14 }}>Upload a previously exported JSON file. This will <strong>replace</strong> all current data.</p>
      <Field label="JSON backup file"><input type="file" style={{ ...inp, padding: 6 }} accept=".json" onChange={handleRestore} /></Field>
      {msg && <div style={{ fontSize: 12, color: msgColor, marginTop: 8 }}>{msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [unlocked, setUnlocked] = useState(false)
  const [people, setPeople] = useState([])
  const [leaders, setLeaders] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [searchQ, setSearchQ] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [modal, setModal] = useState(null) // null | {type, payload?}

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: pData }, { data: lData }] = await Promise.all([
      supabase.from('people').select('*').order('name'),
      supabase.from('ministry_leaders').select('*'),
    ])
    setPeople(pData || [])
    const lMap = {}
    ;(lData || []).forEach(l => { lMap[l.ministry_id] = l.email })
    setLeaders(lMap)
    setLoading(false)
  }, [])

  useEffect(() => { if (unlocked) loadAll() }, [unlocked, loadAll])

  // ── Realtime ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!unlocked) return
    const channel = supabase.channel('people-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people' }, () => loadAll())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [unlocked, loadAll])

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function savePerson(form) {
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      ministry: form.ministry,
      role: form.role || null,
      notes: form.notes || null,
      sc_date: form.sc_date || null,
      sc_expiry: form.sc_expiry || null,
      wwcc_number: form.wwcc_number || null,
      wwcc_date: form.wwcc_date || null,
      wwcc_expiry: form.wwcc_expiry || null,
      updated_at: new Date().toISOString(),
    }
    if (form.id) {
      await supabase.from('people').update(payload).eq('id', form.id)
    } else {
      await supabase.from('people').insert({ ...payload, reminder_log: [] })
    }
    await loadAll()
    setSaving(false)
    setModal(null)
  }

  async function deletePerson(id) {
    await supabase.from('people').delete().eq('id', id)
    await loadAll()
    setModal(null)
  }

  async function logReminder(personId) {
    const person = people.find(p => p.id === personId)
    if (!person) return
    const log = [...(person.reminder_log || []), new Date().toISOString()]
    await supabase.from('people').update({ reminder_log: log }).eq('id', personId)
    await loadAll()
  }

  async function saveSettings(emailMap, newPin) {
    const updates = Object.entries(emailMap).map(([ministry_id, email]) =>
      supabase.from('ministry_leaders').update({ email }).eq('ministry_id', ministry_id)
    )
    if (newPin) updates.push(supabase.from('settings').update({ value: newPin }).eq('key', 'pin'))
    await Promise.all(updates)
    await loadAll()
  }

  async function importPeople(rows) {
    await supabase.from('people').insert(rows)
    await loadAll()
    setModal(null)
  }

  async function restorePeople(rows) {
    await supabase.from('people').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    const clean = rows.map(p => ({ name: p.name, ministry: p.ministry, role: p.role || null, notes: p.notes || null, sc_date: p.sc_date || null, sc_expiry: p.sc_expiry || null, wwcc_number: p.wwcc_number || null, wwcc_date: p.wwcc_date || null, wwcc_expiry: p.wwcc_expiry || null, reminder_log: p.reminder_log || [], updated_at: new Date().toISOString() }))
    await supabase.from('people').insert(clean)
    await loadAll()
    setModal(null)
  }

  function exportCSV() {
    const headers = ['Name', 'Ministry', 'Role', 'Notes', 'SC Date', 'SC Expiry', 'SC Status', 'WWCC Number', 'WWCC Date', 'WWCC Expiry', 'WWCC Status', 'Last Updated', 'Last Reminded']
    const rows = people.map(p => {
      const min = MINISTRIES.find(m => m.id === p.ministry)
      const lastRem = (p.reminder_log || []).slice(-1)[0] || ''
      return [p.name, min?.label || '', p.role || '', p.notes || '', p.sc_date || '', p.sc_expiry || '', STATUS[statusFor(p.sc_expiry)]?.label, p.wwcc_number || '', p.wwcc_date || '', p.wwcc_expiry || '', STATUS[statusFor(p.wwcc_expiry)]?.label, p.updated_at || '', lastRem]
        .map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `nova-compliance-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  const filtered = people.filter(p => {
    if (activeTab !== 'all' && p.ministry !== activeTab) return false
    if (searchQ && !p.name.toLowerCase().includes(searchQ.toLowerCase())) return false
    if (filterStatus === 'issues') {
      const sc = statusFor(p.sc_expiry), ww = statusFor(p.wwcc_expiry)
      if (!['expired', 'expiring'].includes(sc) && !['expired', 'expiring'].includes(ww)) return false
    }
    if (filterStatus === 'missing') {
      if (statusFor(p.sc_expiry) !== 'missing' && statusFor(p.wwcc_expiry) !== 'missing') return false
    }
    return true
  })

  const issueCount = people.filter(p => ['expired', 'expiring'].includes(statusFor(p.sc_expiry)) || ['expired', 'expiring'].includes(statusFor(p.wwcc_expiry))).length

  const soonExpiring = people.filter(p => statusFor(p.sc_expiry) === 'expiring' || statusFor(p.wwcc_expiry) === 'expiring')

  const upcoming = []
  people.forEach(p => {
    if (p.sc_expiry && p.sc_expiry !== 'pending') { const d = daysDiff(p.sc_expiry); if (d >= 0 && d <= 90) upcoming.push({ p, type: 'SC Training', days: d, expiry: p.sc_expiry }) }
    if (p.wwcc_expiry && p.wwcc_expiry !== 'pending') { const d = daysDiff(p.wwcc_expiry); if (d >= 0 && d <= 90) upcoming.push({ p, type: 'WWCC', days: d, expiry: p.wwcc_expiry }) }
  })
  upcoming.sort((a, b) => a.days - b.days).splice(5)

  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: s.font, background: s.white, minHeight: '100vh', color: s.black }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${s.rule}`, background: s.white, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0 14px', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <img src={logo} alt="Nova Church" style={{ height: 42, width: 'auto' }} />
              <div style={{ borderLeft: `1px solid ${s.rule}`, paddingLeft: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: s.muted, marginBottom: 4 }}>Nova Church</div>
                <div style={{ fontWeight: 800, fontSize: 15, color: s.black, letterSpacing: '-0.02em' }}>
                  Ministry Compliance <em style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontWeight: 400, fontSize: 15 }}>Child &amp; Youth Safety</em>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn onClick={() => setModal({ type: 'reminder' })}>
                Reminders {issueCount > 0 && <span style={{ background: s.black, color: s.white, borderRadius: '50%', width: 17, height: 17, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, verticalAlign: 'middle', marginLeft: 4 }}>{issueCount}</span>}
              </Btn>
              <Btn variant="primary" onClick={() => setModal({ type: 'add' })}>+ Add person</Btn>
              <Btn onClick={exportCSV}>Export CSV</Btn>
              <Btn onClick={() => setModal({ type: 'import' })}>Import</Btn>
              <Btn onClick={() => setModal({ type: 'backup' })}>Backup</Btn>
              <Btn onClick={() => setModal({ type: 'settings' })}>Settings</Btn>
            </div>
          </div>
          {/* Ministry tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', marginBottom: -1 }}>
            {[{ id: 'all', label: `All (${people.length})` }, ...MINISTRIES.map(m => ({ id: m.id, label: `${m.label} (${people.filter(p => p.ministry === m.id).length})` }))].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === t.id ? `2px solid ${s.black}` : '2px solid transparent', color: activeTab === t.id ? s.black : s.muted, fontFamily: s.font, fontWeight: activeTab === t.id ? 800 : 500, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 32 }}>

        {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: s.muted, fontSize: 13 }}>Loading…</div>}

        {!loading && <>
          {/* Expiry banner */}
          {soonExpiring.length > 0 && (
            <div style={{ background: '#FDFBF0', border: '1px solid #EDE09A', borderLeft: '3px solid #C49A00', padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠️</span>
              <div style={{ fontSize: 12, color: '#6B5A00', lineHeight: 1.5 }}>
                {soonExpiring.slice(0, 3).map(p => <strong key={p.id}>{p.name}</strong>).reduce((a, b) => [a, ', ', b])}
                {soonExpiring.length > 3 && ` and ${soonExpiring.length - 3} more`}
                {' '}{soonExpiring.length === 1 ? 'has a compliance item' : 'have compliance items'} expiring within 60 days.{' '}
                <span onClick={() => setFilterStatus('issues')} style={{ color: '#6B5A00', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>View all</span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, marginBottom: 28, border: `1px solid ${s.rule}`, background: s.rule }}>
            {[
              { label: 'Total volunteers',  value: people.length },
              { label: 'Fully compliant',   value: people.filter(p => statusFor(p.sc_expiry) === 'current' && statusFor(p.wwcc_expiry) === 'current').length },
              { label: 'Expiring soon',     value: people.filter(p => statusFor(p.sc_expiry) === 'expiring' || statusFor(p.wwcc_expiry) === 'expiring').length },
              { label: 'Pending',           value: people.filter(p => statusFor(p.sc_expiry) === 'pending' || statusFor(p.wwcc_expiry) === 'pending').length },
            ].map((c, i) => (
              <div key={c.label} style={{ padding: '20px 22px', background: s.white, borderRight: i < 3 ? `1px solid ${s.rule}` : 'none' }}>
                <div style={{ fontWeight: 800, fontSize: 32, color: s.black, lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: 10, color: s.muted, marginTop: 5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Dashboard */}
          {(() => {
            const total = people.length
            const both = people.filter(p => statusFor(p.sc_expiry) === 'current' && statusFor(p.wwcc_expiry) === 'current').length
            const pct = total > 0 ? Math.round((both / total) * 100) : 0
            const barColor = pct === 100 ? '#22A355' : pct >= 70 ? s.black : '#CC2222'
            return (
              <div style={{ marginBottom: 28 }}>
                <SectionLabel>Ministry Dashboard</SectionLabel>
                <div style={{ border: `1px solid ${s.rule}`, padding: '20px 24px', marginBottom: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: s.muted }}>Church-wide Overall Compliance</span>
                    <span style={{ fontWeight: 800, fontSize: 22, color: s.black }}>{pct}%<span style={{ fontSize: 11, fontWeight: 500, color: s.muted, marginLeft: 6 }}>({both} of {total} fully compliant)</span></span>
                  </div>
                  <div style={{ height: 6, background: s.ruleLight }}><div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width .4s ease' }} /></div>
                </div>
                <div style={{ border: `1px solid ${s.rule}`, borderTop: 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 55px 1fr 1fr 1fr 1fr 75px', padding: '9px 16px', background: s.off, borderBottom: `1px solid ${s.rule}`, fontSize: 9, fontWeight: 800, color: s.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    <div>Ministry</div><div style={{ textAlign: 'center' }}>Total</div>
                    <div style={{ textAlign: 'center' }}>SC ✓</div><div style={{ textAlign: 'center' }}>SC ✗</div>
                    <div style={{ textAlign: 'center' }}>WWCC ✓</div><div style={{ textAlign: 'center' }}>WWCC ✗</div>
                    <div style={{ textAlign: 'center' }}>Compliant</div>
                  </div>
                  {MINISTRIES.map((m, i) => {
                    const mp = people.filter(p => p.ministry === m.id)
                    const t = mp.length
                    const scOk = mp.filter(p => statusFor(p.sc_expiry) === 'current').length
                    const wwOk = mp.filter(p => statusFor(p.wwcc_expiry) === 'current').length
                    const bt = mp.filter(p => statusFor(p.sc_expiry) === 'current' && statusFor(p.wwcc_expiry) === 'current').length
                    const p2 = t > 0 ? Math.round((bt / t) * 100) : null
                    const pc = p2 === 100 ? '#22A355' : p2 >= 70 ? s.black : '#CC2222'
                    const scBad = t - scOk, wwBad = t - wwOk
                    return (
                      <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '2fr 55px 1fr 1fr 1fr 1fr 75px', padding: '11px 16px', borderBottom: i < MINISTRIES.length - 1 ? `1px solid ${s.ruleLight}` : 'none', alignItems: 'center', background: t === 0 ? s.off : s.white }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{m.label}</div>
                          {t > 0 && <div style={{ height: 4, background: s.ruleLight, marginTop: 4, maxWidth: 120 }}><div style={{ height: '100%', width: `${p2 || 0}%`, background: pc }} /></div>}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 13, color: s.muted }}>{t}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, color: '#1A6B35' }}>{scOk}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: scBad > 0 ? 800 : 400, color: scBad > 0 ? '#CC2222' : s.muted }}>{scBad > 0 ? scBad : '—'}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, color: '#1A6B35' }}>{wwOk}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: wwBad > 0 ? 800 : 400, color: wwBad > 0 ? '#CC2222' : s.muted }}>{wwBad > 0 ? wwBad : '—'}</div>
                        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, color: p2 !== null ? pc : s.muted }}>{p2 !== null ? `${p2}%` : '—'}</div>
                      </div>
                    )
                  })}
                  {/* Totals */}
                  {(() => {
                    const tScOk = people.filter(p => statusFor(p.sc_expiry) === 'current').length
                    const tWwOk = people.filter(p => statusFor(p.wwcc_expiry) === 'current').length
                    const tScBad = people.length - tScOk, tWwBad = people.length - tWwOk
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 55px 1fr 1fr 1fr 1fr 75px', padding: '11px 16px', borderTop: `1px solid ${s.rule}`, background: s.off, alignItems: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: s.muted }}>Church Total</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800 }}>{people.length}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#1A6B35' }}>{tScOk}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: tScBad > 0 ? '#CC2222' : s.muted }}>{tScBad > 0 ? tScBad : '—'}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#1A6B35' }}>{tWwOk}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: tWwBad > 0 ? '#CC2222' : s.muted }}>{tWwBad > 0 ? tWwBad : '—'}</div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: pct === 100 ? '#22A355' : pct >= 70 ? s.black : '#CC2222' }}>{pct}%</div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })()}

          {/* Next to expire */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SectionLabel>Expiring in Next 90 Days</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 10 }}>
                {upcoming.map((u, i) => {
                  const urgent = u.days <= 30
                  const min = MINISTRIES.find(m => m.id === u.p.ministry)
                  return (
                    <div key={i} style={{ border: `1px solid ${urgent ? '#F0BBBB' : '#EDE09A'}`, padding: '14px 16px', background: urgent ? '#FEFAFA' : '#FEFDF5' }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{u.p.name}</div>
                      <div style={{ fontSize: 11, color: s.muted, marginTop: 1 }}>{min?.label}{u.p.role ? ` · ${u.p.role}` : ''}</div>
                      <div style={{ fontSize: 11, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: s.sub }}>{u.type}</span>
                        <span style={{ fontWeight: 800, color: urgent ? '#CC2222' : '#886600' }}>{u.days}d — {fmtDate(u.expiry)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <input style={{ ...inp, flex: '1 1 180px', maxWidth: 240 }} placeholder="Search by name…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            <select style={{ ...inp, flex: '1 1 160px', maxWidth: 200, cursor: 'pointer' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="issues">Has issues</option>
              <option value="missing">Missing records</option>
            </select>
          </div>

          {/* Team members table */}
          <SectionLabel>Team Members</SectionLabel>
          {filtered.length === 0 ? (
            <div style={{ border: `1px solid ${s.rule}`, padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{people.length === 0 ? 'No team members yet' : 'No results found'}</div>
              <div style={{ fontSize: 13, color: s.muted, fontFamily: "'Lora', serif", fontStyle: 'italic', marginBottom: people.length === 0 ? 24 : 0 }}>
                {people.length === 0 ? 'Add your first team member to start tracking compliance.' : 'Try adjusting your search or filters.'}
              </div>
              {people.length === 0 && <Btn variant="primary" onClick={() => setModal({ type: 'add' })}>Add first person</Btn>}
            </div>
          ) : (
            <div style={{ border: `1px solid ${s.rule}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 1fr 1fr 90px', padding: '9px 16px', background: s.off, borderBottom: `1px solid ${s.rule}`, fontSize: 9, fontWeight: 800, color: s.muted, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                <div>Name · Ministry</div><div>SC Training</div><div>SC Expiry</div><div>WWCC</div><div>WWCC Expiry</div><div>Last Reminded</div><div></div>
              </div>
              {filtered.map((p, i) => {
                const sc = statusFor(p.sc_expiry), ww = statusFor(p.wwcc_expiry)
                const min = MINISTRIES.find(m => m.id === p.ministry)
                const lastRem = (p.reminder_log || []).slice(-1)[0]
                return (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1.2fr 1fr 1fr 90px', padding: '12px 16px', borderBottom: i < filtered.length - 1 ? `1px solid ${s.ruleLight}` : 'none', alignItems: 'center', background: (sc === 'expired' || ww === 'expired') ? '#FEFAF9' : s.white }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: s.muted, marginTop: 2 }}>{min?.label}{p.role ? ` · ${p.role}` : ''}</div>
                      {p.notes && <div style={{ fontSize: 10, color: s.muted, marginTop: 3, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>📝 {p.notes}</div>}
                      {p.updated_at && <div style={{ fontSize: 9, color: '#BBB', marginTop: 2 }}>Updated {fmtDate(p.updated_at)}</div>}
                    </div>
                    <div><Badge status={sc} />{p.sc_date && <div style={{ fontSize: 10, color: s.muted, marginTop: 3 }}>Done {fmtDate(p.sc_date)}</div>}</div>
                    <div>
                      <div style={{ fontSize: 12, color: sc === 'expired' ? '#CC2222' : s.sub, fontWeight: sc === 'expired' ? 800 : 400 }}>{fmtDate(p.sc_expiry)}</div>
                      {p.sc_expiry && p.sc_expiry !== 'pending' && sc === 'expiring' && <div style={{ fontSize: 10, color: '#886600', marginTop: 2, fontWeight: 700 }}>in {daysDiff(p.sc_expiry)}d</div>}
                    </div>
                    <div><Badge status={ww} />{p.wwcc_number && <div style={{ fontSize: 10, color: s.muted, marginTop: 3 }}>{p.wwcc_number}</div>}</div>
                    <div>
                      <div style={{ fontSize: 12, color: ww === 'expired' ? '#CC2222' : s.sub, fontWeight: ww === 'expired' ? 800 : 400 }}>{fmtDate(p.wwcc_expiry)}</div>
                      {p.wwcc_expiry && p.wwcc_expiry !== 'pending' && ww === 'expiring' && <div style={{ fontSize: 10, color: '#886600', marginTop: 2, fontWeight: 700 }}>in {daysDiff(p.wwcc_expiry)}d</div>}
                    </div>
                    <div style={{ fontSize: 10, color: s.muted }}>{lastRem ? `📧 ${fmtDate(lastRem)}` : '—'}</div>
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                      <Btn size="sm" onClick={() => setModal({ type: 'edit', payload: p })}>Edit</Btn>
                      <Btn size="sm" onClick={() => setModal({ type: 'delete', payload: p })} style={{ border: '1px solid #F0BBBB', background: s.white, color: '#CC2222', fontWeight: 800 }}>×</Btn>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${s.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color: s.muted }}>Nova Church</span>
            <span style={{ fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: 11, color: s.muted }}>Ministry Compliance — Child &amp; Youth Safety</span>
          </div>
        </>}
      </div>

      {/* Modals */}
      {modal?.type === 'add' && (
        <Modal title="Add Team Member" onClose={() => setModal(null)}>
          <PersonForm onSave={savePerson} onCancel={() => setModal(null)} loading={saving} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit Team Member" subtitle={modal.payload?.name} onClose={() => setModal(null)}>
          <PersonForm initial={modal.payload} onSave={savePerson} onCancel={() => setModal(null)} loading={saving} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Remove Team Member" onClose={() => setModal(null)}>
          <p style={{ fontSize: 14, color: s.sub, fontFamily: "'Lora', serif", fontStyle: 'italic', marginBottom: 24 }}>
            Are you sure you want to remove <strong>{modal.payload?.name}</strong>? This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn onClick={() => setModal(null)}>Cancel</Btn>
            <Btn variant="danger" onClick={() => deletePerson(modal.payload?.id)}>Remove</Btn>
          </div>
        </Modal>
      )}
      {modal?.type === 'reminder' && (
        <ReminderModal people={people} leaders={leaders} onClose={() => setModal(null)} onLogReminder={logReminder} />
      )}
      {modal?.type === 'settings' && (
        <SettingsModal leaders={leaders} onSave={saveSettings} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'import' && (
        <ImportModal onImport={importPeople} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'backup' && (
        <BackupModal people={people} onRestore={restorePeople} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
