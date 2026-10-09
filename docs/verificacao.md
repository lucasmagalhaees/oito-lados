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
| Conversão de odds, modelo de preço, combinadas, todas as regras de liquidação e a regra do cashout | `python3 tests/unit.py` (160 checagens) | 09/10/2026 |
| Fluxo completo pela interface: depositar, apostar, ao vivo, liquidar, ganhos e perdas | `python3 tests/e2e.py dark` e `light`, com a ESPN simulada. Saldo final R$ 1.604,40 | 09/10/2026 |
| Cashout pela interface: devolve a stake antes da luta, congela com luta em andamento, acaba depois que uma luta da aposta começou | Mesmo teste: um cashout de R$ 40,00 feito pelos botões; na fase com luta ao vivo, 6 apostas congeladas e 6 liberadas; na fase seguinte, 1 encerrada, 4 congeladas e 4 liberadas | 09/10/2026 |
| Sem estouro de largura em 393 px, temas claro e escuro | Mesmo teste | 09/10/2026 |
| O script de checagem ao vivo funciona | `python3 tests/contract_live.py --mock` (14 checagens contra a ESPN simulada) | 09/10/2026 |
| A API real da ESPN continua batendo com o que o app lê | Workflow `ESPN contract` no GitHub Actions (execução 37995940072): 15 de 15 checagens em 10 eventos e 89 lutas, incluindo resultado e quedas de uma luta encerrada e odds de uma luta agendada. 1 aviso: duas lutas encerradas listadas com 4 rounds | 09/10/2026 |
| A ESPN manda o cabeçalho de CORS para a origem de produção | Mesma execução: todas as respostas vieram com `access-control-allow-origin` aceitando `https://oito-lados.vercel.app`. Conferido pelo cabeçalho, não por um navegador aberto na produção | 09/10/2026 |
| Evento com todas as lutas encerradas é lido como encerrado | Mesma execução | 09/10/2026 |
| A ESPN recusa navegador headless | No runner do GitHub, o Chromium headless e uma chamada com o user agent dele receberam 403 sem cabeçalho de CORS; a mesma chamada com user agent próprio do script recebeu a resposta normal | 09/10/2026 |
| A documentação bate com o código | `python3 tests/docs_check.py` (130 checagens) | 09/10/2026 |
| O harness pega erro de verdade | Quatro quebras propositais no `index.html` (margem trocada, regra de total de rounds invertida, campo da ESPN com nome errado, empate sem anular): `scripts/verify.sh --quick` falhou nas quatro, apontando a checagem certa | 09/10/2026 |
| O CI roda no GitHub Actions | PR #1 e o push na `main` (commit 52e43f2): os dois com conclusão `success`. Ainda na versão antiga do workflow, só com o e2e | 09/10/2026 |
| O CI pega o que a máquina local esconde | No PR #2 o job `checks` falhou: `docs_check.py` exigia a pasta `tests/shots/`, que só existe depois de rodar o e2e. Passava local e quebrava numa cópia limpa. Corrigido e reexecutado | 09/10/2026 |
| A produção está no ar e o deploy dispara no merge | https://oito-lados.vercel.app devolve o app (título "Oito Lados", "Saldo fictício"). No GitHub, o merge do PR #2 gerou um deploy `Production` com status `success`, e os três checks do CI passaram na `main` | 09/10/2026 |
| O site publicado não serve o código de teste | `https://oito-lados.vercel.app/tests/e2e.py` devolve erro de cliente (4xx) em vez do arquivo. O código exato não foi visto | 09/10/2026 |
| O deploy de prévia na Vercel funciona com o `vercel.json` | Status `Vercel: success` no commit 789295e do PR #2, depois de o deploy da `main` sem `vercel.json` ter falhado | 09/10/2026 |
| O script do hook de parada devolve os códigos certos | Rodado à mão com o app quebrado: saída 2 nas três primeiras tentativas e 1 na quarta; saída 0 com o app certo | 09/10/2026 |

## Não verificado

| Afirmação | Por que não | Como verificar |
|---|---|---|
| Comportamento durante um evento ao vivo de verdade (velocidade do status, relógio, quedas em tempo real) | Não houve evento durante a construção | Usar num sábado de card |
| O campo numérico `clock` do status num nocaute | Só foi visto em decisão (300). O app lê o tempo de `displayClock`, que foi visto nos dois casos | `tests/contract_live.py` num fim de semana com nocaute |
| Nomes de resultado além de `kotko` e `decision---unanimous` (finalização, empate, no contest, decisão dividida) | Não apareceram nas lutas consultadas. A classificação é por expressão regular | Acumular amostras em `tests/fixtures/espn/` |
| O app aberto na produção lendo a ESPN de um navegador de verdade | O cabeçalho de CORS foi conferido, mas ninguém confirmou o card carregando em https://oito-lados.vercel.app | Abrir a URL no iPhone e ver o card com odds |
| O que o app faz com uma luta agendada listada com 4 rounds | Só apareceu em lutas já encerradas | Olhar o aviso do workflow `ESPN contract` quando houver uma agendada |
| Instalação na Tela de Início do iPhone: ícone, tela cheia, persistência do `localStorage` | Sem acesso ao aparelho | Instalar e usar por algumas semanas |
| O hook de parada dentro do Claude Code | O script foi testado sozinho, não dentro do Claude Code | Abrir o repositório no CLI, quebrar um teste e tentar encerrar |
| Plausibilidade das odds estimadas | Não foram comparadas com casas de verdade | Comparar algumas num card real |
| Limites gratuitos de hospedagem | Vieram de um comparativo de setembro de 2026, não das páginas oficiais de preço | Conferir no site de cada serviço antes de depender |
