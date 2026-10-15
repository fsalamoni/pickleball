## Resumo

- 

## Validação

- [ ] `npm run security:secrets`
- [ ] `npm run docs:inventario:check`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Se tocou regras: `npm run test:rules` ou justificar bloqueio do emulador

## Documentação (obrigatória — CLAUDE.md princípio 12)

- [ ] Atualizei o doc do assunto e/o README do módulo (mapa: `docs/00-INDEX.md` §8)
- [ ] Rodei `npm run docs:inventario` e comitei `docs/46-INVENTARIO.md`
- [ ] Ou: nada muda para quem lê a documentação — escrevi no corpo `Docs: não se aplica — <motivo>`

## Segurança e dados

- [ ] Não adiciona segredos, chaves privadas, dumps ou exports de banco ao Git
- [ ] Não executa migração destrutiva sem PITR/backup testado
- [ ] Não amplia leitura/escrita de dados pessoais
- [ ] Links externos vindos de dados passam por `safeHttpUrl`
- [ ] Documentos de concessão de admin preservam id determinístico + validação do dono/criador

## Observações

- 
