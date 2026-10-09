# Oito Lados

> Brinque sem ter medo financeiro.

[![CI](https://github.com/lucasmagalhaees/oito-lados/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasmagalhaees/oito-lados/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-informational)](LICENSE)

Simulador de apostas de UFC com **dinheiro fictício** e **odds reais**. Você deposita quanto quiser de mentira, aposta no card da semana e o app acompanha as lutas ao vivo e fecha as apostas com o resultado oficial. Nenhum centavo de verdade entra ou sai.

| Lutas | Cupom | Ao vivo | Carteira |
|---|---|---|---|
| ![Card da semana com odds](docs/screenshots/lutas.png) | ![Cupom com combinada na mesma luta](docs/screenshots/cupom.png) | ![Apostas abertas com luta ao vivo](docs/screenshots/ao-vivo.png) | ![Saldo e ganhos e perdas](docs/screenshots/carteira.png) |

As telas acima vêm do teste automatizado, com lutadores e resultados inventados.

## O que faz

- **Saldo fictício:** depósitos ilimitados, saldo sempre derivado do histórico.
- **Mercados:** vencedor, método (KO/TKO, finalização, decisão), vai até a decisão, total de rounds, round em que acaba, vencedor e round, quedas na luta e por lutador.
- **Simples, múltipla e combinada:** a combinada na mesma luta é precificada pela chance de tudo acontecer junto, não pela multiplicação das odds. Combinações impossíveis ou redundantes são recusadas.
- **Ao vivo:** round, relógio e quedas das lutas em andamento. A aposta fecha sozinha quando sai o resultado oficial.
- **Ganhos e perdas:** lucro ou prejuízo, ROI, taxa de acerto, gráfico acumulado e quebra por mercado e por evento.

## Como funciona

É uma página estática, sem backend. O navegador consulta a API pública da ESPN para montar o card, ler as odds e acompanhar status, resultado e estatísticas.

| | De onde vem |
|---|---|
| Vencedor, método por lutador, vai até a decisão, linha principal de rounds | Odds publicadas pela casa (hoje DraftKings), via ESPN |
| Quedas, round exato, linhas alternativas de rounds, combinadas | Estimadas por um modelo próprio a partir das odds reais e do histórico dos lutadores. Aparecem com `≈` |
| Liquidação | Sempre o resultado oficial: vencedor, método, round, tempo e quedas |

Saldo e apostas ficam no `localStorage` do aparelho. A Carteira tem backup e restauração por texto.

A especificação completa (endpoints, formato dos dados, modelo de preço e regras de liquidação) está em [`CLAUDE.md`](CLAUDE.md).

## Rodando local

Não tem build nem dependência.

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Testes

```bash
pip install -r tests/requirements.txt
playwright install chromium
python3 tests/e2e.py dark   # ou light
```

O teste simula a API da ESPN, leva um card do pré-luta ao resultado, aposta pela interface e confere preços, liquidações e saldo final.

## Publicação

Qualquer hospedagem estática serve. Com Vercel:

```bash
npx vercel --prod
```

No iPhone: abra a URL no Safari, toque em Compartilhar e em Adicionar à Tela de Início.

## Estrutura

```
index.html                 o app inteiro (HTML, CSS e JS)
tests/e2e.py               teste ponta a ponta com a ESPN simulada
docs/screenshots/          telas usadas neste README
.github/workflows/ci.yml   roda o teste em cada push e PR
CLAUDE.md                  especificação do projeto
```

## Limites conhecidos

- A API da ESPN é pública, mas não é oficial nem documentada, e pode mudar sem aviso.
- Só atualiza com o app aberto. Ao reabrir, ele busca os resultados e liquida o que ficou pendente.
- As odds travam quando a luta começa. Não há aposta ao vivo.
- Os dados ficam em um aparelho só.

## Aviso

Projeto de entretenimento. Não aceita, movimenta nem paga dinheiro real, e não é uma casa de apostas. Não tem vínculo com UFC, ESPN ou DraftKings; nomes e marcas pertencem aos respectivos donos. As odds são exibidas apenas como referência para a simulação.

## Licença

[MIT](LICENSE) © 2026 Lucas Magalhães
