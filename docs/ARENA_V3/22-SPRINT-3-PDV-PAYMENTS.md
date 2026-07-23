# Sprint 3 — PDV & PAGAMENTOS

**Status**: 🚧 Em andamento

## Flags

- `arena_module_pdv` (pai)
- `arena_module_pdv_catalog` (filho)
- `arena_module_pdv_pix_native` (filho)
- `arena_module_pdv_split` (filho)

## Funcionalidades

### Catálogo de produtos
- Arena cadastra produtos (água, raquete, grip, bola, vestuário)
- Atleta vê e compra no app
- Estoque controlado

### Pix nativo
- QR gerado no app
- Confirmação manual pelo gestor (sem gateway real)

### Split payment
- Divide entre 2-4 jogadores
- Cada um paga sua parte

## Coleções

- `arena_products/{prodId}` — produtos do PDV
- `arena_sales/{saleId}` — vendas
- `arena_payments/{paymentId}` — pagamentos

## Tarefas

- [ ] Domínio (catalog, sales, payments)
- [ ] Testes
- [ ] Service
- [ ] Hooks
- [ ] Páginas
- [ ] Commit
