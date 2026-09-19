'use client'

import { useState, useRef } from 'react'
import { FileSpreadsheet, Upload, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCLP, type Member, type MemberCategory } from '@/lib/store'

interface ExcelImportProps {
  open: boolean
  onClose: () => void
  onImport: (members: Partial<Member>[]) => void
}

interface PreviewMember {
  name: string
  rut: string
  category: MemberCategory
  initialDebt: number
  valid: boolean
  error?: string
}

// Simulated column mapping
const EXPECTED_COLUMNS = ['Nombre', 'RUT', 'Categoría', 'Deuda Inicial']

export function ExcelImport({ open, onClose, onImport }: ExcelImportProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload')
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<PreviewMember[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    
    // Simulate parsing Excel file
    // In real implementation, use a library like xlsx or papaparse
    await new Promise(resolve => setTimeout(resolve, 800))

    // Generate simulated preview data
    const simulatedData: PreviewMember[] = [
      { name: 'Roberto Gómez Bolaños', rut: '8.765.432-1', category: 'Senior', initialDebt: 15000, valid: true },
      { name: 'Florinda Meza', rut: '9.876.543-2', category: 'Staff', initialDebt: 0, valid: true },
      { name: 'Carlos Villagrán', rut: '10.987.654-3', category: 'Senior', initialDebt: 8500, valid: true },
      { name: 'Ramón Valdés', rut: '11.098.765-4', category: 'Juvenil', initialDebt: 22000, valid: true },
      { name: 'María Antonieta', rut: '12.109.876-5', category: 'Sub-14', initialDebt: 5000, valid: true },
      { name: 'Edgar Vivar', rut: '13.210.987-6', category: 'Senior', initialDebt: 0, valid: true },
      { name: 'Angelines Fernández', rut: 'INVALID-RUT', category: 'Senior', initialDebt: 3000, valid: false, error: 'RUT inválido' },
      { name: 'Rubén Aguirre', rut: '14.321.098-7', category: 'Staff', initialDebt: 12000, valid: true },
    ]

    setPreviewData(simulatedData)
    setStep('preview')
  }

  const handleImport = async () => {
    setStep('importing')
    const validMembers = previewData.filter(m => m.valid)
    
    // Simulate import progress
    for (let i = 0; i <= validMembers.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300))
      setImportProgress((i / validMembers.length) * 100)
      setImportedCount(i)
    }

    // Convert to Member format
    const newMembers: Partial<Member>[] = validMembers.map((m, index) => ({
      id: `imported-${Date.now()}-${index}`,
      name: m.name,
      rut: m.rut,
      category: m.category,
      balance: -m.initialDebt,
      creditLimit: 30000,
      joinDate: new Date().toISOString().split('T')[0],
      creditEnabled: true,
      isActive: true,
    }))

    onImport(newMembers)
    setStep('complete')
  }

  const handleReset = () => {
    setStep('upload')
    setFileName(null)
    setPreviewData([])
    setImportProgress(0)
    setImportedCount(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const validCount = previewData.filter(m => m.valid).length
  const invalidCount = previewData.filter(m => !m.valid).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Socios desde Excel
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Selecciona un archivo .xlsx con las columnas: Nombre, RUT, Categoría, Deuda Inicial'}
            {step === 'preview' && 'Revisa los datos antes de importar. Los registros inválidos no serán importados.'}
            {step === 'importing' && 'Importando socios al sistema...'}
            {step === 'complete' && 'Importación completada exitosamente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Upload Step */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center py-12">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div 
                className="w-full max-w-md border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Arrastra tu archivo aquí</p>
                <p className="text-sm text-muted-foreground mb-4">o haz click para seleccionar</p>
                <Badge variant="outline" className="text-xs">
                  Formatos: .xlsx, .xls, .csv
                </Badge>
              </div>

              <div className="mt-8 text-sm text-muted-foreground">
                <p className="font-medium mb-2">Columnas esperadas:</p>
                <div className="flex gap-2 flex-wrap justify-center">
                  {EXPECTED_COLUMNS.map(col => (
                    <Badge key={col} variant="secondary">{col}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-success text-success-foreground">{validCount} válidos</Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive">{invalidCount} con errores</Badge>
                  )}
                </div>
              </div>

              {invalidCount > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {invalidCount} registro(s) tienen errores y no serán importados.
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Estado</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>RUT</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Deuda Inicial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((member, index) => (
                      <TableRow key={index} className={!member.valid ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          {member.valid ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <div className="flex items-center gap-1">
                              <X className="w-4 h-4 text-destructive" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            {member.error && (
                              <p className="text-xs text-destructive">{member.error}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{member.rut}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{member.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {member.initialDebt > 0 ? (
                            <span className="text-destructive font-medium">
                              {formatCLP(-member.initialDebt)}
                            </span>
                          ) : (
                            <span className="text-success">$0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Importing Step */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium mb-2">Importando socios...</p>
              <p className="text-sm text-muted-foreground mb-6">
                {importedCount} de {validCount} registros
              </p>
              <div className="w-full max-w-md">
                <Progress value={importProgress} className="h-2" />
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-medium mb-2">Importación Completada</p>
              <p className="text-sm text-muted-foreground">
                Se importaron {validCount} socios exitosamente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Volver
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Importar {validCount} Socios
              </Button>
            </>
          )}
          
          {step === 'complete' && (
            <Button onClick={handleClose}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
