# Registro de verificação

O que se sabe que funciona, como se sabe, e o que ainda é suposição. Regra: um item só sobe para "Verificado" com o comando ou o procedimento que provou, e a data.

## Verificado

| Afirmação | Como | Quando |
|---|---|---|
| A API da ESPN responde a um navegador em outra origem, sem chave | `fetch` a partir de `example.com` num navegador de verdade, para `site.api.espn.com` e `sports.core.api.espn.com` | 09/10/2026 |
| O formato das respostas de placar, odds, prop bets, status, estatísticas da luta e do atleta | Respostas reais lidas no navegador; amostras gravadas em `tests/fixtures/espn/` | 09/10/2026 |
| Os leitores normalizam as respostas reais gravadas | `python3 tests/contract.py` (25 checagens, incluindo a resposta real do serviço de câmbio) | 09/10/2026 |
| A leitura de odds funciona num card real inteiro | Normalizadores rodados no navegador contra o card de 10/10/2026: 11 de 12 lutas com odds completas; a 12ª não tinha linha na ESPN | 09/10/2026 |
| O sim e o não de "vai até a decisão" são atribuídos certo | Conferido contra a probabilidade de decisão das linhas de método nas 11 lutas do card real | 09/10/2026 |
| Conversão de odds, modelo de preço, combinadas, todas as regras de liquidação, a regra do cashout, a máscara e a leitura de valores, o cálculo da unidade e o leitor de texto de apostas | `python3 tests/unit.py` (340 checagens) | 09/10/2026 |
| Fluxo completo pela interface: depositar, apostar, ao vivo, liquidar, ganhos e perdas | `python3 tests/e2e.py dark` e `light`, com a ESPN simulada. Saldo final R$ 1.609,59 | 09/10/2026 |
| Cashout pela interface: devolve a stake antes da luta, congela com luta em andamento, e oferece valor de mercado quando parte da múltipla já bateu | Mesmo teste: um cashout de R$ 40,00 feito pelos botões; na fase com luta ao vivo, 7 apostas congeladas e 6 liberadas; na fase seguinte, 2 múltiplas com oferta de mercado, 4 congeladas e 6 liberadas; uma múltipla de R$ 10,00 encerrada por R$ 15,19 (retorno possível R$ 34,20 × 46,75% × 0,95) | 09/10/2026 |
| Sem estouro de largura em 393 px, temas claro e escuro | Mesmo teste | 09/10/2026 |
| O script de checagem ao vivo funciona | `python3 tests/contract_live.py --mock` (17 checagens contra a ESPN e o câmbio simulados) | 09/10/2026 |
| A API real da ESPN continua batendo com o que o app lê | Workflow `ESPN contract` no GitHub Actions (execução 37995940072): 15 de 15 checagens em 10 eventos e 89 lutas, incluindo resultado e quedas de uma luta encerrada e odds de uma luta agendada. 1 aviso: duas lutas encerradas listadas com 4 rounds | 09/10/2026 |
| A ESPN manda o cabeçalho de CORS para a origem de produção | Mesma execução: todas as respostas vieram com `access-control-allow-origin` aceitando `https://oito-lados.vercel.app`. Conferido pelo cabeçalho, não por um navegador aberto na produção | 09/10/2026 |
| Evento com todas as lutas encerradas é lido como encerrado | Mesma execução | 09/10/2026 |
| A ESPN recusa navegador headless | No runner do GitHub, o Chromium headless e uma chamada com o user agent dele receberam 403 sem cabeçalho de CORS; a mesma chamada com user agent próprio do script recebeu a resposta normal | 09/10/2026 |
| Repetir aposta, máscara, moeda e unidade pela interface | `python3 tests/e2e.py`: repete uma aposta encerrada por cashout e o cupom de uma múltipla; digita no campo e confere a máscara e o cursor; soma os atalhos de valor do cupom (+10.000, +100.000, +1.000.000 e +10 dão 1.110.010) e confere que o cupom não estoura a largura; muda a porcentagem da unidade, aposta por atalho de unidade e confere +6,1u no resultado | 09/10/2026 |
| Conversão de moeda: leitura da cotação, taxa cruzada e conversão do estado inteiro com o saldo batendo no centavo | `python3 tests/unit.py`, bloco de moeda | 09/10/2026 |
| Conversão de moeda pela interface, **com cotação simulada** | `python3 tests/e2e.py`: banca vazia muda só a moeda sem pedir cotação; serviço fora do ar bloqueia a troca; € 80,00 viram R$ 500,00 a 6,25; a cotação é pedida uma vez e reaproveitada; cotação que muda entre a tela e a confirmação pede confirmação de novo; cotação vencida com o serviço fora do ar usa a guardada; o botão de só converter leva R$ 1.000,00 para US$ 200,00 e de volta sem acrescentar depósito, com a mesma proteção de cotação; no fim, a banca com as 15 apostas vai para dólar (US$ 421,92) e o resultado em unidades continua +6,1u | 09/10/2026 |
| O serviço de câmbio responde no formato que o app lê, e aceita chamada da origem de produção | Workflow `ESPN contract` no branch `feat/cashout-dinamico-cambio` (execução 38001453842): 18 de 18 checagens. Resposta: base BRL, data 2026-10-09, USD 0,1998 e EUR 0,1783, com o cabeçalho de CORS aceitando `https://oito-lados.vercel.app`. Conferido pelo cabeçalho, não por um navegador. A resposta está gravada em `tests/fixtures/fx/` | 09/10/2026 |
| Valor de print: mesmo valor ou mesma stake | `python3 tests/unit.py` (os dois modos, texto em unidades, sem banca, e o modo "fixo" antigo lido como mesmo valor) e `python3 tests/e2e.py`: o mesmo texto de R$ 250,00 vira R$ 250,00 e depois R$ 25,00 (0,25u, com 1u do print a R$ 1.000,00); texto em unidades não muda; a configuração sobrevive a recarregar | 09/10/2026 |
| Valor da aposta digitado em unidades | `python3 tests/unit.py` (máscara e leitura do campo) e `python3 tests/e2e.py`: 2,5u viram R$ 250,00 com a unidade a R$ 100,00; atalho de unidade e "Tudo" preenchem o campo; a escolha sobrevive a recarregar; voltar para dinheiro mantém o valor | 09/10/2026 |
| + e − no lugar de mais e menos, e cor de canto nas opções | `python3 tests/unit.py` (`Core.sideOf`, textos das seleções, leitor de texto com "+2.5", "−2.5", "-1.5" e traço separador) e `python3 tests/e2e.py`: rótulos "+1.5" e "−1.5"; opções de lutador marcadas e as da luta inteira não; as duas cores diferentes; quadradinho da cor no cupom e nas apostas. Visto nas capturas, temas claro e escuro | 09/10/2026 |
| A produção lê a ESPN num navegador de verdade | https://oito-lados.vercel.app aberto no navegador do computador do Lucas: 5 eventos, 42 lutas, 11 com odds, sem erro. Era a versão do PR #4 que estava no ar | 09/10/2026 |
| A produção ficou numa versão antiga depois de quatro merges seguidos | Mesmo navegador: o arquivo servido tinha o sha256 do `index.html` do merge do PR #4 (90.037 bytes), conferido duas vezes com 7 minutos de intervalo; os horários dos deploys vieram da API do GitHub | 09/10/2026 |
| A checagem de produção alcança a produção a partir do GitHub Actions | Job `produção` do PR #8: "produção serve commit f169857, 10 versão(ões) do index.html atrás", o mesmo conteúdo visto no navegador | 09/10/2026 |
| A checagem de produção se comporta como descrito | `python3 scripts/check_production.py --selftest` (8 casos contra um servidor local: bate e fica, chega depois, volta para a versão antiga, nunca chega, fora do ar) | 09/10/2026 |
| Copiar aposta por texto e por imagem, pela interface | `python3 tests/e2e.py`: cola uma mensagem de canal (0,5 unidade vira R$ 50,00); gera a imagem de um print e o OCR de verdade roda no Chromium, com os arquivos do leitor servidos de cópias locais (R$ 250,00 copiado igual); imagem colada da área de transferência; leitor indisponível; texto vazio, luta fora do card, aposta não entendida e luta ambígua | 09/10/2026 |
| O OCR lê o print real que o Lucas mandou | Tesseract.js 7.0.0 em Node sobre a imagem original: todas as linhas saíram certas (lutadores, 1.44, "Para Ganhar a Luta", R$1.750,00), e o leitor de texto tirou delas a seleção e o valor. A imagem não está no repositório | 09/10/2026 |
| Cobertura de código da página gerada | `scripts/verify.sh` completo: 97,3% das funções e 94,0% do código de `dist/index.html` executados pelos testes (mínimos cobrados: 95% e 90%) | 09/10/2026 |
| A migração para TypeScript não mudou o comportamento | Os mesmos testes, sem alteração nas expectativas, contra a página gerada pelo build: 340 unitários, 25 de contrato, ponta a ponta nos dois temas com o mesmo saldo final de R$ 1.609,59. Rodados duas vezes: depois de separar em módulos e depois de tipar | 09/10/2026 |
| O código passa no TypeScript em modo `strict` | `npm run typecheck`: zero erros, sem `@ts-ignore` nem `@ts-nocheck` | 09/10/2026 |
| O pipeline novo pega erro de regra e erro de tipo | Margem do cashout trocada em `src/core/cashout.ts`: 8 falhas no `verify.sh --quick`. Tipo de retorno errado em `src/core/settlement.ts`: o `tsc` falhou e os testes nem rodaram | 09/10/2026 |
| A documentação bate com o código | `python3 tests/docs_check.py` | 09/10/2026 |
| O harness pega erro de verdade | Quatro quebras propositais no `index.html` (margem trocada, regra de total de rounds invertida, campo da ESPN com nome errado, empate sem anular): `scripts/verify.sh --quick` falhou nas quatro, apontando a checagem certa | 09/10/2026 |
| Os testes novos pegam erro de verdade | Quatro quebras propositais (margem do cashout a 10%, centavos de arredondamento sem ajuste, modo fixo devolvendo o valor do print, leitor de câmbio aceitando outra base): `scripts/verify.sh --quick` falhou nas quatro, na checagem certa | 09/10/2026 |
| O CI roda no GitHub Actions | PR #1 e o push na `main` (commit 52e43f2): os dois com conclusão `success`. Ainda na versão antiga do workflow, só com o e2e | 09/10/2026 |
| O job `coverage` voltou a passar no GitHub Actions depois de guardar as contagens antes de cada recarga | PR #8, commit 745b6c2: os cinco checks com sucesso. Sustenta a explicação da queda, sem prová-la | 09/10/2026 |
| A Vercel constrói a versão em TypeScript | PR #9, commit 168a950: status `Vercel: success` com o `vercel.json` novo (`npm ci`, `npm run build`, `dist/`), prévia publicada. Os cinco checks do CI também passaram com o build | 09/10/2026 |
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
| A checagem de produção no modo estrito (depois de um merge), e se ela falha quando a produção volta para uma versão antiga | No GitHub só rodou o modo de PR, que informa e não falha. O modo estrito só foi exercitado no autoteste | Ver o workflow `Produção` no primeiro merge depois deste PR |
| A causa exata da queda de cobertura no GitHub Actions | A perda das contagens antes da recarga não foi reproduzida nesta máquina (Chromium 141; o CI instala o mais novo). A correção fez o job passar, mas a causa segue deduzida | Se o job `coverage` cair de novo com funções testadas como "nunca chamadas", a hipótese está errada |
| O carimbo de commit gravado pelo build da Vercel | O build passou, mas a página da prévia não foi lida: não se sabe se `VERCEL_GIT_COMMIT_SHA` chegou ao build | Ler `<meta name="ol-commit">` na prévia, ou ver o workflow `Produção` depois do merge: ele falha com mensagem clara se o carimbo faltar |
| A página gerada no Safari do iPhone | O script passou a ser um módulo embutido na página; só foi aberto no Chromium dos testes | Abrir a prévia no iPhone |
| O valor em unidades, os atalhos novos e as cores no iPhone | Sem acesso ao aparelho | Abrir a prévia no iPhone |
| O que o app faz com uma luta agendada listada com 4 rounds | Só apareceu em lutas já encerradas | Olhar o aviso do workflow `ESPN contract` quando houver uma agendada |
| Instalação na Tela de Início do iPhone: ícone, tela cheia, persistência do `localStorage` | Sem acesso ao aparelho | Instalar e usar por algumas semanas |
| O hook de parada dentro do Claude Code | O script foi testado sozinho, não dentro do Claude Code | Abrir o repositório no CLI, quebrar um teste e tentar encerrar |
| O app trocando de moeda com o serviço de câmbio de verdade, num navegador | O formato e o cabeçalho de CORS foram conferidos (ver acima), mas a troca pela interface só rodou com cotação simulada | Depositar em dólar na prévia ou na produção |
| Trocar de moeda no iPhone | Sem acesso ao aparelho | Depositar em dólar na prévia e conferir saldo e apostas |
| O leitor de imagem baixando da CDN de verdade, e no Safari do iPhone | Os testes servem os mesmos arquivos de cópias locais; daqui não dá para alcançar a jsDelivr nem um iPhone | Escolher um print na prévia ou na produção, pelo iPhone |
| Prints e mensagens em outros formatos | O leitor foi feito em cima de dois exemplos reais | Testar com prints de outras casas e canais; o que falhar vira caso em `tests/unit.py` |
| A máscara de valores no teclado do iPhone | O teste digita num Chromium de computador. O teclado numérico do iOS e o cursor no Safari não foram vistos | Digitar um valor acima de mil no iPhone |
| Plausibilidade das odds estimadas | Não foram comparadas com casas de verdade | Comparar algumas num card real |
| Limites gratuitos de hospedagem | Vieram de um comparativo de setembro de 2026, não das páginas oficiais de preço | Conferir no site de cada serviço antes de depender |
