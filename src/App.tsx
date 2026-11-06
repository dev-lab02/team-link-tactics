import basketballImage from './assets/basketball.png'
import courtFullImage from './assets/court-full.png'
import courtHalfImage from './assets/court-half.png'
import { useEffect, useRef, useState } from 'react'
import { CircleDot, Circle, Download, Eraser, Hand, MousePointer2, Pencil, RotateCcw, Save, Trash2, Triangle, Undo2, Redo2 } from 'lucide-react'

type Point = { x: number; y: number }
type Player = Point & { id: string; side: 'red' | 'blue'; number: number }
type Marker = Point & { id: string; type: 'cone' | 'flat'; color: string }
type Stroke = { id: string; points: Point[]; color: string; width: number }
type Board = { players: Player[]; markers: Marker[]; strokes: Stroke[]; ball: Point; ballHolderId?: string | null }
type Tool = 'select' | 'ball' | 'pen' | 'eraser' | 'cone' | 'flat'
type Court = 'full' | 'half'
const KEY = 'team-link-tactics-v1'
const uid = () => Math.random().toString(36).slice(2, 10)
const initial = (): Board => ({
  players: [
    ...Array.from({ length: 5 }, (_, i): Player => ({ id: `red-${i}`, side: 'red', number: i + 1, x: 260 + (i % 3) * 90, y: 185 + Math.floor(i / 3) * 160 })),
    ...Array.from({ length: 5 }, (_, i): Player => ({ id: `blue-${i}`, side: 'blue', number: i + 1, x: 600 + (i % 3) * 90, y: 185 + Math.floor(i / 3) * 160 })),
  ], markers: [], strokes: [], ball: { x: 500, y: 250 }, ballHolderId: null,
})
const load = (): Board => {
  try {
    const v = localStorage.getItem(KEY)
    if (v) {
      const data: unknown = JSON.parse(v)
      if (data && typeof data === 'object' && 'players' in data && 'markers' in data && 'strokes' in data) {
        const b = data as Board
        if (Array.isArray(b.players) && Array.isArray(b.markers) && Array.isArray(b.strokes)) return { ...b, ball: b.ball && Number.isFinite(b.ball.x) && Number.isFinite(b.ball.y) ? b.ball : { x: 500, y: 250 }, ballHolderId: null }
      }
    }
  } catch { /* ignore corrupt saved state */ }
  return initial()
}
const clone = (b: Board): Board => JSON.parse(JSON.stringify(b)) as Board
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const formatPoints = (points: Point[]) => points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

function MarkerShape({ marker }: { marker: Marker }) {
  if (marker.type === 'cone') return <g transform={`translate(${marker.x} ${marker.y})`}>
    <ellipse cy="15" rx="20" ry="6" fill="#1f2937" opacity=".22" />
    <path d="M0 -23 L-17 13 Q0 19 17 13 Z" fill={marker.color} stroke="white" strokeWidth="2" />
    <path d="M-8 -4 H8 L12 5 H-12 Z" fill="#fff" opacity=".82" />
    <rect x="-20" y="12" width="40" height="8" rx="3" fill={marker.color} stroke="white" strokeWidth="2" />
  </g>
  return <g transform={`translate(${marker.x} ${marker.y})`}>
    <ellipse cy="4" rx="19" ry="9" fill="#0f172a" opacity=".3" />
    <ellipse rx="20" ry="12" fill={marker.color} stroke="white" strokeWidth="2" />
    <ellipse rx="11" ry="5" fill="none" stroke="white" strokeWidth="2" opacity=".75" />
  </g>
}

export default function App() {
  const [board, setBoard] = useState<Board>(load)
  const [past, setPast] = useState<Board[]>([])
  const [future, setFuture] = useState<Board[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [court, setCourt] = useState<Court>('full')
  const [penColor, setPenColor] = useState('#facc15')
  const [markerColor, setMarkerColor] = useState('#f97316')
  const [penWidth, setPenWidth] = useState(4)
  const [draft, setDraft] = useState<Stroke | null>(null)
  const [message, setMessage] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)
  const boardRef = useRef(board)
  const dragRef = useRef<{ id: string; kind: 'player' | 'marker' | 'ball'; start: Board; moved: boolean } | null>(null)
  const drawRef = useRef<{ start: Board; stroke: Stroke } | null>(null)
  const eraseRef = useRef<Board | null>(null)
  useEffect(() => { boardRef.current = board; localStorage.setItem(KEY, JSON.stringify(board)) }, [board])
  const commit = (next: Board, prev = boardRef.current) => {
    setPast(p => [...p.slice(-49), clone(prev)])
    setFuture([])
    boardRef.current = next
    setBoard(next)
  }
  const getPoint = (event: React.PointerEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current
    if (!svg) return null
    const matrix = svg.getScreenCTM()
    if (!matrix) return null
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: clamp(p.x, 40, 960), y: clamp(p.y, 40, court === 'full' ? 460 : 710) }
  }
  const hit = (p: Point): { id: string; kind: 'player' | 'marker' | 'ball' } | null => {
    if (Math.hypot(boardRef.current.ball.x - p.x, boardRef.current.ball.y - p.y) < 29) return { id: 'basketball', kind: 'ball' }
    const players = [...boardRef.current.players].reverse()
    const player = players.find(v => Math.hypot(v.x - p.x, v.y - p.y) < 24)
    if (player) return { id: player.id, kind: 'player' }
    const marker = [...boardRef.current.markers].reverse().find(v => Math.hypot(v.x - p.x, v.y - p.y) < 26)
    return marker ? { id: marker.id, kind: 'marker' } : null
  }
  const eraseAt = (p: Point) => {
    const current = boardRef.current
    const target = [...current.markers].reverse().find(v => Math.hypot(v.x - p.x, v.y - p.y) < 27)
    if (target) { setBoard({ ...current, markers: current.markers.filter(v => v.id !== target.id) }); return }
    const stroke = [...current.strokes].reverse().find(s => s.points.some(v => Math.hypot(v.x - p.x, v.y - p.y) < 17))
    if (stroke) setBoard({ ...current, strokes: current.strokes.filter(v => v.id !== stroke.id) })
  }
  const pointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const p = getPoint(e)
    if (!p) return
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'select') {
      const target = hit(p)
      if (target) dragRef.current = { ...target, start: clone(boardRef.current), moved: false }
    } else if (tool === 'ball') {
      commit({ ...boardRef.current, ball: p, ballHolderId: null })
      setTool('select')
    } else if (tool === 'pen') {
      const stroke = { id: uid(), points: [p], color: penColor, width: penWidth }
      drawRef.current = { start: clone(boardRef.current), stroke }
      setDraft(stroke)
    } else if (tool === 'eraser') {
      eraseRef.current = clone(boardRef.current)
      eraseAt(p)
    } else if (tool === 'cone' || tool === 'flat') {
      commit({ ...boardRef.current, markers: [...boardRef.current.markers, { id: uid(), x: p.x, y: p.y, type: tool, color: markerColor }] })
      setTool('select')
    }
  }
  const pointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = getPoint(e)
    if (!p) return
    if (dragRef.current) {
      const drag = dragRef.current
      drag.moved = true
      const b = boardRef.current
      if (drag.kind === 'ball') setBoard({ ...b, ball: p })
      else if (drag.kind === 'player') setBoard({ ...b, players: b.players.map(v => v.id === drag.id ? { ...v, ...p } : v) })
      else setBoard({ ...b, markers: b.markers.map(v => v.id === drag.id ? { ...v, ...p } : v) })
    } else if (drawRef.current) {
      const s = drawRef.current.stroke
      const last = s.points[s.points.length - 1]
      if (Math.hypot(last.x - p.x, last.y - p.y) > 2) {
        const next = { ...s, points: [...s.points, p] }
        drawRef.current.stroke = next
        setDraft(next)
      }
    } else if (eraseRef.current) eraseAt(p)
  }
  const pointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (dragRef.current) {
      const drag = dragRef.current
      dragRef.current = null
      if (drag.moved) commit(boardRef.current, drag.start)
    }
    if (drawRef.current) {
      const d = drawRef.current
      drawRef.current = null
      setDraft(null)
      if (d.stroke.points.length > 1) commit({ ...boardRef.current, strokes: [...boardRef.current.strokes, d.stroke] }, d.start)
    }
    if (eraseRef.current) {
      const before = eraseRef.current
      eraseRef.current = null
      if (JSON.stringify(before) !== JSON.stringify(boardRef.current)) commit(boardRef.current, before)
    }
  }
  const undo = () => {
    if (!past.length) return
    const prev = past[past.length - 1]
    setPast(p => p.slice(0, -1))
    setFuture(f => [...f, clone(boardRef.current)])
    boardRef.current = prev
    setBoard(prev)
  }
  const redo = () => {
    if (!future.length) return
    const next = future[future.length - 1]
    setFuture(f => f.slice(0, -1))
    setPast(p => [...p, clone(boardRef.current)])
    boardRef.current = next
    setBoard(next)
  }
  const reset = () => { if (confirm('駒の位置・描画・マーカーを初期状態に戻しますか？')) commit(initial()) }
  const clearDrawings = () => {
    if (board.strokes.length || board.markers.length) commit({ ...board, strokes: [], markers: [] })
  }
  const exportSvg = async () => {
    const svg = svgRef.current
    if (!svg) return
    const copy = svg.cloneNode(true) as SVGSVGElement
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    // SVGを単独で開いても背景画像が消えないよう、画像を埋め込む。
    const background = copy.querySelector('#court-background')
    if (background) {
      try {
        const response = await fetch(court === 'full' ? courtFullImage : courtHalfImage)
        if (!response.ok) throw new Error('コート画像を取得できません')
        const blob = await response.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
          reader.readAsDataURL(blob)
        })
        background.setAttribute('href', dataUrl)
      } catch {
        alert('コート画像を埋め込めなかったため、画像保存を中止しました')
        return
      }
    }
    const ballImage = copy.querySelector('#basketball-image')
    if (ballImage) {
      try {
        const response = await fetch(basketballImage)
        if (!response.ok) throw new Error('ボール画像を取得できません')
        const blob = await response.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
          reader.readAsDataURL(blob)
        })
        ballImage.setAttribute('href', dataUrl)
      } catch {
        alert('ボール画像を埋め込めなかったため、画像保存を中止しました')
        return
      }
    }
    copy.setAttribute('width', '1600')
    copy.setAttribute('height', court === 'full' ? '800' : '1200')
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'TEAM_LINK_戦術ボード.svg'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const saveJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, court, board }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'TEAM_LINK_戦術ボード_バックアップ.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('バックアップを保存しました')
  }
  const restore = async (file?: File) => {
    if (!file) return
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!data || typeof data !== 'object' || !('board' in data)) throw new Error('形式が異なります')
      const b = (data as { board: Board; court?: Court }).board
      if (!Array.isArray(b.players) || !Array.isArray(b.markers) || !Array.isArray(b.strokes)) throw new Error('データが不正です')
      if (!confirm('現在のボードを読み込んだデータで置き換えますか？')) return
      commit({ ...b, ball: b.ball && Number.isFinite(b.ball.x) && Number.isFinite(b.ball.y) ? b.ball : { x: 500, y: 250 }, ballHolderId: null })
      const c = (data as { court?: Court }).court
      if (c === 'full' || c === 'half') setCourt(c)
      setMessage('バックアップを読み込みました')
    } catch { alert('バックアップファイルを読み込めませんでした') }
  }
  return <div className="app">
    <header className="header"><div className="brand"><span className="brand-icon">TL</span><div><small>TEAM LINK</small><strong>戦術ボード</strong></div></div><span className="header-note">BASKETBALL TACTICS</span></header>
    <main className="main">
      <div className="title-row"><div><span className="eyebrow">TACTICS BOARD</span><h1>戦術ボード</h1><p>選手をドラッグして配置。ペンで動きを描き、コーンやマーカーを置けます。</p></div><div className="top-actions"><button onClick={undo} disabled={!past.length}><Undo2 size={17}/>戻す</button><button onClick={redo} disabled={!future.length}><Redo2 size={17}/>進む</button><button onClick={() => { void exportSvg() }}><Download size={17}/>画像保存</button></div></div>
      <section className="workspace">
        <div className="board-area">
          <div className="board-bar"><div className="court-toggle"><button className={court === 'full' ? 'chosen' : ''} onClick={() => setCourt('full')}>フルコート</button><button className={court === 'half' ? 'chosen' : ''} onClick={() => setCourt('half')}>ハーフコート</button></div><div className="board-hint"><Hand size={15}/>{tool === 'select' ? '駒・マーカーをドラッグ' : tool === 'pen' ? '指でなぞって描画' : tool === 'eraser' ? '線・マーカーをなぞって削除' : tool === 'ball' ? 'コートをタップしてボールを配置' : 'コートをタップして配置'}</div></div>
          <div className={`court-container tool-${tool}`}><svg ref={svgRef} viewBox={court === 'full' ? '0 0 1000 500' : '0 0 1000 750'} xmlns="http://www.w3.org/2000/svg" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
            <image id="court-background" href={court === 'full' ? courtFullImage : courtHalfImage} x="0" y="0" width="1000" height={court === 'full' ? 500 : 750} preserveAspectRatio="none" />
            {board.strokes.map(s => <polyline key={s.id} points={formatPoints(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
            {draft && <polyline points={formatPoints(draft.points)} stroke={draft.color} strokeWidth={draft.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {board.markers.map(m => <MarkerShape key={m.id} marker={m} />)}
            {board.players.map(p => <g key={p.id} transform={`translate(${p.x} ${p.y})`}>
              <circle cy="3" r="22" fill="#0f172a" opacity=".25"/>
              <circle r="21" fill={p.side === 'red' ? '#e33e4c' : '#2563eb'} stroke="#fff" strokeWidth="3"/>
              <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="20" fontWeight="800" fontFamily="Arial, sans-serif">{p.number}</text>
            </g>)}
            {/* 選手駒とは別に、常に表示される移動可能なバスケットボール */}
            <g transform={`translate(${board.ball.x} ${board.ball.y})`}>
              <image id="basketball-image" href={basketballImage} x="-18" y="-18" width="36" height="36" preserveAspectRatio="xMidYMid meet" />
            </g>
          </svg></div>
          <div className="board-bottom"><span><i className="legend red"/>赤チーム 5人 <i className="legend blue"/>青チーム 5人</span><span>自動保存中 <Save size={14}/></span></div>
        </div>
        <aside className="toolbar"><div className="tool-title">操作ツール</div>
          <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}><MousePointer2 size={19}/>駒を動かす</button>
          <button className={tool === 'ball' ? 'active' : ''} onClick={() => setTool('ball')}><Circle size={19}/>ボールを置く・移動</button>
          <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')}><Pencil size={19}/>線を描く</button>
          <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')}><Eraser size={19}/>消しゴム</button>
          <div className="tool-divider" />
          <button className={tool === 'cone' ? 'active' : ''} onClick={() => setTool('cone')}><Triangle size={19}/>三角コーン</button>
          <button className={tool === 'flat' ? 'active' : ''} onClick={() => setTool('flat')}><CircleDot size={19}/>フラットマーカー</button>
          <div className="tool-divider" />
          <div className="tool-title">線の色</div><div className="colors">{['#facc15', '#ffffff', '#fb7185', '#60a5fa', '#34d399', '#0f172a'].map(c => <button key={c} title={c} className={`color ${penColor === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => { setPenColor(c); setTool('pen') }} />)}</div>
          <div className="tool-title">線の太さ</div><div className="widths">{[3, 5, 8].map(w => <button key={w} className={penWidth === w ? 'selected' : ''} onClick={() => setPenWidth(w)}><span style={{ height: w }} /></button>)}</div>
          <div className="tool-title">マーカーの色</div><div className="colors">{['#f97316', '#facc15', '#22c55e', '#38bdf8', '#ef4444'].map(c => <button key={c} title={c} className={`color ${markerColor === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setMarkerColor(c)} />)}</div>
        </aside>
      </section>
      <div className="bottom-actions"><button onClick={clearDrawings}><Trash2 size={17}/>線・マーカーを全消去</button><button onClick={reset}><RotateCcw size={17}/>ボードを初期化</button><button onClick={saveJson}><Save size={17}/>バックアップ保存</button><label className="upload-button"><Download size={17}/>バックアップ読込<input type="file" accept="application/json,.json" onChange={e => { void restore(e.target.files?.[0]); e.target.value = '' }} /></label></div>
      <div className="help"><div><strong>使い方</strong><p>「駒を動かす」で赤・青の駒や配置済みの道具を移動できます。オレンジ色のボールは最初からコート中央に表示されます。「駒を動かす」でボールもドラッグできます。「ボールを置く・移動」を選ぶとタップした位置にボールを配置できます。「線を描く」で指やマウスで自由に描画できます。コーン・マーカーはツールを選んでコートをタップすると追加されます。</p></div><div><strong>保存について</strong><p>ボードはこの端末のブラウザに自動保存されます。端末変更やブラウザデータ削除に備えて、JSONバックアップも保存してください。画像保存はSVG形式です。</p></div></div>
      {message && <div className="toast" role="status" onClick={() => setMessage('')}>{message} ×</div>}
    </main>
  </div>
}
