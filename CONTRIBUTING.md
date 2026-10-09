# Contribuindo

## Fluxo

1. Crie um branch a partir de `main`: `feat/...`, `fix/...`, `docs/...` ou `chore/...`.
2. Faça commits pequenos, com mensagem no estilo [Conventional Commits](https://www.conventionalcommits.org/pt-br/).
3. Rode o teste antes de abrir o PR: `python3 tests/e2e.py dark`.
4. Abra o PR para `main`. O CI roda o teste nos temas claro e escuro.

## Regras do código

- `Core` é puro: sem DOM, sem rede, sem `localStorage`. Preço e liquidação moram ali.
- Todo acesso à ESPN passa pelas funções `norm*`. Se o formato da API mudar, o conserto é ali.
- Texto vindo da API sempre passa por `esc()` antes de entrar no HTML.
- Odd estimada tem que aparecer como estimada (`≈`). Nunca apresentar preço de modelo como se fosse da casa.
- O saldo é derivado do histórico. Não criar campo de saldo.
- Mudou regra de preço ou de liquidação? Atualize `CLAUDE.md` e o saldo esperado em `tests/e2e.py`.
- Nada de dinheiro real, cadastro de pagamento ou imitação de casa de apostas existente.

## Dados de teste

O fixture inventa resultados, então usa só lutadores fictícios. Não coloque nomes reais ali.
