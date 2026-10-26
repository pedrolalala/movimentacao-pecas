import { supabase } from '@/lib/supabase/client'

// SPEC-224: tudo passa pelas RPCs da migration 236 (a tabela movimentacoes_peca não é lida direto).

export const SETORES_FISICOS = [
  'Estoque Geral',
  'Showroom',
  'Estoque Garantia',
  'Estoque Casa Cor',
  'Estoque Defeito',
  'Amostra / Emprestado',
] as const
export type SetorFisico = (typeof SETORES_FISICOS)[number]

// Setores de venda: o saldo é de um L (item da venda), então mover deles pede o L.
export const SETORES_VENDA = ['Reserva', 'Entrega Futura', 'Separação'] as const
export type SetorVenda = (typeof SETORES_VENDA)[number]
export type Setor = SetorFisico | SetorVenda
export const ehSetorVenda = (s: string): s is SetorVenda => (SETORES_VENDA as readonly string[]).includes(s)
export const CAMPO_SETOR_VENDA: Record<SetorVenda, 'q_reserva' | 'q_entrega_futura' | 'q_separacao'> = {
  Reserva: 'q_reserva',
  'Entrega Futura': 'q_entrega_futura',
  Separação: 'q_separacao',
}
/** De um setor de venda, para onde pode ir e qual ação do banco faz isso. */
export const DESTINOS_VENDA: Record<SetorVenda, { destino: SetorVenda; acao: AcaoVenda; ajuda: string }[]> = {
  Reserva: [
    {
      destino: 'Entrega Futura',
      acao: 'reserva_para_entrega_futura',
      ajuda: 'A peça física volta livre para o Estoque Geral e a necessidade de compra deste L volta.',
    },
  ],
  'Entrega Futura': [
    { destino: 'Reserva', acao: 'entrega_futura_para_reserva', ajuda: 'Usa uma peça livre do Estoque Geral.' },
  ],
  Separação: [
    {
      destino: 'Reserva',
      acao: 'separacao_para_reserva',
      ajuda: 'Estorna a separação (peça já separada: só admin ou gerente). Entregue não volta por aqui.',
    },
  ],
}

export type AcaoVenda = 'reserva_para_entrega_futura' | 'entrega_futura_para_reserva' | 'separacao_para_reserva'

export const ACOES_VENDA: { acao: AcaoVenda; rotulo: string; campo: 'q_reserva' | 'q_entrega_futura' | 'q_separacao'; ajuda: string }[] = [
  {
    acao: 'reserva_para_entrega_futura',
    rotulo: 'Reserva → Entrega Futura',
    campo: 'q_reserva',
    ajuda: 'A peça física fica livre no Estoque Geral e a necessidade de compra deste L volta.',
  },
  {
    acao: 'entrega_futura_para_reserva',
    rotulo: 'Entrega Futura → Reserva',
    campo: 'q_entrega_futura',
    ajuda: 'Só se houver peça livre no Estoque Geral.',
  },
  {
    acao: 'separacao_para_reserva',
    rotulo: 'Separação → Reserva',
    campo: 'q_separacao',
    ajuda: 'Estorna a separação (peça já separada: só admin ou gerente). Entregue não volta por aqui.',
  },
]

export interface PecaBusca {
  id: string
  codigo_produto: number | null
  referencia: string | null
  nome: string
  marca: string | null
  estoque_geral: number
  showroom: number
  /** Garantia + Casa Cor + Defeito + Amostra / Emprestado */
  outros: number
}

export interface VendaDaPeca {
  projeto_item_id: string
  venda_numero: string | null
  orcamento_numero: string | null
  projeto_codigo: string | null
  cliente: string | null
  l_fixo: string | null
  q_reserva: number
  q_entrega_futura: number
  q_separacao: number
}

export interface SetoresDaPeca {
  produto: { id: string; codigo_produto: number | null; referencia: string | null; nome: string; marca: string | null }
  setores: { setor: SetorFisico; quantidade: number }[]
  livre_estoque_geral: number
  vendas: VendaDaPeca[]
}

export interface Movimento {
  id: string
  numero: number
  criado_em: string
  usuario_id: string
  usuario_nome: string | null
  produto_id: string
  codigo_produto: number | null
  referencia: string | null
  produto: string
  quantidade: number
  tipo: 'setor' | 'venda'
  origem: string
  destino: string
  venda: string | null
  cliente: string | null
  l_fixo: string | null
  motivo: string
  saldo_origem_antes: number | null
  saldo_origem_depois: number | null
  saldo_destino_antes: number | null
  saldo_destino_depois: number | null
}

export interface FiltrosHistorico {
  produtoId?: string | null
  usuarioId?: string | null
  setor?: string | null
  tipo?: 'setor' | 'venda' | null
  de?: string | null
  ate?: string | null
}

const n = (v: unknown) => Number(v) || 0

/** Com termo: até 40 peças que casam. Termo vazio: todas as peças com estoque positivo em algum setor (migration 237). */
export async function buscarPecas(termo: string): Promise<PecaBusca[]> {
  const { data, error } = await (supabase as any).rpc('movimentacao_buscar_pecas', { p_termo: termo.trim() })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    ...r,
    estoque_geral: n(r.estoque_geral),
    showroom: n(r.showroom),
    outros: n(r.outros),
  }))
}

export async function getSetoresDaPeca(produtoId: string): Promise<SetoresDaPeca> {
  const { data, error } = await (supabase as any).rpc('movimentacao_peca_setores', { p_produto_id: produtoId })
  if (error) throw error
  return {
    produto: data.produto,
    setores: (data.setores ?? []).map((s: any) => ({ setor: s.setor, quantidade: n(s.quantidade) })),
    livre_estoque_geral: n(data.livre_estoque_geral),
    vendas: (data.vendas ?? []).map((v: any) => ({
      ...v,
      q_reserva: n(v.q_reserva),
      q_entrega_futura: n(v.q_entrega_futura),
      q_separacao: n(v.q_separacao),
    })),
  }
}

export async function moverSetor(
  produtoId: string,
  origem: SetorFisico,
  destino: SetorFisico,
  quantidade: number,
  motivo: string,
): Promise<{ numero: number }> {
  const { data, error } = await (supabase as any).rpc('movimentar_peca_setor', {
    p_produto_id: produtoId,
    p_origem: origem,
    p_destino: destino,
    p_quantidade: quantidade,
    p_motivo: motivo,
  })
  if (error) throw error
  return { numero: Number(data?.numero) }
}

export async function moverVenda(
  projetoItemId: string,
  acao: AcaoVenda,
  quantidade: number,
  motivo: string,
  baixarEstoque = false,
): Promise<{ numero: number }> {
  const { data, error } = await (supabase as any).rpc('movimentar_peca_venda', {
    p_projeto_item_id: projetoItemId,
    p_acao: acao,
    p_quantidade: quantidade,
    p_motivo: motivo,
    // SPEC-227: peça faltando — baixa também do Estoque Geral (só Reserva → Entrega Futura)
    ...(baixarEstoque ? { p_baixar_estoque: true } : {}),
  })
  if (error) throw error
  return { numero: Number(data?.numero) }
}

export async function listarMovimentos(f: FiltrosHistorico): Promise<Movimento[]> {
  const { data, error } = await (supabase as any).rpc('movimentacao_listar', {
    p_produto_id: f.produtoId || null,
    p_usuario_id: f.usuarioId || null,
    p_setor: f.setor || null,
    p_tipo: f.tipo || null,
    p_de: f.de || null,
    p_ate: f.ate || null,
    p_limite: 2000,
  })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    ...r,
    quantidade: n(r.quantidade),
  }))
}

export async function listarUsuariosQueMovimentaram(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await (supabase as any).rpc('movimentacao_usuarios')
  if (error) throw error
  return data ?? []
}

export const numeroMov = (numero: number) => `MOV-${String(numero).padStart(6, '0')}`

export const fmtQtd = (v: number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

/** Mensagem do banco sem o prefixo técnico. */
export function msgErro(err: any): string {
  return err?.message ?? 'Tente novamente.'
}
