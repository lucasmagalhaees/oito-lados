# Registro de verificação

O que se sabe que funciona, como se sabe, e o que ainda é suposição. Regra: um item só sobe para "Verificado" com o comando ou o procedimento que provou, e a data.

## Verificado

| Afirmação | Como | Quando |
|---|---|---|
| A API da ESPN responde a um navegador em outra origem, sem chave | `fetch` a partir de `example.com` num navegador de verdade, para `site.api.espn.com` e `sports.core.api.espn.com` | 09/10/2026 |
| O formato das respostas de placar, odds, prop bets, status, estatísticas da luta e do atleta | Respostas reais lidas no navegador; amostras gravadas em `tests/fixtures/espn/` | 09/10/2026 |
| Os leitores normalizam as respostas reais gravadas | `python3 tests/contract.py` (23 checagens) | 09/10/2026 |
| A leitura de odds funciona num card real inteiro | Normalizadores rodados no navegador contra o card de 10/10/2026: 11 de 12 lutas com odds completas; a 12ª não tinha linha na ESPN | 09/10/2026 |
| O sim e o não de "vai até a decisão" são atribuídos certo | Conferido contra a probabilidade de decisão das linhas de método nas 11 lutas do card real | 09/10/2026 |
| Conversão de odds, modelo de preço, combinadas e todas as regras de liquidação | `python3 tests/unit.py` (148 checagens) | 09/10/2026 |
| Fluxo completo pela interface: depositar, apostar, ao vivo, liquidar, ganhos e perdas | `python3 tests/e2e.py dark` e `light`, com a ESPN simulada. Saldo final R$ 1.584,30 | 09/10/2026 |
| Sem estouro de largura em 393 px, temas claro e escuro | Mesmo teste | 09/10/2026 |
| O script de checagem ao vivo funciona | `python3 tests/contract_live.py --mock` (14 checagens contra a ESPN simulada) | 09/10/2026 |
| A documentação bate com o código | `python3 tests/docs_check.py` (124 checagens) | 09/10/2026 |
| O harness pega erro de verdade | Quatro quebras propositais no `index.html` (margem trocada, regra de total de rounds invertida, campo da ESPN com nome errado, empate sem anular): `scripts/verify.sh --quick` falhou nas quatro, apontando a checagem certa | 09/10/2026 |
| O script do hook de parada devolve os códigos certos | Rodado à mão com o app quebrado: saída 2 nas três primeiras tentativas e 1 na quarta; saída 0 com o app certo | 09/10/2026 |

## Não verificado

| Afirmação | Por que não | Como verificar |
|---|---|---|
| Comportamento durante um evento ao vivo de verdade (velocidade do status, relógio, quedas em tempo real) | Não houve evento durante a construção | Usar num sábado de card |
| O campo numérico `clock` do status num nocaute | Só foi visto em decisão (300). O app lê o tempo de `displayClock`, que foi visto nos dois casos | `tests/contract_live.py` num fim de semana com nocaute |
| `status.type.completed` no nível do evento | Só o `name` foi visto nesse nível. O app aceita `completed`, `state` ou o nome | `tests/contract_live.py` |
| Nomes de resultado além de `kotko` e `decision---unanimous` (finalização, empate, no contest, decisão dividida) | Não apareceram nas lutas consultadas. A classificação é por expressão regular | Acumular amostras em `tests/fixtures/espn/` |
| `tests/contract_live.py` contra a API real | O ambiente onde o projeto foi criado não alcança a ESPN | Roda sozinho no GitHub Actions; ou `python3 tests/contract_live.py` local |
| O CI no GitHub Actions | O repositório ainda não recebeu o primeiro push | Abrir o primeiro PR |
| Deploy na Vercel e o efeito do `.vercelignore` | Ainda não configurado | Importar o repositório e olhar a prévia do PR |
| Instalação na Tela de Início do iPhone: ícone, tela cheia, persistência do `localStorage` | Sem acesso ao aparelho | Instalar e usar por algumas semanas |
| O hook de parada dentro do Claude Code | O script foi testado sozinho, não dentro do Claude Code | Abrir o repositório no CLI, quebrar um teste e tentar encerrar |
| Plausibilidade das odds estimadas | Não foram comparadas com casas de verdade | Comparar algumas num card real |
| Limites gratuitos de hospedagem | Vieram de um comparativo de setembro de 2026, não das páginas oficiais de preço | Conferir no site de cada serviço antes de depender |
