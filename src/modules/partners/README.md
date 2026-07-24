# `partners/` — Espaço de parceiros (admin)

Área dedicada de parceiros (logos, banners, links). Painel do admin.

## Status
- **Páginas V2**: `V2Partners` (visualização) + `V2AdminPartners` (gestão)
- **Coleção**: `affiliate_links`
- **Tests**: 10+

## Schema
- `affiliate_links/{id}` — `label`, `url`, `image_url`, `category`,
  `clicks` (contador), LGPD (IP hash, UA truncado)

## Onde achar mais
- `docs/06-MODULES.md` § partners
