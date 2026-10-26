import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, Loader2, RefreshCw, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  SETORES_FISICOS,
  fmtQtd,
  listarMovimentos,
  listarUsuariosQueMovimentaram,
  msgErro,
  numeroMov,
  type Movimento,
} from '@/services/movimentacao'

// SPEC-224: histórico de todas as movimentações — quem, quando, peça, quantidade, de onde, para onde e motivo.

const TODOS = '__todos__'
const SETORES_FILTRO = [...SETORES_FISICOS, 'Reserva', 'Entrega Futura', 'Separação', 'Baixa (peça faltando)']

const dataHora = (v: string) =>
  new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function baixarCsv(linhas: Movimento[]) {
  const cab = ['Número', 'Data', 'Quem', 'Código', 'Referência', 'Peça', 'Quantidade', 'Tipo', 'De', 'Para',
    'Venda', 'Cliente', 'L', 'Motivo', 'Origem antes', 'Origem depois', 'Destino antes', 'Destino depois']
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const num = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','))
  const corpo = linhas.map((m) =>
    [numeroMov(m.numero), dataHora(m.criado_em), m.usuario_nome, m.codigo_produto, m.referencia, m.produto,
      num(m.quantidade), m.tipo === 'setor' ? 'Setor' : 'Venda', m.origem, m.destino, m.venda, m.cliente, m.l_fixo,
      m.motivo, num(m.saldo_origem_antes), num(m.saldo_origem_depois), num(m.saldo_destino_antes),
      num(m.saldo_destino_depois)].map(esc).join(';'),
  )
  const blob = new Blob(['﻿' + [cab.join(';'), ...corpo].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Movimentacoes_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function HistoricoPage() {
  const [params, setParams] = useSearchParams()
  const pecaFiltro = params.get('peca')
  const [linhas, setLinhas] = useState<Movimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([])
  const [usuarioId, setUsuarioId] = useState(TODOS)
  const [setor, setSetor] = useState(TODOS)
  const [tipo, setTipo] = useState(TODOS)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [texto, setTexto] = useState('')

  async function carregar() {
    setCarregando(true)
    try {
      setLinhas(
        await listarMovimentos({
          produtoId: pecaFiltro,
          usuarioId: usuarioId === TODOS ? null : usuarioId,
          setor: setor === TODOS ? null : setor,
          tipo: tipo === TODOS ? null : (tipo as 'setor' | 'venda'),
          de: de || null,
          ate: ate || null,
        }),
      )
    } catch (err) {
      toast.error('Erro ao carregar o histórico', { description: msgErro(err) })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pecaFiltro, usuarioId, setor, tipo, de, ate])

  useEffect(() => {
    listarUsuariosQueMovimentaram()
      .then(setUsuarios)
      .catch(() => setUsuarios([]))
  }, [])

  const visiveis = useMemo(() => {
    const t = texto.trim().toLowerCase()
    if (!t) return linhas
    return linhas.filter((m) =>
      [m.codigo_produto, m.referencia, m.produto, m.motivo, m.venda, m.cliente, numeroMov(m.numero)]
        .map((x) => String(x ?? '').toLowerCase())
        .some((x) => x.includes(t)),
    )
  }, [linhas, texto])

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
        <div className="space-y-1 lg:col-span-2">
          <Label className="text-xs">Buscar (peça, código, motivo, venda, cliente)</Label>
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quem</Label>
          <Select value={usuarioId} onValueChange={setUsuarioId}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Setor (de ou para)</Label>
          <Select value={setor} onValueChange={setSetor}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {SETORES_FILTRO.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              <SelectItem value="setor">Setor físico</SelectItem>
              <SelectItem value="venda">Venda</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 lg:col-span-5 justify-end">
          {pecaFiltro && (
            <Button variant="outline" size="sm" onClick={() => setParams({})}>
              <X className="w-4 h-4 mr-1" /> Tirar filtro da peça
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => baixarCsv(visiveis)} disabled={visiveis.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Exportar (Excel)
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
        <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
          {carregando ? 'Carregando...' : `${visiveis.length} movimento(s)`}
        </div>
        <Table className="min-w-[1100px]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-xs">Número</TableHead>
              <TableHead className="text-xs">Data</TableHead>
              <TableHead className="text-xs">Quem</TableHead>
              <TableHead className="text-xs">Peça</TableHead>
              <TableHead className="text-xs text-right">Qtd</TableHead>
              <TableHead className="text-xs">De → Para</TableHead>
              <TableHead className="text-xs">Venda / L</TableHead>
              <TableHead className="text-xs">Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
                </TableCell>
              </TableRow>
            ) : visiveis.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-400">
                  Nenhuma movimentação com estes filtros.
                </TableCell>
              </TableRow>
            ) : (
              visiveis.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{numeroMov(m.numero)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{dataHora(m.criado_em)}</TableCell>
                  <TableCell className="text-sm">{m.usuario_nome ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    <span className="font-mono text-xs text-primary mr-1">{m.codigo_produto}</span>
                    {m.produto}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtQtd(m.quantidade)}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {m.origem} → {m.destino}
                    <span className="block text-[11px] text-slate-500">
                      {fmtQtd(m.saldo_origem_antes)}→{fmtQtd(m.saldo_origem_depois)} ·{' '}
                      {fmtQtd(m.saldo_destino_antes)}→{fmtQtd(m.saldo_destino_depois)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.venda ? (
                      <>
                        {m.venda} · <span className="font-mono">{m.l_fixo}</span>
                        <span className="block text-slate-500">{m.cliente}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-[320px]">{m.motivo}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
