# AI_DB_CONTEXT — Movimentação de Peças (SPEC-224)

Banco: Supabase SP (`bgtfrcbipuxnsexbppsh`). Migration `supabase/db/migrations/20261023_236_spec224_movimentacao_pecas/`.

## Acesso
- Sistema `movimentacao-pecas` em `public.systems` (link https://movimentacao-lucenera.pages.dev/).
- Todas as RPCs exigem login e `is_admin()` ou `pode_acessar_sistema('movimentacao-pecas')` (liberar no Hub,
  `user_system_access`). Só `authenticated` tem EXECUTE; `anon` não.
- A tabela `movimentacoes_peca` não é lida direto (RLS ligado, sem grant): só pelas RPCs.

## Setores
| Setor no sistema | Onde fica |
|---|---|
| Estoque Geral | `estoque_itens` local `Estoque` (`quantidade`) |
| Showroom | `produtos.estoque_showroom` (inteiro) |
| Estoque Garantia / Casa Cor / Defeito / Amostra / Emprestado | `estoque_itens` do local de mesmo nome |
| Reserva / Entrega Futura / Separação (de um L) | `estoque_saldos_projeto_item` (`q_reserva`, `q_entrega_futura`, `q_ag_separar + q_separado`) |

- **Livre no Estoque Geral** = `quantidade − (quantidade_reservada − soma da entrega futura dos L ativos)`. A aprovação
  do orçamento reserva a venda inteira em `quantidade_reservada` (reserva + entrega futura); a diferença inclui a
  reserva herdada da Connect. Tirar do Estoque Geral ou passar Entrega Futura → Reserva só até esse livre.

## RPCs
- `movimentar_peca_setor(p_produto_id, p_origem, p_destino, p_quantidade, p_motivo)` → `{numero, ...}`.
- `movimentar_peca_venda(p_projeto_item_id, p_acao, p_quantidade, p_motivo)`; `p_acao`:
  `reserva_para_entrega_futura` | `entrega_futura_para_reserva` | `separacao_para_reserva` (este chama
  `estornar_item_separacao`: peça já separada só admin/gerente; entregue não volta). Grava também em
  `estoque_movimentos_projeto_item` (origem `movimentacao_pecas`).
- `movimentacao_buscar_pecas(p_termo)` (até 40), `movimentacao_peca_setores(p_produto_id)` (setores, livre, vendas),
  `movimentacao_listar(p_produto_id, p_usuario_id, p_setor, p_tipo, p_de, p_ate, p_limite)`, `movimentacao_usuarios()`.

## Registro (`movimentacoes_peca`)
`numero` (MOV-000001), `produto_id`, `quantidade`, `tipo` (`setor`|`venda`), `origem`, `destino`, `projeto_item_id`,
`motivo` (obrigatório), saldos antes/depois da origem e do destino, `criado_por`, `criado_em`.

## Cuidados
- `fn_atualizar_preco_venda` (trigger `trg_calculo_preco_venda`, sem filtro de coluna) foi ajustada para não
  recalcular o preço quando o UPDATE só mexe em estoque (`estoque_showroom/total/disponivel`); `tem_st` e `sku` são
  colunas geradas e ficam fora da comparação.
- A importação da Connect (`scripts/importar_produtos_estoque.py`) não grava mais estoque nem Showroom sem
  `--incluir-estoque` — senão apagaria os movimentos.
