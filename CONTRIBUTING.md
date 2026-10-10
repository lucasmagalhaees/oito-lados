# Contribuindo

## Fluxo

1. Crie um branch a partir de `main`: `feat/...`, `fix/...`, `docs/...` ou `chore/...`.
2. Faça commits pequenos, com mensagem no estilo [Conventional Commits](https://www.conventionalcommits.org/pt-br/).
3. Rode `scripts/verify.sh` antes de abrir o PR e cole a saída nele.
4. Abra o PR para `main`. O CI confere os tipos, faz o build e roda docs, unitários, contrato, o ponta a ponta nos temas claro e escuro e o teste do service worker.
5. O merge na `main` publica em produção. Nada vai direto para a `main`. Mescle um PR por vez e espere o deploy: merges em sequência já deixaram a produção numa versão antiga.

## Regras do código

- `src/core/` é puro: sem DOM, sem rede, sem `localStorage`. Preço e liquidação moram ali. O `docs_check.py` reprova se isso mudar.
- Todo acesso à ESPN passa pelas funções `norm*` de `src/core/espn.ts`. Se o formato da API mudar, o conserto é ali.
- TypeScript em modo `strict`, sem `@ts-ignore` e sem `@ts-nocheck`. `any` só para o que vem de fora (o tipo `Json`).
- Em `src/app/`, não chame função de outro módulo no nível de cima do arquivo: os módulos se importam em círculo e isso só funciona porque nada roda durante a carga. O que precisa rodar na carga vai em `src/main.ts`.
- Módulo novo em `src/` entra na tabela de "Arquitetura" do `CLAUDE.md` (o `docs_check.py` cobra).
- Texto vindo da API sempre passa por `esc()` antes de entrar no HTML.
- O service worker (`src/sw.js`) nunca responde pela ESPN nem pelo câmbio, e uma versão nova nunca assume sem o toque da pessoa. O `tests/pwa.py` e o `docs_check.py` cobram os dois.
- Odd estimada tem que aparecer como estimada (`≈`). Nunca apresentar preço de modelo como se fosse da casa.
- O saldo é derivado do histórico. Não criar campo de saldo.
- Mudou regra de preço ou de liquidação? Acrescente o caso em `tests/unit.py` e atualize `CLAUDE.md` e o saldo esperado em `tests/e2e.py`.
- Vai ler um campo novo da ESPN ou do serviço de câmbio? Grave antes uma resposta real em `tests/fixtures/espn/` (ou `tests/fixtures/fx/`) e cubra em `tests/contract.py`.
- Decisão nova de produto ou de arquitetura entra em `docs/decisoes.md`. O que foi verificado (e o que não foi) entra em `docs/verificacao.md`.
- Nada de dinheiro real, cadastro de pagamento ou imitação de casa de apostas existente.

## Dados de teste

`tests/mock_espn.py` inventa resultados, então usa só lutadores fictícios. Não coloque nomes reais ali. Respostas reais ficam em `tests/fixtures/espn/` e não são editadas à mão.

## Trabalhando com IA

As regras estão em `CLAUDE.md`, na seção "Regras contra alucinação". A principal: ninguém, pessoa ou IA, escreve "funciona" sem a saída do `scripts/verify.sh`.
