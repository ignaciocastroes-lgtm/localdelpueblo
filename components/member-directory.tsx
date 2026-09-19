'use client'

import { useState, useMemo, useRef } from 'react'
import { Search, UserCircle, Download, Upload, MessageCircle, ChevronRight, Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PinNumpad } from '@/components/pin-numpad'
import { formatCLP, parseCSVLine, sendDebtWhatsApp, type Member } from '@/lib/store'
import { toast } from 'sonner'

export function MemberDirectory({ members, onSelectMember, isAdminMode = false, adminPin = '1234', onBulkUpdateMembers, onAddMember, onUpdateMember, onDeleteMember }: any) {
  const [query, setQuery] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // PIN Pad y Acciones
  const [showPin, setShowPin] = useState(false)
  const [action, setAction] = useState<{ type: 'export' | 'import' | 'delete', id?: string }>()

  // Formularios
  const [showModal, setShowModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ id: '', name: '', rut: '', category: 'Senior', phone: '', email: '', balance: 0, creditLimit: 30000 })
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null)

  const handleAdminSuccess = () => {
    setShowPin(false)
    if (action?.type === 'export') {
      const headers = ['ID', 'Nombre', 'RUT', 'Categoria', 'Saldo', 'Telefono']
      const escapeCsv = (v: any) => `"${String(v).replace(/"/g, '""')}"`
      const rows = members.map((m: any) => [m.id, escapeCsv(m.name), m.rut, m.category, m.balance || 0, m.phone || ''].join(','))
      const csv = [headers.join(','), ...rows].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `socios.csv`; link.click()
      toast.success('Lista exportada en CSV')
    } else if (action?.type === 'import') {
      fileRef.current?.click()
    } else if (action?.type === 'delete' && action.id) {
      if (onDeleteMember) onDeleteMember(action.id)
      toast.success('Socio eliminado permanentemente')
    }
    setAction(undefined)
  }

  const handleImport = async (e: any) => {
    const file = e.target.files?.[0]; if (!file) return
    const text = await file.text(); const lines = text.split('\n').filter((l: string) => l.trim().length > 0)

    // Igual que en Stock: se actualiza por ID contra la lista actual, así
    // el CSV sirve para ajustar saldo/teléfono masivamente sin borrar
    // correo, límite de fiado ni estado activo de socios que ya existían.
    const updated = [...members]
    let creados = 0, actualizados = 0

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      if (cols.length < 5) continue

      const id = cols[0]
      const parsed = {
        name: cols[1] || 'Socio Nuevo',
        rut: cols[2] || 'Sin RUT',
        category: cols[3] || 'Senior',
        balance: Number(cols[4]) || 0,
        phone: cols[5] || '',
      }

      const existingIdx = id ? updated.findIndex((m: Member) => m.id === id) : -1
      if (existingIdx >= 0) {
        updated[existingIdx] = { ...updated[existingIdx], ...parsed }
        actualizados++
      } else {
        updated.push({
          id: id || `mem-${Date.now()}-${i}`,
          ...parsed,
          creditLimit: 30000,
          creditEnabled: true,
          isActive: true,
          joinDate: new Date().toISOString(),
        })
        creados++
      }
    }
    if ((creados + actualizados) > 0 && onBulkUpdateMembers) {
      onBulkUpdateMembers(updated)
      toast.success(`Socios sincronizados: ${actualizados} actualizados, ${creados} nuevos`)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const openNew = () => { setForm({ id: '', name: '', rut: '', category: 'Senior', phone: '', email: '', balance: 0, creditLimit: 30000 }); setEditMode(false); setShowModal(true) }
  const openEdit = (e: any, m: Member) => { e.stopPropagation(); setForm({ id: m.id, name: m.name, rut: m.rut, category: m.category, phone: m.phone || '', email: m.email || '', balance: m.balance || 0, creditLimit: Number(m.creditLimit) || 30000 }); setEditMode(true); setShowModal(true) }

  const handleCobrarWhatsApp = async (m: Member) => {
    if (!m.phone) { toast.error('Este socio no tiene WhatsApp cargado. Edítalo para agregarlo.'); return }
    setSendingWhatsApp(m.id)
    const result = await sendDebtWhatsApp(m)
    if (!result.ok) toast.error(result.error || 'No se pudo enviar el mensaje')
    setSendingWhatsApp(null)
  }

  const handleSave = () => {
    if (!form.name) { toast.error('El nombre es requerido'); return }
    const safeData = { ...form, balance: Number(form.balance) || 0, creditLimit: Number(form.creditLimit) || 30000 }
    if (editMode) {
      if (onUpdateMember) onUpdateMember(safeData); toast.success('Socio actualizado')
    } else {
      if (onAddMember) onAddMember({ ...safeData, id: `mem-${Date.now()}`, creditEnabled: true, isActive: true, joinDate: new Date().toISOString() }); toast.success('Socio creado')
    }
    setShowModal(false)
  }

  const filtered = useMemo(() => members.filter((m: Member) => m.name.toLowerCase().includes(query.toLowerCase()) || m.rut.includes(query)), [members, query])

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900 border-orange-500/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-orange-500 flex items-center gap-2"><UserCircle /> DIRECTORIO</CardTitle>
          <div className="flex gap-2">
            {isAdminMode && (
              <>
                <Button variant="outline" size="sm" onClick={() => { setAction({ type: 'export' }); setShowPin(true); }} className="text-slate-300 border-slate-700 hover:bg-slate-800"><Download className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => { setAction({ type: 'import' }); setShowPin(true); }} className="text-slate-300 border-slate-700 hover:bg-slate-800"><Upload className="w-4 h-4" /></Button>
              </>
            )}
            <Button size="sm" className="bg-orange-500 text-white hover:bg-orange-600" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nuevo</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Buscar por nombre o RUT..." value={query} onChange={(e) => setQuery(e.target.value)} className="bg-slate-800 border-slate-700 text-white" />
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader><TableRow className="border-slate-800"><TableHead>Socio</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.map((m: Member) => (
                  <TableRow key={m.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell onClick={() => onSelectMember(m)} className="cursor-pointer">
                      <p className="font-bold text-white uppercase">{m.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{m.rut}</p>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${m.balance < 0 ? 'text-red-500' : 'text-green-500'}`}>{formatCLP(m.balance)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isAdminMode && (
                          <>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-500/20 h-8 w-8" onClick={(e) => { e.stopPropagation(); setAction({ type: 'delete', id: m.id }); setShowPin(true); }}><Trash2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-orange-400 hover:bg-orange-400/20 h-8 w-8" onClick={(e) => openEdit(e, m)}><Edit className="w-4 h-4" /></Button>
                          </>
                        )}
                        {m.phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-green-500 h-8 w-8"
                            disabled={sendingWhatsApp === m.id}
                            onClick={(e) => { e.stopPropagation(); handleCobrarWhatsApp(m) }}
                            title="Cobrar por WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="text-slate-400 h-8 w-8" onClick={() => onSelectMember(m)} title="Ver ficha"><ChevronRight className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white w-[90%] max-w-md rounded-xl p-6">
          <DialogHeader><DialogTitle className="text-orange-500 text-xl font-bold">{editMode ? 'Editar Socio' : 'Nuevo Socio'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><label className="text-xs text-slate-400 mb-1 block">Nombre</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-11" placeholder="Ej: Juan Pérez" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-slate-400 mb-1 block">RUT</label><Input value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-11" placeholder="12.345.678-9" /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Categoría</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full h-11 rounded-md border border-slate-700 bg-slate-800 px-3 text-white text-sm">{['Sub-8', 'Sub-10', 'Sub-12', 'Sub-14', 'Sub-16', 'Juvenil', 'Senior', 'Staff'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-slate-400 mb-1 block">WhatsApp</label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-11" placeholder="+569..." /></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Correo (opcional)</label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-slate-800 border-slate-700 text-white h-11" placeholder="socio@correo.cl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-slate-400 mb-1 block">Límite Fiado</label><Input type="number" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: Number(e.target.value) })} className="bg-slate-800 border-slate-700 text-white h-11" /></div>
            </div>
            {editMode && isAdminMode && (
              <div className="bg-slate-800 p-3 rounded-md border border-slate-700">
                <label className="text-xs text-slate-400 mb-1 block">Saldo Actual (Negativo = Deuda del socio)</label>
                <Input type="number" value={form.balance} onChange={e => setForm({ ...form, balance: Number(e.target.value) })} className="bg-slate-900 border-slate-600 text-white h-11 font-bold text-orange-400" />
              </div>
            )}
            <Button className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold mt-2" onClick={handleSave}>{editMode ? 'GUARDAR CAMBIOS' : 'CREAR SOCIO'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      <PinNumpad open={showPin} correctPin={adminPin} onClose={() => { setShowPin(false); setAction(undefined); }} onSuccess={handleAdminSuccess} title={action?.type === 'delete' ? 'PIN PARA BORRAR' : 'Acceso Admin'} />
    </div>
  )
}