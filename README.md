# Movimentação de Peças — Lucenera

Sistema da SPEC-224: muda a peça de setor (Estoque Geral, Showroom, Garantia, Casa Cor, Defeito, Amostra / Emprestado)
e de venda (reserva, entrega futura, separação), sem aprovação, registrando quem, quando, de onde, para onde e o motivo.

- Banco: Supabase SP — tabela `movimentacoes_peca` e RPCs `movimentar_peca_setor`, `movimentar_peca_venda`,
  `movimentacao_buscar_pecas`, `movimentacao_peca_setores`, `movimentacao_listar`, `movimentacao_usuarios`
  (migration 236). Acesso: sistema `movimentacao-pecas` liberado no Hub (ou admin).
- Variáveis de build: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (arquivo `.env` local, fora do git).
- Publicado em https://movimentacao-lucenera.pages.dev (Cloudflare Pages, upload direto — o projeto ainda não está
  ligado ao GitHub). Para publicar: `npx pnpm@10 run build` e `npx wrangler pages deploy dist --project-name
  movimentacao-lucenera --branch main`. Detalhes do banco em `AI_DB_CONTEXT.md`.
