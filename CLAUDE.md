# Oito Lados

Simulador de apostas de UFC com **dinheiro fictício** e **odds reais**. Uso pessoal do Lucas, no iPhone 15 (Safari, adicionado à Tela de Início). Não existe e não deve existir dinheiro real, cadastro de pagamento nem nada que pareça uma casa de apostas de verdade. Marca própria ("Oito Lados"); não imitar bet365 nem outra casa.

Idioma da interface: português do Brasil, informal. Comentários no código: inglês.

## Fluxo de trabalho (obrigatório)

1. **Nunca commitar direto na `main`.** Toda mudança começa com um branch novo a partir da `main` atualizada: `git fetch origin && git switch -c tipo/descricao origin/main` (`feat/`, `fix/`, `docs/`, `chore/`, `ci/`).
2. Rodar `scripts/verify.sh` antes de enviar e colar a saída no PR.
3. Abrir PR para a `main` usando o template. O CI (docs, unit, contract e e2e claro e escuro) tem que passar.
4. O merge na `main` dispara o deploy de produção. Não existe outro caminho para produção.
5. Mensagens de commit no estilo Conventional Commits, em português.

## Escopo: MVP

Decisão do Lucas em 09/10/2026: **MVP para um usuário**, simples de propósito. Validar hipóteses usando de verdade e só depois escalar, se for preciso. Portanto:

- Não adicionar backend, login nem banco sem ele pedir. O app continua sendo uma página estática.
- No mesmo dia ele pediu a etapa 1 do plano de escala: código em TypeScript, em módulos, com build pelo Vite (D33). Isso organiza o código e não muda o produto.
- O plano de escala (hipóteses a validar, gatilhos, etapas, modelo de dados, fonte de dados, pontos jurídicos, custos) está em [`docs/escala.md`](docs/escala.md). Consultar antes de propor qualquer mudança de arquitetura.

## Regras contra alucinação (valem para qualquer IA trabalhando aqui)

A ordem de confiança é: **código e testes rodando agora** > amostras reais gravadas > documentação > memória. Se dois deles discordam, o de cima ganha e o de baixo é corrigido.

1. **Não diga que funciona sem rodar.** Antes de afirmar que algo está certo, rode `scripts/verify.sh` e mostre a saída. Sem saída, a frase certa é "não verifiquei".
2. **Não invente campo da ESPN.** O app só pode ler campos que aparecem em `tests/fixtures/espn/`. Precisa de um campo novo? Capture a resposta real, grave a amostra, acrescente o caso em `tests/contract.py`, e só então escreva o código.
3. **Separe sempre o verificado do suposto.** Em resposta, commit e PR, diga o que foi testado e o que não foi. O registro oficial é [`docs/verificacao.md`](docs/verificacao.md): um item só sobe para "Verificado" com comando e data.
4. **Número mora no código.** Margens, limites, intervalos e prazos citados aqui são conferidos contra o código em `src/` por `tests/docs_check.py`. Mudou um, mude o outro no mesmo commit.
5. **Decisão de produto não se presume.** O que já foi decidido, e por quê, está em [`docs/decisoes.md`](docs/decisoes.md). O que não está lá, pergunte ao Lucas. Decisão nova entra lá com data.
6. **Fato de terceiro tem data.** Limite de hospedagem, preço, comportamento de API: tudo isso envelhece. Cite a data em que foi conferido e reconfira antes de depender.
7. **Resultado inventado só com nome inventado.** `tests/mock_espn.py` usa lutadores fictícios. Amostra real fica em `tests/fixtures/espn/` e não é editada à mão.
8. **Não pule o harness.** O hook em `.claude/settings.json` roda `scripts/verify.sh --quick` quando a tarefa termina e segura o encerramento se falhar. Não desative, não contorne, e não edite um teste só para ele passar: se o teste está errado, explique por quê no PR.
9. **Na dúvida, pare e diga.** Uma resposta incompleta e honesta vale mais que uma completa e inventada.

O que cada peça do harness cobre:

| Peça | Protege contra |
|---|---|
| `scripts/verify.sh` | Afirmar que está certo sem ter rodado nada |
| `tests/unit.cases.mjs`, rodado por `tests/unit.py` e por `tests/core.mjs` | Mexer em preço ou liquidação e quebrar uma regra sem notar |
| `tests/core.mjs` (os mesmos casos, no Node, sem página) | O núcleo passar a depender de página, rede ou armazenamento sem ninguém notar |
| `tests/contract.py` + `tests/fixtures/espn/` | Escrever leitor para um formato de API imaginado |
| `tests/contract_live.py` (toda semana no GitHub Actions) | A API real mudar e a documentação continuar dizendo o contrário |
| `tests/docs_check.py` | Documentação citar número, arquivo ou chave que não existe mais |
| `tests/e2e.py` | Tudo passar isolado e o fluxo real pela interface estar quebrado |
| `tests/settle.py` | A aposta só fechar certo quando a ESPN responde tudo de uma vez: resultado que atrasa, ou que vem com um nome que o app não conhece |
| `tests/pwa.py` | Dizer que o app abre sem internet e avisa de versão nova sem nunca ter visto acontecer |
| `tests/cov.py` (cobertura medida pelo navegador) | Achar que está testado sem estar |
| `scripts/check_production.py` (workflow `Produção`, depois de cada merge) | CI verde e deploy feito, mas a produção servindo outra versão |
| `tsc` em modo `strict` (primeiro passo do `verify.sh`) | Chamar função com o dado errado, ou ler um campo que pode não existir |
| Hook de parada (`.claude/hooks/verify-on-stop.sh`) | Encerrar a tarefa com checagem falhando |
| `docs/verificacao.md` | Tratar suposição como fato |
| `docs/decisoes.md` | Depender da memória de uma conversa |

## Estado atual

- `src/`: o app, em TypeScript. `src/core/` é a lógica pura; `src/app/` é a página (estado, rede, telas, eventos). Detalhes em "Arquitetura".
- `index.html`: o esqueleto da página que o build usa como entrada (cabeçalho, ícone embutido em base64, as partes fixas da tela).
- `dist/index.html`: o que o build gera e o que vai para o ar: a página inteira num arquivo, com script e estilo dentro. Não é versionado.
- `dist/sw.js`: o service worker, gerado pelo build a partir de `src/sw.js`. É o único outro arquivo publicado; guarda a página no aparelho.
- `package.json`, `package-lock.json`, `vite.config.js`, `tsconfig.json`: o build. Sem framework e sem dependência em tempo de execução.
- `scripts/verify.sh`: o comando único de verificação.
- `scripts/check_production.py` + `.github/workflows/producao.yml`: confere se a produção está no commit da `main`.
- `tests/unit.cases.mjs`: os casos do `Core` (conversão de odds, normalizadores, preço, combinadas, liquidação, leitor de apostas, histórico), num arquivo só. Dois executores rodam os mesmos casos: `tests/unit.py`, no navegador, contra a página gerada, e `tests/core.mjs`, no Node, contra o núcleo construído sozinho.
- `tests/contract.py`: normalizadores contra respostas reais gravadas em `tests/fixtures/espn/` e `tests/fixtures/fx/`.
- `tests/contract_live.py`: confere a API real da ESPN (agendado em `.github/workflows/espn-contract.yml`).
- `tests/docs_check.py`: confere a documentação contra o código.
- `tests/e2e.py` + `tests/mock_espn.py`: teste ponta a ponta com Playwright e a ESPN simulada.
- `tests/settle.py`: a liquidação pela interface com a ESPN simulada segurando respostas: resultado que atrasa e resultado com nome desconhecido.
- `tests/pwa.py`: o service worker de ponta a ponta, com a página servida por um servidor local: abrir sem conexão e trocar de versão.
- `tests/cov.py`: cobertura de código da página gerada, medida pelo próprio navegador durante os testes.
- `tests/package.json`: cópias locais dos arquivos do leitor de imagem, para o teste de OCR rodar sem internet.
- CI em `.github/workflows/ci.yml`: roda tudo isso (menos o ao vivo) em cada PR e em cada push na `main`.
- `.claude/settings.json` + `.claude/hooks/verify-on-stop.sh`: hook de parada do Claude Code.
- `docs/decisoes.md`: tudo que foi decidido e por quê. `docs/verificacao.md`: o que foi verificado e o que não foi. `docs/escala.md`: caminho de escala.
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE` (MIT, Lucas Magalhães).
- Publicado em https://oito-lados.vercel.app. A Vercel está ligada ao repositório e publica em produção a cada merge na `main`.

O que já foi verificado, e o que ainda não foi, está em [`docs/verificacao.md`](docs/verificacao.md). Em resumo: lógica e fluxo cobertos por testes, leitura da ESPN conferida contra respostas reais, CI e deploy de produção funcionando; **não** verificados ainda um evento ao vivo de verdade, a instalação no iPhone e o service worker fora do Chromium dos testes.

## Requisitos do produto

1. Saldo fictício: o usuário deposita quanto quiser, quantas vezes quiser.
2. Odds reais de UFC, atualizadas sozinhas a cada semana, sem redeploy.
3. Mercados: vencedor, método (KO/TKO, finalização, decisão), rounds, quedas.
4. Aposta simples, múltipla entre lutas e combinada na mesma luta (com preço coerente, não multiplicação).
5. Apostas acompanham a luta ao vivo e fecham sozinhas com o resultado oficial.
6. Controle de ganhos e perdas: lucro/prejuízo, ROI, acerto, gráfico, quebra por mercado, por evento e por origem (de quem a aposta foi copiada, com o resultado em dinheiro e em unidades), para tudo, para os últimos 30 dias ou para o último evento. A lista de apostas pode mostrar uma origem só.
7. Tem que funcionar bem em tela de celular (393 px de largura).
8. Cashout: devolve o valor integral enquanto nenhuma luta da aposta foi decidida; com parte da múltipla já batida, oferece um valor de mercado para encerrar. Congela com luta em andamento.
9. Repetir uma aposta com um toque, enquanto as seleções dela ainda estiverem abertas.
10. Campos de valor com máscara de milhares.
11. Moeda da banca: real, dólar ou euro, escolhida no cartão de depósito. Passar para outra moeda converte a banca inteira pela cotação do dia, com ou sem depósito.
12. Gestão de unidade: uma unidade é uma porcentagem da banca, 10% por padrão e ajustável. O valor da aposta é digitado em dinheiro ou em unidades, conforme a configuração escolhida na Carteira. Em unidades, o campo tem setas de meia em meia unidade. Numa múltipla de cinco seleções ou mais, o app sugere uma stake de 0,2u a 0,4u.
13. Copiar uma aposta a partir de um print (imagem) ou de um texto, com a odd de agora. O valor que entra segue a mesma configuração do cupom, à risca: em dinheiro, o mesmo valor do original; em unidades, a stake do original, e 1u quando ele não diz unidades. Cada aposta lida mostra a stake em unidades e em dinheiro e a hora da luta. Um botão cola o texto da área de transferência. Dá para mandar várias fotos de uma vez, cada uma vira uma aposta, e fazer todas juntas. O leitor sabe quando o original é simples e quando é múltipla (dupla, tripla, quádrupla, quíntupla). O cupom de múltipla que não mostra todas as seleções é completado com a foto da lista de seleções, ou à mão. Valor e tipo de cada aposta podem ser mudados na lista, e o que o leitor leu errado pode ser corrigido ali. A aposta copiada guarda de quem veio e a odd do original. Antes de apostar várias de uma vez, o app avisa o que já está apostado, o que está repetido na lista e, se houver um limite configurado, a odd que caiu demais em relação ao print.
14. Mais e menos de uma linha aparecem como + e −, em tons neutros e com seta, e toda opção ligada a um lutador leva a cor do canto dele. Com os mercados de uma luta abertos, uma legenda que não sai da tela lembra de quem é cada cor.
15. Tema automático (segue o aparelho), claro ou escuro, escolhido na Carteira. As cores dos cantos têm três pares (vermelho e azul, rosa e verde, laranja e roxo), escolhidos separadamente para lutas masculinas e femininas.
16. O app fica guardado no aparelho: abre na hora e também sem internet, com os últimos dados que carregou. Quando uma versão nova é publicada, avisa e troca com um toque.
17. Ao reabrir o app, um resumo do que fechou sozinho desde a última vez: quantas apostas, o resultado e a quebra por origem.
18. Antes de apostar numa luta que já tem aposta aberta, o app diz quanto já está em jogo nela e se a aposta nova vai contra a que existe. No card, a luta mostra quantas apostas abertas tem e quanto está em jogo.
19. As apostas abertas aparecem agrupadas por evento, na ordem das lutas, com o total em jogo, o retorno e o ganho se todas baterem.
20. Onde aparece dinheiro em jogo aparece também em unidades, e onde aparece o retorno possível aparece o ganho possível (retorno menos a stake), em dinheiro e em unidades: em cada aposta aberta, em cada evento, no total em aberto, no card da luta, na Carteira, no cupom e na lista de copiar. O resultado de aposta encerrada também vem em unidades.

21. Na tela de Lutas, um campo de busca acha a luta por um pedaço do nome de um lutador, em todos os eventos carregados, sem depender de acento ou caixa.
22. O card de um evento vem separado em card principal, preliminares e primeiras preliminares, e um toque mostra uma parte só.

Escala fica para depois: ver "Escopo: MVP" acima e `docs/escala.md`.

## Por que uma página estática chamando a ESPN direto

Tempo real exige que o navegador consulte a fonte. A API pública da ESPN aceita chamadas de navegador vindas de outra origem (testado a partir de `example.com`), não pede chave e traz odds, status ao vivo, resultado e estatísticas. Então não precisa de servidor.

Risco conhecido: a API não é oficial nem documentada e pode mudar sem aviso. Todo acesso a ela passa pelas funções `norm*` de `src/core/espn.ts`, que é onde mexer se o formato mudar.

## Fonte de dados (ESPN)

Bases:
- `SITE = https://site.api.espn.com/apis/site/v2/sports/mma/ufc`
- `CORE = https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc`

| Para quê | Chamada | Campos usados |
|---|---|---|
| Card e status ao vivo | `SITE/scoreboard?dates=YYYYMMDD-YYYYMMDD&limit=100` | `events[].competitions[]`: `id`, `date`, `type.abbreviation` (categoria), `format.regulation.periods` (rounds), `status.type.{name,state}`, `status.{period,displayClock}`, `competitors[].{id,order,winner,athlete,records}` |
| Odds | `CORE/events/{ev}/competitions/{luta}/odds` | `items[0]`: `provider.name`, `homeAthleteOdds`/`awayAthleteOdds` (`moneyLine`, `current.victoryMethod.{koTkoDq,submission,points}.american`, `athlete.$ref`), `overUnder`, `overOdds`, `underOdds`, `propBets.$ref` |
| Vai até a decisão | o `propBets.$ref` acima, com `limit=100` | itens com `type.name` contendo "Distance"; `odds.american.value` |
| Resultado | `CORE/events/{ev}/competitions/{luta}/status` | `result.{name,displayName,displayDescription}`, `period`, `clock`, `displayClock` |
| Quedas da luta | `CORE/events/{ev}/competitions/{luta}/competitors/{atleta}/statistics` | `splits.categories[].stats[]` com `name == "takedownsLanded"` |
| Média de quedas do lutador | `https://sports.core.api.espn.com/v2/sports/mma/athletes/{atleta}/statistics` | stat `takedownAvg` (quedas por 15 min) |

Detalhes que já morderam:
- O placar lista as lutas da primeira preliminar até a luta principal (a principal é o último índice).
- Lutador `a` é o de `order` 1, `b` o de `order` 2. Casa e visitante das odds são mapeados pelo id em `athlete.$ref`.
- `state`: `pre`, `in`, `post`. O objeto `result` só existe no `status` do CORE, não no placar.
- O tempo do fim da luta é lido de `displayClock` ("3:26"); o `clock` numérico é só reserva, porque só foi visto em decisão.
- No nível do evento só o `status.type.name` foi visto. `normEvent` aceita `completed`, `state` ou o nome contendo FINAL.
- Nomes de resultado vistos em 160 lutas encerradas, em 10/10/2026: `kotko` (80), `decision---unanimous` (45), `submission` (25), `decision---split` (8), `dq` (1) e `tko---doctors-stoppage` (1). Empate, no contest e decisão majoritária não apareceram. Classificação por regex em `normResult` (ordem: no contest, draw, sub, dec, ko/dq). O `tests/contract_live.py` refaz essa varredura toda semana e falha se aparecer um nome que o app não classifica.
- Nas mesmas 160 lutas, toda luta com vencedor tinha o vencedor marcado no placar, e todas tinham o objeto `result`. Quanto tempo a ESPN leva, depois do fim da luta, para marcar o vencedor e para publicar o resultado não foi medido.
- "Fight To Go The Distance" vem como dois preços **sem rótulo de sim/não**. `attachDistance` decide qual é o "sim" comparando com a probabilidade de decisão implícita nas linhas de método.
- A linha de total (`overUnder`) é em rounds.
- `takedownAvg` igual a 0 aparece tanto para trocador puro quanto para estreante sem minutos.
- Lutas sem linha publicada devolvem `items: []`. Na data do teste, o card da semana seguinte não tinha linha nenhuma e o do UFC 333 só tinha vencedor nas duas lutas principais.
- Eventos do Contender Series vêm no mesmo placar e não têm odds; o app esconde.
- A ESPN recusa navegador headless (403, sem cabeçalho de CORS). Por isso nenhum teste automatizado chama a ESPN pelo Chromium, e o script de conferência não se disfarça de navegador comum.
- Em 09/10/2026 a ESPN listava duas lutas já encerradas com `format.regulation.periods: 4`. O app usa o número como vem; não foi visto em luta agendada.

## Arquitetura

TypeScript em módulos, build pelo Vite 8.3.3 com TypeScript 7.0.2 (versões exatas no `package.json`). O build junta tudo num arquivo só, `dist/index.html`, com o script e o estilo dentro (plugin `single-file` no `vite.config.js`) e **sem minificar**: o que os testes medem, por nome de função e linha, é o arquivo que vai para o ar. A página gerada leva o commit de origem em `<meta name="ol-commit">`. O único outro arquivo que o build emite é `dist/sw.js`, o service worker (seção "App guardado no aparelho").

`npm run typecheck` roda o `tsc` em modo `strict`, com `noUnusedLocals`. Nenhum módulo usa `@ts-nocheck` ou `@ts-ignore` (o `docs_check.py` confere). O único `any` é o tipo `Json`, para o que vem da ESPN e do serviço de câmbio, que não é nosso nem documentado, e o objeto do leitor de imagem.

### `src/core/`: lógica pura

Sem DOM, sem rede e sem armazenamento (conferido pelo `docs_check.py`). É o que testar primeiro e o que reaproveitar se o projeto ganhar backend.

| Módulo | O que tem |
|---|---|
| `src/core/types.ts` | As formas dos dados: `Fight`, `Odds`, `Result`, `Bet`, `Leg`, `AppState`, `Pricing`, `Cashout`, `Tip` e as demais |
| `src/core/odds.ts` | `r2`, `clamp`, `am2dec`, `devig`, `mo` (odd estimada com margem), mistura histórica por categoria |
| `src/core/espn.ts` | Os leitores da ESPN: `normEvent`, `normOdds`, `attachDistance`, `normResult`, `statValue`. Único lugar que conhece o formato da API |
| `src/core/pricing.ts` | `probs`, `jointModel`, `combo`, `price`, `sideOf`, `overUnder`, `isWomens` |
| `src/core/settlement.ts` | `legOutcome`, `betResult` |
| `src/core/cashout.ts` | `cashout`, `CASHOUT_MARGIN` |
| `src/core/money.ts` | Máscara e leitura de valores, unidade (`unitPct`, `unitValue`), valor em unidades, a stake sugerida para múltipla longa (`suggestedUnits`) e o passo do campo de unidades (`stepUnits`) |
| `src/core/fx.ts` | `normFx`, `fxRate`, `convertState`, `balanceOf` |
| `src/core/tip.ts` | `parseTip`, `tipStake`, `completeTip` (preenche a seleção que o original não mostra), `printedEdge` e `edgeSummary` (a odd do original contra a odd pega) |
| `src/core/history.ts` | Perguntas feitas ao histórico de apostas: `selSig`, `dupBets` (a aposta já está aberta?), `exposure` (quanto já está em jogo numa luta), `openTotals` (o que um conjunto de abertas tem em jogo e pode pagar, em dinheiro e em unidades), `openByEvent` (as abertas por evento, na ordem das lutas), `copyDrop` (quanto a odd caiu em relação ao print), `byOrigin`, `renameOrigin`, `periodBets` e `sinceSummary` |
| `src/core/card.ts` | O card de um evento: `cardSections` (as partes do card, pela hora em que as lutas começam) e `findFights` (as lutas com o que foi digitado no nome dos lutadores) |
| `src/core/index.ts` | O objeto `Core`, com a mesma superfície que os testes sempre usaram |

### `src/app/`: a página

| Módulo | O que tem |
|---|---|
| `src/app/state.ts` | `S` (carteira e apostas), `D` (cache da ESPN), `ui`, `slip`, `imp`, gravação no `localStorage`. `S` é substituído só por `setS`. Também o tema (`applyTheme`), os pares de cor dos cantos (`CORNER_SETS`, `cornerSet`) e `settingsOf`, a lista única do que é configuração |
| `src/app/format.ts` | Moeda da banca, datas pt-BR, categorias de peso, `esc`, e os acessos ao DOM (`$`, `part`, `valOf`, `blurField`) |
| `src/app/api.ts` | `getJSON`, `loadBoard`, `loadOdds`, `loadResults`, `fetchTd` |
| `src/app/fx.ts` | `FX` (cotação guardada) e `loadFx` |
| `src/app/settle.ts` | `legOut`, `settle`, `resultText` |
| `src/app/cashout.ts` | `cashoutOf`, `chanceNow`, as mensagens de cada motivo |
| `src/app/repeat.ts` | `repeatBet`, `doCashout` |
| `src/app/import.ts` | Copiar aposta: leitor de imagem, a lista de apostas lidas (`runImport`, `importImages`, `renderImport`), o que cada item vira agora (`impResolve`: seleções, correções, avisos), `importToSlip` e `placeAll`, que faz várias de uma vez |
| `src/app/sync.ts` | `sync`, `schedule`, `pickEvent` |
| `src/app/helpers.ts` | `wallet`, `statsOf` (os números de um conjunto de apostas encerradas), `priceOf`, `slipCalc`, `groupsOf` e `payoutOf` (o preço por luta e o que uma stake devolve, do jeito que o cupom calcula), `exposureNotes`, valor do cupom em dinheiro e em unidades |
| `src/app/render.ts` | `render` e as três telas, a lista de lutas que se repinta sozinha debaixo da busca (`paintList`), cupom (`renderSheet`, `slipSummary`), gráfico, `place` e as duas partes dele que o lote também usa (`recheck`, `writeBets`) |
| `src/app/events.ts` | Um listener delegado por `data-act`, depósito e troca de moeda |
| `src/app/update.ts` | Registro do service worker, aviso de versão nova (`initUpdates`, `applyUpdate`, `checkNow`) e `builtFrom`, o commit da página |
| `src/main.ts` | Entrada: liga os listeners, expõe `window.__OL`, dispara a primeira sincronização e registra o service worker |
| `src/env.d.ts` | Declarações de tipo de `window.__OL` e do leitor de imagem; os tipos do Vite (import de CSS, `import.meta.env`) vêm por referência |

`src/sw.js` é o service worker. É JavaScript puro, fora dos módulos e do `tsc`: roda em outro contexto, sem página, e o build só o copia para `dist/sw.js` trocando a versão.

Os módulos de `src/app/` se importam em círculo (a tela chama ações, ações repintam a tela). Funciona porque nada é chamado enquanto os módulos carregam: o que roda na carga fica em `src/app/state.ts` (ler o que está salvo e aplicar o tema) e em `src/main.ts`. Código novo não deve chamar função de outro módulo no nível de cima do arquivo.

`window.__OL` expõe `{Core, D, ui, slip, imp, sync, settle, settling, S, FX}` para teste.

Renderização é `innerHTML` a partir do estado. Toda string vinda da ESPN passa por `esc()`. `render()` não repinta a tela se o foco estiver num campo dela, para não derrubar o que a pessoa está digitando. A exceção é o campo de busca da tela de Lutas: com o foco nele, `render()` repinta só a lista de lutas (`#list`), e o campo fica como está.

### Estado no `localStorage`

`oitolados.v1`:
```js
{ v: 1,
  cur: 'BRL'|'USD'|'EUR',        // moeda da banca: todos os valores abaixo estão nela
  conv: [{ t, from, to, rate, date }],   // conversões já feitas (as 20 últimas)
  stakeIn: 'money'|'units',       // como o cupom pede o valor de toda aposta e o que se copia de um print (configuração da Carteira)
  theme: 'light'|'dark',          // tema escolhido; sem o campo, segue o aparelho
  corners: { men, women },        // par de cores dos cantos por tipo de luta: 'green-pink' ou 'purple-orange'; ausente = vermelho e azul
  unitPct: 10,                    // porcentagem da banca que vale uma unidade
  copyDrop: 3|5|10,               // odd mínima ao copiar: quanto a odd de agora pode estar abaixo da do print, em %; ausente = desligada
  seen: 1760000000000,            // até quando a pessoa já viu o que fechou; não é configuração
  deposits: [{ t, v }],
  bets: [{ id, t, type: 'single'|'multi', stake, unit, odd, sgp, legs, status: 'open'|'won'|'lost'|'void'|'cashed', payout, settledAt, cash,
           from, printed }] }   // só em aposta copiada: de quem veio, e a odd que o original dá para a aposta inteira
```
Perna (`legs[]`): `{ fid, eid, key, market, sel, cat, weight, fight, event, date, odd, src: 'real'|'est', out, res, printed }`. `printed` é a odd que o original imprime para aquela seleção, quando a aposta foi copiada de um que a traz. Os textos são copiados na hora da aposta para o histórico continuar legível depois que a luta sai do placar. `weight` é a categoria como a ESPN escreve ("W Flyweight"), usada para a cor do canto; perna antiga não tem.

Configuração nova entra em `settingsOf` (`src/app/state.ts`): é o que um "Zerar simulação" mantém e o que volta com um backup. Hoje são `unitPct`, `stakeIn`, `theme`, `corners` e `copyDrop`. `seen` não é configuração: zerar e restaurar o põem em agora, e um estado de versão antiga, sem ele, recebe o instante da carga, para não anunciar o histórico inteiro. Um estado salvo por versão antiga pode trazer `tip`, que é descartado na carga.

`sgp`: `{ [fid]: odd }` com o preço de cada combinada na mesma luta, fixado na hora da aposta.

`cash`: só em aposta encerrada por cashout: `{ kind: 'refund'|'market', full, chance }`, o retorno possível e a chance usados na oferta.

`unit`: quanto valia uma unidade quando a aposta foi feita. O resultado em unidades do histórico usa esse valor, não a unidade de hoje.

O saldo **não é guardado**: é sempre `depósitos − soma das stakes + soma dos payouts`. Não criar campo de saldo.

`oitolados.cache.v1`: último placar, odds, resultados, quedas e estatísticas, para abrir instantâneo e offline.

`oitolados.fx.v1`: última cotação lida, `{ date, rates: { BRL: 1, USD, EUR }, ts }`.

### Chaves de seleção

| Chave | Mercado |
|---|---|
| `ml:a`, `ml:b` | Vencedor |
| `mov:{a\|b}:{ko\|sub\|dec}` | Método de vitória por lutador |
| `fm:{ko\|sub\|dec}` | Como a luta termina |
| `dist:{yes\|no}` | Vai até a decisão |
| `tot:{o\|u}:{linha}` | Total de rounds (linha X.5 = 2:30 do round seguinte) |
| `rnd:{n}` | Round em que a luta acaba por nocaute ou finalização |
| `wr:{a\|b}:{n}` | Vencedor e round |
| `td:{o\|u}:{linha}` | Total de quedas da luta |
| `tda:{a\|b}:{yes\|no}` | Lutador acerta pelo menos 1 queda |

KO e TKO são um mercado só, como nas casas. Desclassificação conta como KO/TKO, igual à DraftKings.

## Modelo de preço

Odd **real** (`src: 'real'`): vencedor, método por lutador, vai até a decisão e a linha principal de total de rounds, quando a casa publica. Convertida de americana para decimal com 2 casas.

Odd **estimada** (`src: 'est'`, mostrada com `≈`): todo o resto. Sempre deixar visível na interface o que é estimado.

`probs(f, o)`:
- Vencedor: probabilidades sem a margem da casa.
- Método: sem margem a partir das 6 linhas reais. Sem linha, usa a mistura histórica por categoria (`DIV`), com decisão ×0,88 em luta de 5 rounds.
- Se existe linha de "vai até a decisão", a massa de decisão é reescalada para bater com ela.
- Distribuição dos rounds de término: geométrica com razão `g` (padrão 0,7), calibrada por bisseção para bater com a linha real de total de rounds quando existe.

`jointModel(P, st)`: enumera cada desfecho possível (quem vence, como, em que round, em qual metade do round) com sua probabilidade. Quedas de cada lutador seguem binomial negativa (dispersão 1,6) com média `taxa × minutos / 15`, onde os minutos dependem do desfecho. Taxa: `takedownAvg` limitado a [0,15; 5]; 0 vira 0,5; ausente vira 0,9.

Margens: 7% nas odds estimadas simples (limites 1,02 a 51) e 10% nas combinadas (limite 301).

### Combinada na mesma luta (`combo`)

O preço vem da probabilidade conjunta em `jointModel`, nunca do produto das odds.
- Probabilidade conjunta zero: bloqueia como impossível.
- Conjunta acima de 97% da perna mais difícil: bloqueia como redundante.
- Se a combinação é exatamente um mercado que já existe (ex.: `ml:a` + `fm:sub` = `mov:a:sub`), paga a odd desse mercado.
- Nunca paga menos que a melhor perna.

Numa múltipla, cada luta entra uma vez: com a odd da seleção única ou com a odd da combinada. A odd final é o produto entre lutas, arredondado a 2 casas; o pagamento usa a odd arredondada.

## Liquidação

`Core.legOutcome(key, fight, result, td, early)` devolve `'won'`, `'lost'`, `'void'` ou `null` (pendente). Com `early = true` também devolve o que já está matematicamente decidido com a luta rolando; isso é só para exibição, o dinheiro só entra com a luta encerrada.

Regras:
- Luta cancelada ou no contest: tudo anulado.
- Vencedor (D64): decide assim que a luta aparece como encerrada com o vencedor marcado no placar, sem esperar o método ser publicado. Um no contest já lido continua anulando. Os outros mercados esperam o resultado.
- Empate: vencedor anulado, método por lutador perdido, conta como "foi para a decisão".
- Total de rounds: compara round e tempo do fim com a marca de 2:30; exatamente 2:30 anula.
- Quedas: só fecham com a estatística congelada, 2 min depois de a luta aparecer como encerrada (ou 6 h depois do horário). Sem estatística por 2 dias: anula.
- Resultado com nome que o app não reconhece (D64): não anula nada na hora. Por 1 dia (`UNKNOWN_AFTER`) o resultado é pedido de novo a cada sincronização e o nome aparece na aposta ("ainda não reconhecido pelo app"); só depois disso vale como sem método, e aí o que não é vencedor anula. O mesmo prazo vale para a luta encerrada que nunca publica resultado.
- Luta que some do placar: anula 36 h depois do horário.

`Core.betResult`: qualquer perna perdida perde a aposta na hora. Perna anulada tira aquela luta da aposta com odd 1,00 (numa combinada, tira a luta inteira). Tudo anulado devolve a stake.

## Cashout

Regra do Lucas em 09/10/2026 (D21, revista pela D27 em `docs/decisoes.md`). São dois regimes, e o que separa um do outro é se alguma luta da aposta já bateu:

1. **Nenhuma luta da aposta foi decidida:** devolve o valor integral apostado (`kind: 'refund'`). Funciona como cancelar a aposta.
2. **Parte de uma múltipla já bateu e o resto ainda não começou:** oferece um valor de mercado para encerrar (`kind: 'market'`), como numa casa de verdade. Conta: `retorno possível × chance de agora do que falta × (1 − margem)`, com margem de 5% (`CASHOUT_MARGIN`), nunca acima do retorno possível.

Com luta em andamento, cashout e apostas ficam congelados nos dois regimes: a ESPN não publica odd durante a luta, então não existe valor de mercado para calcular.

`Core.cashout(bet, legs, probOf)` é puro. `legs` traz, por perna, `{ state, canceled, out }` da luta (ou `null` se a luta não está no placar) e `probOf(fid, keys)` devolve a chance de agora das seleções daquela luta. Devolve `{ ok: true, kind, value, full, chance }` ou `{ ok: false, why }`:

| `why` | Quando | O que a tela mostra |
|---|---|---|
| `live` | alguma luta da aposta está em andamento | "Cashout congelado" |
| `settling` | uma luta acabou e o resultado dela ainda não foi lido, ou não resta nenhuma luta por começar | "Cashout volta quando sair o resultado" |
| `noprice` | falta a odd de agora de uma luta que resta | "Cashout indisponível agora" |
| `unknown` | alguma luta não está no placar carregado | "Cashout indisponível" |
| `lost` | alguma perna já perdeu (a liquidação fecha a aposta como perdida) | nada |
| `closed` | a aposta não está mais aberta | nada |

- **Retorno possível** (`full`): stake × odd da aposta, tirando as lutas anuladas, com as odds fixadas na hora da aposta (inclusive o preço da combinada em `sgp`).
- **Chance de agora** (`chance`): produto, entre as lutas que restam, da chance das seleções de cada uma. Vem de `price(...).chance(keys)`: para um palpite de vencedor sozinho é a moneyline de agora sem a margem da casa; para qualquer outra seleção ou combinada é o `jointModel`, o mesmo que dá preço às combinadas. Seleção estimada usa a estimativa: a oferta não é mais precisa que a odd `≈` que a originou.
- A oferta muda quando a odd da luta que resta muda. `sync()` recarrega as odds dos eventos que têm luta restante de aposta com luta já encerrada.
- `doCashout` recarrega placar, odds das lutas restantes e resultados antes de pagar (mesma regra de `place()`): sem conexão não faz; se uma luta começou nesse meio tempo, recusa; se o valor mudou, mostra o novo e pede confirmação de novo.
- A aposta fica com `status: 'cashed'`, `payout` igual ao valor pago, `settledAt` e `cash: { kind, full, chance }`. Nas estatísticas o lucro ou prejuízo do cashout entra no resultado, e a aposta fica fora da taxa de acerto, igual a uma anulada.
- Não há cashout parcial (encerrar só uma parte do valor).

## Repetir aposta

O botão "Repetir aposta" aparece em qualquer aposta, aberta ou encerrada, cujas seleções ainda estejam todas abertas e com preço (`repeatable`). `repeatBet` só enche o cupom com as mesmas seleções, o mesmo tipo e o mesmo valor, e abre o cupom. A aposta continua sendo feita pelo botão de sempre, com a odd de agora e a conferência na ESPN. Depois que a luta começa, o botão some. A repetição não leva a origem nem a odd do print da aposta original: é uma aposta nova, na odd de agora.

## Campos de valor e moeda

- **Máscara:** os campos de aposta e de depósito formatam enquanto se digita (`Core.maskMoney`): 1500 vira 1.500 e 12345,6 vira 12.345,6. Ponto é sempre separador de milhar; a primeira vírgula abre os centavos, com no máximo duas casas. `applyMask` mantém o cursor no lugar. Em teclado sem vírgula, um ponto digitado vira vírgula.
- **Leitura:** `Core.parseMoney` ignora os pontos, então "1.000" é mil.
- **Atalhos de valor no cupom:** +10, +50, +100, +10.000, +100.000 e +1.000.000 somam ao que está no campo; "Tudo" coloca o saldo inteiro.
- **Atalhos de valor no depósito** (D39): 100, 500, 1.000 e 5.000 na primeira linha, 10.000, 100.000 e 1.000.000 na segunda, sempre na moeda escolhida para o depósito. Também somam ao que está no campo. O depósito tem máximo de 1 bilhão por depósito.
- **Moeda:** `S.cur` guarda a moeda da banca (BRL, USD ou EUR). O formato numérico é sempre o brasileiro (US$ 1.000,00).

## Moeda e câmbio

Regra do Lucas em 09/10/2026 (D28): **a moeda se troca no cartão de depósito, e trocar converte tudo**.

- O cartão de depósito tem o seletor de moeda. Escolher outra moeda não muda nada sozinho: mostra a cotação e quanto o saldo vira. A troca acontece por um de dois botões: "Converter a banca e depositar" (`deposit`) ou "Só converter a banca, sem depositar" (`convertOnly`). Os dois passam por `switchCurrency`.
- **Banca vazia** (sem depósito e sem aposta): a moeda escolhida vira a da banca, sem consultar cotação.
- **Banca com movimento:** `Core.convertState(S, to, rate)` converte depósitos, stake, payout e `unit` de cada aposta e o `cash.full`. Cada valor é arredondado a centavos, e os centavos que o arredondamento deslocar vão para o maior depósito, de modo que o saldo depois é exatamente o saldo antigo pela cotação. `unit` guarda 4 casas para o resultado em unidades não mudar. Ida e volta entre duas moedas pode diferir em centavos.
- A conversão fica registrada em `S.conv` e a última aparece no cartão de Depósitos.
- **Cotação:** serviço Frankfurter, `https://api.frankfurter.dev/v1/latest?base=BRL&symbols=USD,EUR`, sem chave. `Core.normFx` só aceita resposta com `base` BRL, `date` no formato AAAA-MM-DD e `rates.USD` e `rates.EUR` numéricos e positivos. Par que não envolve o real é calculado passando pelo real (`Core.fxRate`).
- **Cache:** a cotação fica em `oitolados.fx.v1` e só é pedida de novo depois de 12 h (`FX_TTL`). Sem resposta do serviço, vale a cotação guardada, com a data dela na tela; sem nenhuma guardada, a conversão não é feita.
- Se a cotação mudou entre a tela e a confirmação, `switchCurrency` mostra a nova e pede confirmação de novo, como `place()` faz com a odd.
- O que o Frankfurter devolve e se ele aceita chamada do navegador são fatos de terceiro, conferidos em 09/10/2026 (ver `docs/verificacao.md`). `tests/contract_live.py` confere os dois toda semana, e a resposta real gravada está em `tests/fixtures/fx/`.

## Unidade

- Uma unidade vale `unitPct`% da banca. O padrão é 10% da banca; o valor aceito vai de 0,1% a 100% (`Core.unitPct`, `Core.unitValue`).
- **Banca** é o saldo disponível mais o que está em jogo nas apostas abertas. Assim a unidade não encolhe só porque há apostas abertas, e muda sozinha quando a banca muda.
- No cupom há atalhos de 0,5u, 1u, 2u e 3u, que **definem** o valor da aposta (não somam), e o total aparece também em unidades.
- **Múltipla longa** (D66): com cinco seleções ou mais numa múltipla (`LONG_MULTI`, contando as seleções de uma combinada na mesma luta), o cupom e a lista de copiar mostram também os atalhos 0,2u, 0,3u e 0,4u e dizem que é a faixa sugerida (`Core.suggestedUnits`). É sugestão: nada é preenchido sozinho.
- **Setas** (D67): o campo em unidades, no cupom e em cada item da lista de copiar, tem um botão de cada lado que leva à meia unidade seguinte ou anterior (`Core.stepUnits`: de 0,3u sobe para 0,5u e desce para nada). Em dinheiro não há setas.
- **Dinheiro ou unidades é configuração, não escolha por aposta** (D36): o cartão "Valor das apostas", na Carteira, define como o cupom pede o valor (`S.stakeIn`, lembrado entre sessões). A mesma escolha decide o que entra ao copiar um print (D42). O cupom só mostra qual está valendo, com um atalho para as configurações. Em unidades, o campo de valor vira um campo em unidades (`Core.maskUnits`, `Core.parseUnits`: até duas casas, no máximo 9999,99). O cupom guarda as duas formas em paralelo (`slip.stake`, `slip.units`, `slip.unitsN`), então mudar a configuração não perde o valor digitado. Em unidades, o valor em dinheiro acompanha a unidade de agora. Sem banca não há unidade: o cupom pede dinheiro até o primeiro depósito, mesmo configurado em unidades.
- Cada aposta guarda em `unit` o valor da unidade na hora em que foi feita. A Carteira mostra o resultado em unidades somando `(payout − stake) / unit` das apostas encerradas. Aposta antiga, sem `unit`, fica fora dessa conta.
- **Retorno e ganho** (D70): retorno é o que volta se a aposta bater (stake × odd); ganho é o retorno menos a stake. Toda tela que mostra o retorno possível mostra o ganho possível, em dinheiro e em unidades. Em aposta já feita, as unidades são sempre as da unidade do dia dela (`Core.openTotals`); no cupom e na lista de copiar, as da unidade de agora, que é a que a aposta vai guardar. Num total, a aposta sem `unit` conta só em dinheiro, e a tela diz de quantas são as unidades.

## Copiar aposta (print ou texto)

Botão "Copiar aposta de um print ou texto" na tela de Lutas. Aceita texto colado, uma ou várias imagens escolhidas e imagem colada da área de transferência.

- **Imagem:** lida no próprio aparelho por OCR, com a Tesseract.js 7.0.0 e o modelo de português. A biblioteca só é baixada (da jsDelivr, uns 5 MB) quando a pessoa escolhe uma imagem; a imagem não sai do aparelho. As versões ficam na constante `OCR` de `src/app/import.ts`, o script principal é carregado com hash de integridade (`OCR_SRI`), e `tests/package.json` fixa as mesmas versões para o teste rodar com cópias locais.
- **Texto:** `Core.parseTip(text, fights)` procura, entre as lutas que ainda não começaram, a luta citada (nome completo ou sobrenome, sem depender de acento ou caixa, com ou sem o sufixo "Jr." ou "III", que o OCR costuma errar), a seleção, a odd impressa e o valor. Devolve `{ items: [{ fid, key, printedOdd, assumed }], stake, problems, odd, kind, legs }`.
- **Formatos de origem** (D43), todos com caso em `tests/unit.cases.mjs`:
  - Mensagem de canal com a luta e a seleção em linhas separadas, e print de casa com o nome do lutador e o mercado ("Para Ganhar a Luta"). São os dois formatos originais.
  - **Múltipla por lutador:** um lutador de cada luta, juntos por "+" ou "e" ("Fulano + Beltrano - Para vencer a luta"). Cada nome vira uma seleção de vencedor. O nome sozinho, seguido só do "+", herda o mercado de vencedor do último. Só o vencedor é herdado: em "A + B por KO" o A fica como vencedor presumido, com aviso.
  - **Cupom "1X2: V1: A - B"** (também "V2", "W1", "W2"): V1 é o primeiro nome da linha e V2 o segundo, qualquer que seja a ordem no card.
  - **Nomes empilhados:** os dois lutadores em linhas seguidas e o mercado na linha de baixo, com os nomes de novo ou sem eles ("1X2:V2", "Total Acima de (1.5)").
  - **Total:** "Total Acima de (1.5)" e "Abaixo de (2.5)" são rounds. Um mais/menos sem palavra de vencedor é da luta mesmo quando só um dos nomes coube inteiro na linha.
  - **Valor escrito como "1756 BRL"** (ou USD, EUR, "reais"), com ponto ou vírgula decimal. Odd com três casas ("1.614").
  - **Odd lida com dois-pontos** (D52): o leitor de imagem às vezes troca o ponto da odd por dois-pontos ("1:13"). Vale como odd só no fim da linha, com um dígito antes dos dois-pontos, numa linha sem data e sem outra odd. Hora do dia nos cupons vistos vem como "(14:14)" ou "21:40" e não passa.
- **Simples ou múltipla** (`kind`, `legs`): o leitor entende o que o original diz. "Dupla", "tripla", "quádrupla", "quíntupla" e "sêxtupla" são múltiplas de 2 a 6; "múltipla", "acumulador", "acumulada", "combinada" e "parlay" são múltiplas sem número; "Eventos: N" vale como N; "simples" é simples. "Dupla chance" é mercado de outro esporte e não conta. Sem nada dito, uma seleção é simples e várias são uma múltipla. Se o original diz simples e traz várias seleções, cada uma vira uma aposta simples com o mesmo valor.
- **Odd da aposta inteira** (`odd`): quando uma odd só vale para várias seleções (a "dupla" com uma odd, ou o cupom de múltipla que mostra uma), ela é da aposta e não de uma perna. A tela mostra ao lado o que as mesmas seleções pagam agora.
- **O que não foi lido** (`problems`): `empty`, `nofight`, `ambiguous` (o mesmo nome serve a dois lutadores do card), `nomarket` (achou a luta, não a aposta) e `short` (o original diz múltipla de N e só N−1 foram achadas). **Cupom de múltipla costuma imprimir os eventos e o mercado só do primeiro:** as outras seleções não estão na imagem, o leitor não as inventa e a tela avisa.
- **Mercados que entende:** vencedor ("para ganhar/vencer a luta", "ML", "vence", "1X2: V1"), método por lutador ("por KO/TKO", "por finalização", "por decisão"), vencedor e round, como a luta termina, vai ou não até a decisão, mais/menos de X.5 rounds, mais/menos de X.5 quedas (também escritos como "+2.5" e "−2.5"; um traço seguido de espaço é separador, não sinal) e round em que acaba. Só o nome do lutador, sem mercado, vira vencedor e é avisado como presumido.
- **Valor** (`Core.tipStake(stake, S.stakeIn, unidade)`): não existe configuração separada para prints. Vale a mesma do cupom, e ela é seguida à risca: ou se copia o valor, ou se copia a stake (D42, revista pela D68):

  | "Valor das apostas" | O original traz só dinheiro (R$ 1.750,00) | O original traz só unidades ("2u") | O original traz os dois |
  |---|---|---|---|
  | Em R$ (mesmo valor) | aposta os mesmos R$ 1.750,00 | aposta 2u na sua unidade | copia o dinheiro |
  | Em unidades (mesma stake) | aposta **1u**: o dinheiro do print não é copiado | aposta 2u na sua unidade | copia as unidades |

  Se o original não diz valor nenhum, considera 1u. O 1u do print que traz dinheiro, com a configuração em unidades, é regra pedida pelo Lucas e conta como valor dito: a aposta entra no lote. O 1u do original que não diz valor nenhum continua presumido e fora do lote. `parseTip` devolve `stake` como `{ kind: 'units', units, money? }`, `{ kind: 'money', money }` ou `{ kind: 'default' }`; o dinheiro é o primeiro valor do texto (no print é a aposta, não o retorno). Quando o original traz os dois, a tela de copiar diz qual ficou de fora. **Quanto vale a unidade de quem fez o print não é perguntado**: o app não ajusta a aposta de outra pessoa à sua banca. O leitor não olha o símbolo de moeda do print: o número é lido como está.
- **Odd:** a aposta é feita com a odd de agora. A odd do original aparece só para comparar.
- **Colar** (D65): o botão "Colar" lê o texto da área de transferência (`navigator.clipboard.readText`), põe no campo e lê na hora. Só texto: imagem entra por "Escolher fotos" ou pelo gesto de colar na página. Se o navegador recusar, a tela diz para colar no campo.
- **Stake e hora à vista** (D69): cada seleção lida diz a hora da luta; a linha recolhida de cada item traz a hora da primeira luta e a stake dos dois jeitos, na ordem da configuração ("1u · R$ 100,00" em unidades, "R$ 100,00 · 1u" em dinheiro); o total do lote vem também em unidades. Na aba Apostas, o total em jogo de cada evento vem também em unidades, somando a stake de cada aposta pela unidade do dia dela. Cada item aberto diz o ganho se bater, e o total do lote diz o retorno e o ganho se todas baterem, em dinheiro e em unidades (D70).
- **Completar o que o original não mostra** (D45): para cada luta que o original cita sem dizer a aposta (`nomarket`), a tela oferece três caminhos, e `Core.completeTip` aplica o escolhido:
  - **Sozinho, pela lista de seleções:** se outro item da lista é uma *lista de seleções* (não diz valor nem tipo de aposta) e traz uma seleção para aquela luta, ela é usada, com a odd que a lista imprime. A seleção aparece marcada "Completada com a foto N", com "desfazer". Se duas listas discordam, nada é preenchido sozinho.
  - **De outro item**, com um toque: cada seleção de outro item para aquela luta vira um botão "Usar da foto N".
  - **À mão:** um seletor com todos os mercados daquela luta, com a odd de agora.
  A lista de seleções que serviu para completar outra aposta é tratada como referência: fica de fora do lote e sai junto quando o lote é feito. Ela também empresta a odd de cada seleção ao cupom, e a tela confere: se todas as seleções têm odd no print e o cupom tem a odd da aposta, mostra a multiplicação e se bate.
- **Mudar na lista** (D46): cada item tem um campo com o valor (em dinheiro ou em unidades, conforme a configuração) e, com mais de uma seleção, a escolha entre múltipla e simples. Campo vazio volta ao que o original diz.
- **Corrigir o que foi lido** (D51): cada seleção lida tem "trocar", que abre os mercados daquela luta e a opção de tirar a seleção (`ImportOp.edits`, pela posição em `res.items`). A trocada perde a odd do print, que era da seleção lida. Cada foto tem "Ver o texto lido" e "Corrigir no campo de texto", que leva o texto para o campo e tira a foto da lista. A correção feita numa lista de seleções vale também para o que ela completa.
- **Avisos que seguram a aposta fora do lote** (`held`), até o toque em "Apostar mesmo assim":
  - **Já apostada** (D49): existe aposta aberta com exatamente as mesmas seleções, feita do mesmo jeito (`Core.dupBets`: uma múltipla igual, ou a simples de cada seleção). Aposta encerrada não conta.
  - **Repetida na lista** (D49): um item anterior da lista tem as mesmas seleções. Lista de seleções sem valor não conta dos dois lados.
  - **Odd mínima** (D50): `S.copyDrop`, escolhida no cartão "Ao copiar apostas" entre desligada, 3%, 5% e 10%. `Core.copyDrop` compara a odd de agora com a do print: a aposta inteira quando o original dá a odd dela, ou a de todas as seleções, e cada uma é de uma luta; senão, a seleção que mais caiu. Simples são comparadas uma a uma. Sem odd no print não há o que comparar.
  Com um item só não há lote: o aviso aparece e a aposta segue para o cupom normalmente. Corrigir uma seleção desfaz o "mesmo assim".
- **Quanto já está em jogo** (D54): `exposureNotes` diz, para cada luta da aposta nova, quanto já existe em apostas abertas naquela luta (`Core.exposure`; a múltipla conta inteira) e se a nova vai contra alguma: as seleções das duas naquela luta não têm desfecho em comum no `jointModel`. Aparece na tela de copiar e no cupom. É aviso, não bloqueia.
- **De quem é** (D47, D53): um campo opcional na tela de copiar, com as origens já usadas como botões logo abaixo. Vale para todas as apostas que saem dali, pelo cupom ou pelo lote, e fica em `from` na aposta. O cartão "Ao copiar apostas", na Carteira, renomeia uma origem (`Core.renameOrigin`); dar a ela o nome de outra junta as duas, e sem nome novo nada muda. A aba Apostas ganha um filtro por origem (`ui.origin`) quando alguma aposta tem origem.
- **A odd do original fica com a aposta** (D48): `printed` em cada perna e, quando o original dá uma odd para a aposta inteira, `printed` na aposta. `Core.printedEdge(bet)` compara com a odd pega: usa a odd da aposta inteira se houver; senão a das seleções, multiplicadas quando são de lutas diferentes. A lista de apostas mostra "odd do print X, você pegou Y", e a Carteira a média (`Core.edgeSummary`), geral e por origem (`Core.byOrigin`); essa média conta todas as apostas copiadas, abertas ou não, e não segue o período. O cupom leva isso em `slip.copy`, que é apagado quando o cupom esvazia, quando uma aposta é repetida e quando o cupom é começado à mão. A odd da aposta inteira só é gravada se as seleções do cupom ainda são exatamente as do original.
- **Fluxo, com uma aposta:** a tela mostra o que foi entendido e o que não foi, o tipo (simples ou múltipla), o valor e de onde ele veio. "Levar pro cupom" enche o cupom; a aposta é feita pelo botão de sempre.
- **Várias de uma vez** (D44): a tela guarda uma lista (`imp.ops`). Cada foto escolhida é uma aposta da lista; o texto colado é mais uma. Uma foto sozinha, com a lista vazia, passa pelo campo de texto, para dar para corrigir o que o leitor leu. As fotos aparecem numeradas ("Foto 1", "Foto 2"), porque o nome de arquivo que o celular dá não serve para ninguém; a contagem recomeça quando a lista fica sem foto. Com duas ou mais na lista aparece "Apostar as N de uma vez" (`placeAll`): só entram as que estão inteiras (tudo que o original diz foi lido ou completado, tem odd agora, e o valor, de pelo menos 1, veio do original ou foi digitado) e sem aviso pendente. Lista de seleções sem valor não entra sozinha: o "1u" presumido vale no cupom, não no lote. As outras ficam de fora, com o motivo, e podem ir para o cupom uma a uma.
- **Uma linha por item** (D58): numa lista de várias, cada item é uma linha com o rótulo, a situação ("pronta", "referência", "falta seleção", "já apostada", "repetida", "odd caiu", "sem valor", "conferir"), as seleções e o valor, e abre ao toque (`ImportOp.open`). Na primeira vez que aparece, o item que precisa de atenção vem aberto e o que está pronto, ou é só referência, vem recolhido; depois disso só o toque muda. Com um item só não há linha: ele aparece inteiro.
- **O lote tem o mesmo cuidado do cupom:** antes de gravar, `recheck` recarrega placar e odds das lutas envolvidas. Sem conexão não faz; se uma odd mudou ou uma luta começou, não grava nada, mostra a lista com os valores novos e pede de novo. Cada aposta passa pela conta do próprio cupom (`slipCalc`), então múltipla e combinada na mesma luta têm o mesmo preço que teriam lá. Ou todas as que estavam prontas são gravadas, ou nenhuma.
- **Limpar:** o botão "Limpar" apaga o texto, a lista e a mensagem. Fechar a tela não apaga: o que foi lido continua lá até limpar, ir para o cupom ou ser apostado.
- **Limite conhecido:** o leitor de texto foi feito em cima de formatos reais: uma mensagem de canal, um print de casa de apostas, a "dupla" de canal e cinco prints de cupom de outra casa. Formato novo que ele não entender: acrescentar o caso em `tests/unit.cases.mjs` primeiro, com nomes inventados.

## Carteira: período, origem e o que fechou

- **Período** (D55): os números de ganhos e perdas (resultado, unidades, apostado, retornado, ROI, acerto, gráfico e as tabelas por mercado, evento e origem) cobrem "Tudo", "30 dias" ou "Último evento" (`ui.period`, `Core.periodBets`, `statsOf`). 30 dias conta pela data em que a aposta fechou. Último evento é o evento da aposta que fechou por último (a luta mais tardia dela, numa múltipla entre eventos), e uma aposta conta se tem seleção nele. Saldo e depósitos nunca seguem o período. A escolha não é guardada: o app abre em "Tudo".
- **Por origem:** a tabela tem quatro colunas, que é o que cabe em 393 px; o número de apostas, o valor apostado e a odd contra o print ficam embaixo do nome. Embaixo do resultado em dinheiro vai o resultado em unidades (D61), cada aposta medida pela unidade do dia em que foi feita: uma aposta grande decide o resultado em dinheiro de uma origem, e não o em unidades.
- **Desde a última vez** (D56): `Core.sinceSummary(S.bets, S.seen)` soma as apostas que fecharam sozinhas (ganhas, perdidas e anuladas) depois de `S.seen`, em dinheiro e em unidades, com a quebra por origem quando alguma tem origem. A faixa aparece no topo de qualquer aba e fica até o toque em "Ok" ou em "Ver" (que abre as encerradas); os dois gravam `S.seen`. Cashout fica de fora, porque foi a própria pessoa que fez.

## Apostas abertas e o card da luta

- **Abertas por evento** (D60): `Core.openByEvent` agrupa as apostas abertas pelo evento, o que começa primeiro em cima, e dentro dele põe na frente a aposta cuja primeira luta vem antes (o desempate entre lutas do mesmo horário é o lugar da luta no card). Cada grupo abre com um quadro (D70): quantas apostas tem, quanto está em jogo (em dinheiro e em unidades), o retorno e o ganho se todas baterem (o ganho também em unidades), o que apostas uma contra a outra não conseguem fazer. Com apostas em mais de um evento, um quadro igual, "Tudo em aberto", vem antes dos grupos. Múltipla entre eventos vai num grupo "Vários eventos". As encerradas continuam em lista, da mais recente para a mais antiga.
- **Em cada aposta** (D70): a aberta mostra o apostado (em dinheiro e em unidades), a odd, o retorno e, numa linha própria, o "Ganho se bater" em dinheiro e em unidades. A encerrada mostra o resultado em dinheiro e em unidades.
- **No card da luta** (D59): a luta com aposta aberta mostra "N apostas · R$ X · Yu" (`Core.exposure`, a múltipla contando inteira), e o toque leva à aba Apostas.
- **Na Carteira** (D70): embaixo do saldo, o que está em jogo vem também em unidades, com o retorno e o ganho se todas baterem. As tabelas por mercado e por evento trazem o resultado em unidades embaixo do resultado em dinheiro, como a tabela por origem.

## Tela de Lutas: partes do card e busca

- **Partes do card** (D72): a ESPN só diz a hora de cada luta, então as partes saem das horas (`Core.cardSections`): as lutas da hora mais tardia são o card principal; com três horas ou mais, as da mais cedo são as primeiras preliminares; o resto, preliminares. Dentro de cada parte, a luta que acontece por último vem em cima. Com mais de uma parte, botões logo acima da lista ("Tudo", "Principal", "Preliminares", "Primeiras", cada um com o número de lutas) mostram uma parte só (`ui.part`). A escolha não é guardada, e volta a "Tudo" num evento que não tem aquela parte.
- **Busca** (D71): o campo "Buscar" acha a luta por um pedaço do nome de qualquer um dos dois lutadores (`Core.findFights`). Cada palavra digitada tem que aparecer nos nomes; acento e caixa não contam. Procura em todos os eventos carregados, o que está na tela primeiro, e cada luta achada aparece com o evento e a parte do card dela. O nome de outro evento é um botão que abre aquele card com a busca ainda lá; é nesse toque que as odds dele são pedidas, como ao escolher o evento no alto. Luta de outro evento aparece com a odd que estiver guardada, ou "sem odds ainda". **Buscar não faz chamada à ESPN.**
- O "×" limpa o campo e deixa o cursor nele. Escolher um evento no alto limpa a busca. A tecla "buscar" do teclado só guarda o teclado.
- No iPhone um botão tocado não tira o foco do campo. Por isso o que é tocado dentro da lista (uma odd, "Método, rounds e quedas") repinta só a lista, com o campo no lugar, e qualquer toque fora dela solta o campo antes.

## Sincronização

- `loadBoard`: placar de 4 dias atrás (ou 1 dia antes da aposta aberta mais antiga) até 16 dias à frente.
- `loadOdds`: por evento, só lutas `pre`, no máximo a cada 5 min; forçado no botão Atualizar e antes de aceitar aposta.
- Intervalo do laço: 8 s enquanto uma aposta aberta espera por uma luta que já acabou (o resultado, ou as quedas fecharem; `settling`), por até 30 min depois de a luta aparecer como encerrada; 15 s com luta ao vivo, 30 s em noite de evento, 120 s no resto. Para com a aba oculta e sincroniza na volta. Uma página restaurada da memória (`pageshow`) e a volta da conexão (`online`) também sincronizam, se a última sincronização foi há mais de 5 s.
- Antes de gravar uma aposta, `place()` recarrega placar e odds das lutas envolvidas. Se a luta começou, recusa; se a odd mudou, mostra a nova e pede confirmação.
- Apostas travam quando a luta sai de `pre`. Não há aposta ao vivo, e é decisão (D73): a ESPN não publica odd com a luta em andamento. O cashout congela enquanto houver luta da aposta em andamento.
- Só atualiza com o app aberto; ao reabrir, busca os resultados e liquida o que ficou pendente.

## App guardado no aparelho (offline e versão nova)

Pedido do Lucas em 10/10/2026 (D37): entrega mais rápida, abrir sem internet e avisar quando sai versão nova.

- **O que fica guardado:** `dist/sw.js` (de `src/sw.js`) é um service worker. Na instalação ele guarda a página no cache `oito-lados-page-<versão>` e passa a responder toda abertura do app com essa cópia, sem ir à rede. Arquivos de `fonts.googleapis.com`, `fonts.gstatic.com` e `cdn.jsdelivr.net` (fontes e leitor de imagem) vão para o cache `oito-lados-assets-v1` na primeira vez que passam por ele e depois saem do aparelho.
- **O que nunca passa pelo service worker:** ESPN e câmbio. O app precisa deles frescos e já guarda a última resposta no `localStorage` (`oitolados.cache.v1`, `oitolados.fx.v1`), que é o que aparece sem conexão. Sem conexão dá para ver lutas, apostas e carteira; apostar, fazer cashout e converter moeda continuam exigindo rede.
- **Versão:** o build calcula um hash da página sem o carimbo de commit e grava em `sw.js`. Publicação que não muda o app (documentação, testes) gera o mesmo `sw.js` e não incomoda ninguém.
- **Aviso de versão nova:** o navegador baixa o `sw.js` novo, que guarda a página nova e fica **esperando**. A página mostra a faixa "Saiu uma versão nova do app." com o botão "Atualizar agora" (`#update`). O toque manda o service worker novo assumir, a página recarrega já na versão nova e a cópia antiga é apagada. Sem o toque, o app aberto continua o mesmo: trocar a versão debaixo de um cupom aberto não é aceitável. Fechar o app de vez e abrir de novo também entra na versão nova.
- **Quando procura:** ao abrir, toda vez que o app volta para a frente e a cada 30 min com ele aberto (`CHECK_EVERY`). O cartão "Versão do app", na Carteira, mostra o commit da página e tem o botão "Procurar versão nova".
- **Onde não vale:** o service worker só é registrado na página publicada (`import.meta.env.PROD`, por http ou https). No `npm run dev` e na página aberta do disco (como os testes fazem) não há service worker, e o cartão diz isso.
- **Dados não são tocados:** trocar de versão não mexe no `localStorage`.
- **Limites conhecidos:** primeira visita sem conexão não abre (não há o que mostrar). O service worker só guarda resposta que consegue conferir (`res.ok`); arquivo pedido sem CORS chega opaco e não é guardado. Se o leitor de imagem pedir algum assim, ele não funciona sem internet: ler print sem conexão não foi testado e não deve ser prometido. Nada disso foi visto no Safari do iPhone (ver `docs/verificacao.md`).

## Interface

Uma coluna de até 720 px. Barra superior fixa com saldo, barra de abas embaixo (Lutas, Apostas, Carteira), cupom como folha que sobe do rodapé.

Identidade: uma cor para cada canto (vermelho e azul por padrão), dourado para seleção e ação principal. Títulos em Big Shoulders Display, texto em Barlow (Google Fonts, com fallback). Verde e vermelho de ganho/perda são separados das cores de canto.

Tema: claro e escuro, tudo em variáveis CSS no `:root`. Por padrão segue o aparelho (`prefers-color-scheme`); o cartão "Aparência", na Carteira, deixa fixar um dos dois (`S.theme`, D38). `applyTheme` põe a escolha em `data-theme` no `<html>` e acerta a cor das barras do navegador (`theme-color`). A paleta escura aparece duas vezes em `src/styles.css`, uma para "o aparelho pediu" e outra para "a pessoa escolheu"; o `docs_check.py` confere que as duas são iguais.

Cor de canto nas opções: `Core.sideOf(key)` diz de qual lutador é uma seleção (`ml`, `mov`, `wr` e `tda`; o resto é da luta inteira e devolve `null`). Nos mercados, a opção de um lutador ganha a barra e um fundo leve na cor do canto dele, e o cabeçalho da coluna ganha um traço na mesma cor. No cupom, na tela de copiar aposta e na lista de apostas, a seleção leva um quadradinho da cor. Os botões de vencedor não repetem a marca porque já ficam na linha do lutador.

Pares de cor dos cantos (D40): três pares, sempre com a cor quente no lutador `a` (o de cima): vermelho e azul (`red-blue`, o padrão), rosa e verde (`green-pink`), laranja e roxo (`purple-orange`). O cartão "Aparência" deixa escolher um par para as lutas masculinas e outro para as femininas (`S.corners`). `Core.isWomens(weight)` reconhece a luta feminina pela categoria da ESPN começando com "W "; um peso casado feminino não é reconhecido e sai no par das masculinas. O card da luta, ou a marca de uma seleção, leva `data-corners` com o par, e a folha de estilo troca `--ca` e `--cb` ali. Os tons ficam longe do verde de "ganhou" e do dourado de seleção. Aposta antiga, sem `weight` na perna, usa a categoria da luta enquanto ela estiver no placar e depois o par das masculinas.

Legenda dos cantos (D35): com os mercados de uma luta abertos, uma faixa com os dois sobrenomes e a cor de cada canto (`.corners`) fica presa logo abaixo da barra superior enquanto os mercados daquela luta rolam. Toda opção de lutador também leva `title` com o nome e a cor do canto ("Almeida · canto vermelho"); no iPhone não existe ponteiro, então quem resolve lá é a faixa.

Mais e menos de uma linha (rounds e quedas) aparecem como `+2.5` e `−2.5`, com a legenda "+ é mais de, − é menos de" no título do mercado. Esses dois lados têm marca própria (D34, revista pela D41): `Core.overUnder(key)` devolve `'o'` ou `'u'` para `tot` e `td`, e a opção é montada como a de um lutador (barra lateral e fundo leve), mas em tons neutros (`--over` mais forte, `--under` mais claro) e com uma seta (▲ no +, ▼ no −). São neutros de propósito: + e − não pertencem a lutador nenhum, e com três pares de cor nos cantos qualquer cor ali bateria com algum par. A mesma seta marca a seleção no cupom, na tela de copiar aposta e na lista de apostas. Aposta feita antes dessa mudança continua com o texto antigo no histórico, porque o texto é copiado na hora da aposta.

Cuidados de iPhone já aplicados: `viewport-fit=cover` com `env(safe-area-inset-*)`, campos com fonte de 16 px ou mais (evita zoom), metas `apple-mobile-web-app-*`. O Safari pode limpar o `localStorage` de site sem uso por semanas; por isso a Carteira tem backup e restauração por texto.

## Testes

```bash
npm ci                       # Vite e TypeScript
pip install -r tests/requirements.txt && playwright install chromium
npm ci --prefix tests        # arquivos do leitor de imagem usados pelo e2e
scripts/verify.sh            # tudo: tipos, build, docs, core, unit, contract, autoteste da checagem de produção, e2e claro e escuro, settle, pwa e cobertura
scripts/verify.sh --quick    # sem o e2e (poucos segundos)
node tests/core.mjs          # os casos do núcleo, sem navegador
python3 tests/contract_live.py   # API real da ESPN (precisa de internet)
npm run dev                  # servidor de desenvolvimento do Vite
```
O `verify.sh` começa pelo `tsc` e pelo build; se um dos dois falha, os testes nem rodam. **Todo teste usa `dist/`**, o que o build gerou, e não o código-fonte: o que é testado é o que é publicado. Todos abrem `dist/index.html` do disco, menos o `pwa.py`. A única exceção é o `core.mjs`, descrito abaixo.

Os casos do núcleo ficam em `tests/unit.cases.mjs`, uma função de `Core` com tabelas de casos. Regra nova de preço, de liquidação, do leitor ou do histórico entra ali primeiro. Dois executores rodam os mesmos casos (D62):

- `unit.py` carrega a página com a rede bloqueada e roda os casos contra `window.__OL.Core`: é o que testa o que vai para o ar, e o que conta para a cobertura.
- `core.mjs` constrói `src/core` sozinho, com o mesmo Vite, importa o resultado no Node e roda os casos sem página nem navegador. Antes de carregar o núcleo ele arma `window`, `document`, `localStorage` e `fetch` para estourarem se forem tocados: é isso que mostra que o núcleo se sustenta sozinho. O que ele constrói fica em `tests/.build/`, fora do repositório.

Os casos são JavaScript, não TypeScript: muitos passam de propósito dados tortos, que o compilador recusaria. A verificação não ficou mais rápida com isso (o `unit.py` leva pouco mais de um segundo); o ganho é o núcleo provado fora da página.

`contract.py` passa as respostas reais gravadas (ESPN e câmbio) pelos normalizadores. `contract_live.py` faz o mesmo contra a API de verdade (ESPN e o serviço de câmbio), e varre até 160 lutas encerradas dos últimos 120 dias para conferir que todo nome de resultado é classificado e que toda luta com vencedor tem o vencedor marcado no placar: as chamadas saem do Python, com um user agent que identifica o script e a origem de produção, e cada resposta é conferida também pelo cabeçalho de CORS; o navegador só roda os leitores do app. Saída 0 = a API continua batendo; 1 = uma checagem falhou (a API mudou); 3 = inconclusivo, a máquina não alcançou a ESPN. Aviso é normal quando não há card ou odds publicadas. `--mock` testa o próprio script. No GitHub Actions, falhas e avisos aparecem como anotações na execução.

`docs_check.py` confere links, arquivos citados, constantes, chaves de seleção e o saldo esperado contra o código em `src/`, e também a configuração do build (versões exatas, modo `strict`, núcleo sem DOM, módulos documentados).

**Cobertura:** com `OL_COVERAGE=1` (o `verify.sh` completo liga sozinho), cada suíte grava quais funções e trechos do script de `dist/index.html` executou, usando a cobertura precisa do V8. `python3 tests/cov.py` junta tudo, lista as funções nunca chamadas (nome e linha da página gerada) e falha abaixo dos mínimos: 95% das funções e 90% do código. Feature nova entra com teste, senão a cobertura cai e o `verify.sh` acusa. Teste que recarrega a página usa `cov.reload(pg)` em vez de `pg.reload()`: a recarga descarta o script, e no GitHub Actions as contagens de antes da recarga se perdiam (cobertura de 91,7% para um código que mede 97,2%). `cov.stop` para a medição e solta a página: com o medidor ainda preso, uma página fechada continuava contando como aberta para o service worker.

`e2e.py` simula um card de 3 lutas em 4 fases, aposta pela interface (simples, múltipla, combinada, combinação impossível), copia apostas de texto e de prints (inclusive quatro fotos de uma vez: um cupom de múltipla completado pela lista de seleções, à mão e por outro item, seleção trocada e tirada, valor e tipo mudados na lista, aposta repetida na lista, odd mínima, três apostas feitas juntas com a origem e a odd do print guardadas, a fonte fora do ar, uma odd que muda no meio, e as mesmas fotos mandadas de novo com as apostas já abertas), mostra uma parte do card só e busca luta pelo nome (com um segundo evento no placar, e com o toque que não tira o foco do campo), renomeia origem, filtra as apostas por origem, confere a faixa do que fechou desde a última vez e o período da Carteira, faz cashout nos dois regimes (devolução antes do card e valor de mercado com uma perna da múltipla já batida) e confere quando ele congela, troca a moeda da banca com e sem depósito e confere a conversão (cotação simulada, com números redondos e data antiga para não passar por cotação real), imprime preços e liquidações e confere o saldo final esperado de R$ 1.609,59. Capturas em `tests/shots/`. O erro de rede no fim da saída é a fonte do Google bloqueada de propósito.

`settle.py` aposta pela interface na primeira luta do card (vencedor, o outro lado, método, quedas e uma múltipla) e faz a ESPN simulada segurar respostas: primeiro a luta acaba com o vencedor marcado e sem resultado (as duas de vencedor fecham, o resto espera, e a fonte é consultada de novo em menos de 10 s); depois o resultado vem com um nome inventado (nada anula, o nome aparece); depois vem certo (método e quedas fecham). Confere também a volta ao app e a múltipla perdida na luta principal. O `e2e.py` liquida com tudo chegando de uma vez; este é o que cobre a noite em que não chega.

`pwa.py` é o único teste que serve `dist/` por um servidor local, porque service worker não existe em página aberta do disco. Ele publica o build e depois uma "versão seguinte" (outra página, outro `sw.js`) e confere: a página fica guardada, a primeira instalação não anuncia nada, o app abre com o site fora do ar sem pedir a página à rede, a versão nova é anunciada, o app em uso só troca depois do toque, a cópia antiga é apagada, e publicar de novo sem mudar o app não avisa. O teste não consegue interceptar o que o próprio service worker pede; por isso um segundo servidor local faz o papel dos endereços de fontes e do leitor de imagem, e o `sw.js` servido no teste guarda arquivos só dele (sem isso, o teste iria ao Google de verdade a cada abertura). Quais endereços o `sw.js` de verdade guarda é conferido pelo `docs_check.py`. No fim o teste fecha o app com uma versão esperando e abre de novo, para ver que ela assume.

O fixture inventa resultados, então usa só lutadores fictícios. As telas do README saem dele: `OL_EVENT_NAME='UFC Fight Night: Almeida vs. Dunne' python3 tests/e2e.py dark` e copiar de `tests/shots/` para `docs/screenshots/`.

Para testar contra a ESPN de verdade: `npm run dev` e abrir o endereço que o Vite mostrar.

## Publicação

Deploy contínuo pela integração da Vercel com o GitHub: cada PR ganha uma URL de prévia e cada merge na `main` publica em produção. O `vercel.json` manda a Vercel fazer o mesmo que o `verify.sh` e o CI fazem: `npm ci`, `npm run build`, publicar `dist/`. O `.vercelignore` deixa de fora o que o build não lê (testes, documentação). São publicados dois arquivos: `index.html` e `sw.js`. A primeira importação do projeto, ainda sem `vercel.json`, falhou porque a Vercel escolheu sozinha o preset "FastHTML" (Python) e procurou um `main.py`.

O build grava o commit em `<meta name="ol-commit">`. Na Vercel ele vem da variável `VERCEL_GIT_COMMIT_SHA`; fora dela, do `git`.

A Vercel publica o que chegar na `main` sem olhar o CI. Quem garante que só entra código testado é a proteção do branch `main` exigindo os checks `checks`, `e2e (dark)` e `e2e (light)`.

**Merges em sequência podem deixar a produção numa versão antiga.** Em 09/10/2026 os PRs #4, #5, #6 e #7 foram mesclados em menos de um minuto. A Vercel fez um deploy por merge, o do #4 terminou por último e ficou com o endereço de produção: CI verde, quatro deploys com sucesso, e o app no ar sem nada dos outros três PRs (D32). Por isso:

- Mesclar um PR por vez e esperar o deploy, ou mesclar só o último quando um PR já contém os anteriores.
- O workflow `Produção` roda `scripts/check_production.py` depois de cada push na `main`: espera a produção mostrar o carimbo do commit que entrou e **continua olhando por 5 min**, porque o deploy errado pode chegar depois do certo. Falhou: na Vercel, promover o deploy do commit mais recente da `main`, ou fazer um novo merge.
- Em PR o mesmo script só informa qual commit a produção está servindo (`--report`) e nunca falha. `--selftest` testa o script contra um servidor local e roda no `verify.sh`.

**Publicar não troca o app de quem já abriu.** O aparelho mostra a cópia guardada até a pessoa tocar em "Atualizar agora" (seção "App guardado no aparelho"). A checagem de produção lê o servidor, não o aparelho: produção certa e app antigo na mão é o estado normal entre a publicação e o toque.

No iPhone: abrir a URL no Safari → Compartilhar → Adicionar à Tela de Início.

## Ideias para depois

- O resto da PWA: `manifest.json` e ícone em arquivo. O service worker e a abertura sem internet já existem (D37).
- Linhas alternativas de quedas por lutador (hoje só "pelo menos 1").
- Notificação quando uma aposta fecha (exige permissão e um servidor para enviar; o service worker já existe).
- Mostrar quedas no resultado de todas as lutas, não só das que têm aposta.
