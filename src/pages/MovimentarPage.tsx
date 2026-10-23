import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  ACOES_VENDA,
  CAMPO_SETOR_VENDA,
  DESTINOS_VENDA,
  SETORES_FISICOS,
  SETORES_VENDA,
  ehSetorVenda,
  buscarPecas,
  fmtQtd,
  getSetoresDaPeca,
  listarMovimentos,
  moverSetor,
  moverVenda,
  msgErro,
  numeroMov,
  type AcaoVenda,
  type Movimento,
  type PecaBusca,
  type Setor,
  type SetorFisico,
  type SetoresDaPeca,
  type VendaDaPeca,
} from '@/services/movimentacao'

// SPEC-224: busca a peça, mostra quanto tem em cada setor e os L de venda, e move (setor físico ou de venda).
// Sem aprovação: o banco confere saldo, peça livre e motivo, e grava o movimento com o login de quem fez.

const lerQtd = (v: string) => parseFloat(v.replace(',', '.')) || 0
const LOTE = 100
const dataHora = (v: string) =>
  new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function MovimentarPage() {
  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<PecaBusca[]>([])
  // Busca vazia = todas as peças com estoque positivo (~2 mil): mostra aos poucos conforme rola
  const [visiveis, setVisiveis] = useState(LOTE)
  const [pecaId, setPecaId] = useState<string | null>(null)
  const [dados, setDados] = useState<SetoresDaPeca | null>(null)
  const [ultimos, setUltimos] = useState<Movimento[]>([])

  const [origem, setOrigem] = useState<Setor | ''>('')
  const [destino, setDestino] = useState<Setor | ''>('')
  // Origem de venda (Reserva / Entrega Futura / Separação): de qual L sai
  const [lOrigem, setLOrigem] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [vendaSel, setVendaSel] = useState<VendaDaPeca | null>(null)
  const [acao, setAcao] = useState<AcaoVenda>('reserva_para_entrega_futura')
  const [qtdVenda, setQtdVenda] = useState('')
  const [motivoVenda, setMotivoVenda] = useState('')

  useEffect(() => {
    const t = setTimeout(
      async () => {
        setBuscando(true)
        try {
          setResultados(await buscarPecas(busca))
          setVisiveis(LOTE)
        } catch (err) {
          toast.error('Erro na busca', { description: msgErro(err) })
        } finally {
          setBuscando(false)
        }
      },
      busca.trim() ? 350 : 0,
    )
    return () => clearTimeout(t)
  }, [busca])

  const carregarPeca = useCallback(async (id: string) => {
    try {
      const [d, m] = await Promise.all([getSetoresDaPeca(id), listarMovimentos({ produtoId: id })])
      setDados(d)
      setUltimos(m.slice(0, 10))
    } catch (err) {
      toast.error('Erro ao abrir a peça', { description: msgErro(err) })
    }
  }, [])

  useEffect(() => {
    setDados(null)
    setUltimos([])
    if (pecaId) void carregarPeca(pecaId)
  }, [pecaId, carregarPeca])

  const saldoDe = (s: string) =>
    ehSetorVenda(s)
      ? (dados?.vendas ?? []).reduce((t, v) => t + v[CAMPO_SETOR_VENDA[s]], 0)
      : (dados?.setores.find((x) => x.setor === s)?.quantidade ?? 0)
  const origemVenda = !!origem && ehSetorVenda(origem)
  const lsDaOrigem = origemVenda
    ? (dados?.vendas ?? []).filter((v) => v[CAMPO_SETOR_VENDA[origem as keyof typeof CAMPO_SETOR_VENDA]] > 0)
    : []
  const lEscolhido = lsDaOrigem.find((v) => v.projeto_item_id === lOrigem) ?? null
  const destinosPossiveis: Setor[] = !origem
    ? []
    : origemVenda
      ? DESTINOS_VENDA[origem as keyof typeof DESTINOS_VENDA].map((d) => d.destino)
      : SETORES_FISICOS.filter((s) => s !== origem)
  const passoVenda = origemVenda
    ? DESTINOS_VENDA[origem as keyof typeof DESTINOS_VENDA].find((d) => d.destino === destino)
    : undefined
  const q = lerQtd(quantidade)
  const limiteOrigem = !origem
    ? 0
    : origemVenda
      ? lEscolhido
        ? lEscolhido[CAMPO_SETOR_VENDA[origem as keyof typeof CAMPO_SETOR_VENDA]]
        : 0
      : origem === 'Estoque Geral'
        ? Math.min(saldoDe(origem), dados?.livre_estoque_geral ?? 0)
        : saldoDe(origem)
  const showroomFracionado = (origem === 'Showroom' || destino === 'Showroom') && q !== Math.trunc(q)
  const podeMover =
    !!pecaId && !!origem && !!destino && origem !== destino && destinosPossiveis.includes(destino) &&
    (!origemVenda || (!!lEscolhido && !!passoVenda)) && q > 0 && q <= limiteOrigem + 0.0001 &&
    !showroomFracionado && !!motivo.trim() && !salvando

  function escolherOrigem(o: Setor) {
    setOrigem(o)
    setLOrigem('')
    setDestino(ehSetorVenda(o) ? DESTINOS_VENDA[o][0].destino : destino && destino !== o && !ehSetorVenda(destino) ? destino : '')
  }

  function atalho(o: SetorFisico, d: SetorFisico) {
    setOrigem(o)
    setLOrigem('')
    setDestino(d)
  }

  async function mover() {
    if (!pecaId || !origem || !destino) return
    setSalvando(true)
    try {
      const r =
        origemVenda && lEscolhido && passoVenda
          ? await moverVenda(lEscolhido.projeto_item_id, passoVenda.acao, q, motivo.trim())
          : await moverSetor(pecaId, origem as SetorFisico, destino as SetorFisico, q, motivo.trim())
      toast.success(`${numeroMov(r.numero)} registrado`, {
        description: `${fmtQtd(q)} de ${origem} para ${destino}${
          lEscolhido ? ` (${lEscolhido.venda_numero ?? lEscolhido.orcamento_numero} ${lEscolhido.l_fixo ?? ''})` : ''
        }.`,
      })
      setQuantidade('')
      setMotivo('')
      await carregarPeca(pecaId)
    } catch (err) {
      toast.error('Não foi possível mover', { description: msgErro(err) })
    } finally {
      setSalvando(false)
    }
  }

  const acaoInfo = ACOES_VENDA.find((a) => a.acao === acao)!
  const limiteVenda = vendaSel ? vendaSel[acaoInfo.campo] : 0
  const qv = lerQtd(qtdVenda)
  const podeMoverVenda = !!vendaSel && qv > 0 && qv <= limiteVenda + 0.0001 && !!motivoVenda.trim() && !salvando

  function abrirVenda(v: VendaDaPeca) {
    setVendaSel(v)
    const primeira = ACOES_VENDA.find((a) => v[a.campo] > 0)
    setAcao(primeira?.acao ?? 'reserva_para_entrega_futura')
    setQtdVenda('')
    setMotivoVenda('')
  }

  async function moverNaVenda() {
    if (!vendaSel || !pecaId) return
    setSalvando(true)
    try {
      const r = await moverVenda(vendaSel.projeto_item_id, acao, qv, motivoVenda.trim())
      toast.success(`${numeroMov(r.numero)} registrado`, {
        description: `${fmtQtd(qv)} · ${acaoInfo.rotulo} (${vendaSel.venda_numero ?? vendaSel.orcamento_numero} ${vendaSel.l_fixo ?? ''})`,
      })
      setVendaSel(null)
      await carregarPeca(pecaId)
    } catch (err) {
      toast.error('Não foi possível mover', { description: msgErro(err) })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      {/* Busca */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-fit">
        <div className="p-3 border-b border-slate-100 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              autoFocus
              placeholder="Buscar peça por código, referência, nome ou marca..."
              className="pl-9 h-9 bg-slate-50"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {busca && (
            <Button variant="ghost" size="sm" onClick={() => setBusca('')}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="px-3 py-1.5 text-[11px] text-slate-500 border-b border-slate-100">
          {buscando
            ? 'Carregando...'
            : busca.trim()
              ? `${resultados.length} peça(s) encontrada(s)${resultados.length >= 40 ? ' (as 40 primeiras — refine a busca)' : ''}`
              : `${resultados.length} peça(s) com estoque positivo`}
        </div>
        <div
          className="max-h-[70vh] overflow-auto divide-y divide-slate-100"
          onScroll={(e) => {
            const el = e.currentTarget
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && visiveis < resultados.length) {
              setVisiveis((v) => Math.min(v + LOTE, resultados.length))
            }
          }}
        >
          {buscando ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : resultados.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {busca.trim() ? 'Nenhuma peça encontrada.' : 'Nenhuma peça com estoque positivo.'}
            </p>
          ) : (
            resultados.slice(0, visiveis).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPecaId(p.id)}
                className={cn(
                  'w-full text-left px-3 py-2 hover:bg-slate-50',
                  pecaId === p.id && 'bg-primary/5 hover:bg-primary/10',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">{p.codigo_produto ?? '—'}</span>
                  <span className="text-sm text-slate-800 line-clamp-1">{p.nome}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {[p.referencia && `Ref: ${p.referencia}`, p.marca].filter(Boolean).join(' · ')} · Estoque{' '}
                  {fmtQtd(p.estoque_geral)} · Showroom {fmtQtd(p.showroom)}
                  {p.outros > 0 && ` · Outros setores ${fmtQtd(p.outros)}`}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Peça escolhida */}
      {!pecaId ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
          Escolha uma peça na lista para ver os setores e mover.
        </div>
      ) : !dados ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm">
              <span className="font-mono font-semibold text-primary mr-2">{dados.produto.codigo_produto}</span>
              <span className="font-semibold text-slate-900">{dados.produto.nome}</span>
            </p>
            <p className="text-xs text-slate-500">
              {[dados.produto.referencia && `Ref: ${dados.produto.referencia}`, dados.produto.marca]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {dados.setores.map((s) => (
                <div key={s.setor} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-[11px] text-slate-500">{s.setor}</p>
                  <p className={cn('text-lg font-bold tabular-nums', s.quantidade < 0 && 'text-red-600')}>
                    {fmtQtd(s.quantidade)}
                  </p>
                </div>
              ))}
            </div>
            {/* Setores de venda: soma dos L desta peça (o detalhe por venda está em "Vendas com esta peça") */}
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">Vendas</p>
            <div className="mt-1 grid grid-cols-3 lg:grid-cols-6 gap-2">
              {SETORES_VENDA.map((s) => (
                <div key={s} className="rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-2">
                  <p className="text-[11px] text-slate-500">{s}</p>
                  <p className="text-lg font-bold tabular-nums">{fmtQtd(saldoDe(s))}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Livre no Estoque Geral (sem reserva/separação de venda):{' '}
              <strong className={cn(dados.livre_estoque_geral <= 0 && 'text-red-600')}>
                {fmtQtd(Math.max(dados.livre_estoque_geral, 0))}
              </strong>
            </p>
          </div>

          {/* Mover de setor */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Mover</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => atalho('Estoque Geral', 'Showroom')}>
                  Estoque → Showroom
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => atalho('Showroom', 'Estoque Geral')}>
                  Showroom → Estoque
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_120px] items-end">
              <div className="space-y-1">
                <Label>De</Label>
                <Select value={origem} onValueChange={(v) => escolherOrigem(v as Setor)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Setor de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...SETORES_FISICOS, ...SETORES_VENDA].map((s) => (
                      <SelectItem key={s} value={s} disabled={saldoDe(s) <= 0}>
                        {s} ({fmtQtd(saldoDe(s))})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ArrowRight className="hidden sm:block w-4 h-4 mb-3 text-slate-400" />
              <div className="space-y-1">
                <Label>Para</Label>
                <Select value={destino} onValueChange={(v) => setDestino(v as Setor)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Setor de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinosPossiveis.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantidade</Label>
                <Input
                  inputMode="decimal"
                  value={quantidade}
                  className={cn(q > limiteOrigem + 0.0001 && 'border-red-400')}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>
            </div>
            {origemVenda && (
              <div className="space-y-1">
                <Label>Venda / L</Label>
                <Select value={lOrigem} onValueChange={setLOrigem}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Escolha o L que está em ${origem}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {lsDaOrigem.map((v) => (
                      <SelectItem key={v.projeto_item_id} value={v.projeto_item_id}>
                        {v.venda_numero ?? v.orcamento_numero ?? '—'} · {v.cliente ?? '—'} · {v.l_fixo ?? '—'} (
                        {fmtQtd(v[CAMPO_SETOR_VENDA[origem as keyof typeof CAMPO_SETOR_VENDA]])})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {passoVenda && <p className="text-[11px] text-slate-500">{passoVenda.ajuda}</p>}
              </div>
            )}
            {origem && (!origemVenda || lEscolhido) && (
              <p className="text-[11px] text-slate-500">
                Pode tirar até <strong>{fmtQtd(Math.max(limiteOrigem, 0))}</strong> de {origem}
                {origem === 'Estoque Geral' && ' (o resto está guardado para vendas)'}
                {origemVenda && lEscolhido && ` neste L`}.
                {showroomFracionado && <span className="text-red-600"> No Showroom a quantidade é inteira.</span>}
              </p>
            )}
            <div className="space-y-1">
              <Label>Motivo *</Label>
              <Textarea
                rows={2}
                placeholder="Ex.: peça vai para a vitrine; voltou da Casa Cor; chegou com defeito"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={mover} disabled={!podeMover}>
                {salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Mover
              </Button>
            </div>
          </div>

          {/* Vendas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <p className="text-sm font-semibold text-slate-800 px-4 pt-3 pb-2">Vendas com esta peça</p>
            {dados.vendas.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-slate-400">Nenhuma venda com esta peça em reserva, entrega futura ou separação.</p>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-xs">Venda</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Projeto</TableHead>
                    <TableHead className="text-xs">L</TableHead>
                    <TableHead className="text-xs text-right">Reserva</TableHead>
                    <TableHead className="text-xs text-right">Entrega Futura</TableHead>
                    <TableHead className="text-xs text-right">Separação</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.vendas.map((v) => (
                    <TableRow key={v.projeto_item_id}>
                      <TableCell className="font-mono text-xs">{v.venda_numero ?? v.orcamento_numero ?? '—'}</TableCell>
                      <TableCell className="text-sm">{v.cliente ?? '—'}</TableCell>
                      <TableCell className="text-xs">{v.projeto_codigo ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{v.l_fixo ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtQtd(v.q_reserva)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtQtd(v.q_entrega_futura)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtQtd(v.q_separacao)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => abrirVenda(v)}>
                          Mover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Últimos movimentos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-800">Últimos movimentos desta peça</p>
              <Link to={`/historico?peca=${pecaId}`} className="text-xs text-primary hover:underline">
                Ver todos
              </Link>
            </div>
            {ultimos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum movimento ainda.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {ultimos.map((m) => (
                  <li key={m.id} className="flex flex-wrap gap-x-2">
                    <span className="font-mono text-slate-400">{numeroMov(m.numero)}</span>
                    <span className="text-slate-500">{dataHora(m.criado_em)}</span>
                    <span className="font-medium">{m.usuario_nome ?? '—'}</span>
                    <span>
                      {fmtQtd(m.quantidade)} · {m.origem} → {m.destino}
                      {m.venda ? ` (${m.venda} ${m.l_fixo ?? ''})` : ''}
                    </span>
                    <span className="text-slate-500">— {m.motivo}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!vendaSel} onOpenChange={(o) => !o && !salvando && setVendaSel(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Mover na venda {vendaSel?.venda_numero ?? vendaSel?.orcamento_numero} · {vendaSel?.l_fixo}
            </DialogTitle>
            <DialogDescription>
              {vendaSel?.cliente} · Reserva {fmtQtd(vendaSel?.q_reserva)} · Entrega Futura{' '}
              {fmtQtd(vendaSel?.q_entrega_futura)} · Separação {fmtQtd(vendaSel?.q_separacao)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Movimento</Label>
              <Select value={acao} onValueChange={(v) => setAcao(v as AcaoVenda)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACOES_VENDA.map((a) => (
                    <SelectItem key={a.acao} value={a.acao} disabled={!vendaSel || vendaSel[a.campo] <= 0}>
                      {a.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">{acaoInfo.ajuda}</p>
            </div>
            <div className="space-y-1">
              <Label>Quantidade (até {fmtQtd(limiteVenda)})</Label>
              <Input
                inputMode="decimal"
                value={qtdVenda}
                className={cn(qv > limiteVenda + 0.0001 && 'border-red-400')}
                onChange={(e) => setQtdVenda(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Motivo *</Label>
              <Textarea rows={2} value={motivoVenda} onChange={(e) => setMotivoVenda(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendaSel(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={moverNaVenda} disabled={!podeMoverVenda}>
              {salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
