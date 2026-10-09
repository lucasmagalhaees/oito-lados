# Contribuindo

## Fluxo

1. Crie um branch a partir de `main`: `feat/...`, `fix/...`, `docs/...` ou `chore/...`.
2. Faça commits pequenos, com mensagem no estilo [Conventional Commits](https://www.conventionalcommits.org/pt-br/).
3. Rode `scripts/verify.sh` antes de abrir o PR e cole a saída nele.
4. Abra o PR para `main`. O CI roda docs, unitários, contrato e o ponta a ponta nos temas claro e escuro.
5. O merge na `main` publica em produção. Nada vai direto para a `main`.

## Regras do código

- `Core` é puro: sem DOM, sem rede, sem `localStorage`. Preço e liquidação moram ali.
- Todo acesso à ESPN passa pelas funções `norm*`. Se o formato da API mudar, o conserto é ali.
- Texto vindo da API sempre passa por `esc()` antes de entrar no HTML.
- Odd estimada tem que aparecer como estimada (`≈`). Nunca apresentar preço de modelo como se fosse da casa.
- O saldo é derivado do histórico. Não criar campo de saldo.
- Mudou regra de preço ou de liquidação? Acrescente o caso em `tests/unit.py` e atualize `CLAUDE.md` e o saldo esperado em `tests/e2e.py`.
- Vai ler um campo novo da ESPN? Grave antes uma resposta real em `tests/fixtures/espn/` e cubra em `tests/contract.py`.
- Decisão nova de produto ou de arquitetura entra em `docs/decisoes.md`. O que foi verificado (e o que não foi) entra em `docs/verificacao.md`.
- Nada de dinheiro real, cadastro de pagamento ou imitação de casa de apostas existente.

## Dados de teste

`tests/mock_espn.py` inventa resultados, então usa só lutadores fictícios. Não coloque nomes reais ali. Respostas reais ficam em `tests/fixtures/espn/` e não são editadas à mão.

## Trabalhando com IA

As regras estão em `CLAUDE.md`, na seção "Regras contra alucinação". A principal: ninguém, pessoa ou IA, escreve "funciona" sem a saída do `scripts/verify.sh`.
