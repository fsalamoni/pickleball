## Resumo

- 

## Validação

- [ ] `npm run security:secrets`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Se tocou regras: `npm run test:rules` ou justificar bloqueio do emulador

## Segurança e dados

- [ ] Não adiciona segredos, chaves privadas, dumps ou exports de banco ao Git
- [ ] Não executa migração destrutiva sem PITR/backup testado
- [ ] Não amplia leitura/escrita de dados pessoais
- [ ] Links externos vindos de dados passam por `safeHttpUrl`
- [ ] Documentos de concessão de admin preservam id determinístico + validação do dono/criador

## Observações

- 
