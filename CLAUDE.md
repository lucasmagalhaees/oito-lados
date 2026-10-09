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

- Não adicionar backend, login, banco, framework ou etapa de build sem ele pedir.
- Não quebrar o `index.html` em módulos por conta própria.
- O plano de escala (hipóteses a validar, gatilhos, etapas, modelo de dados, fonte de dados, pontos jurídicos) está em [`docs/escala.md`](docs/escala.md). Consultar antes de propor qualquer mudança de arquitetura.

## Regras contra alucinação (valem para qualquer IA trabalhando aqui)

A ordem de confiança é: **código e testes rodando agora** > amostras reais gravadas > documentação > memória. Se dois deles discordam, o de cima ganha e o de baixo é corrigido.

1. **Não diga que funciona sem rodar.** Antes de afirmar que algo está certo, rode `scripts/verify.sh` e mostre a saída. Sem saída, a frase certa é "não verifiquei".
2. **Não invente campo da ESPN.** O app só pode ler campos que aparecem em `tests/fixtures/espn/`. Precisa de um campo novo? Capture a resposta real, grave a amostra, acrescente o caso em `tests/contract.py`, e só então escreva o código.
3. **Separe sempre o verificado do suposto.** Em resposta, commit e PR, diga o que foi testado e o que não foi. O registro oficial é [`docs/verificacao.md`](docs/verificacao.md): um item só sobe para "Verificado" com comando e data.
4. **Número mora no código.** Margens, limites, intervalos e prazos citados aqui são conferidos contra o `index.html` por `tests/docs_check.py`. Mudou um, mude o outro no mesmo commit.
5. **Decisão de produto não se presume.** O que já foi decidido, e por quê, está em [`docs/decisoes.md`](docs/decisoes.md). O que não está lá, pergunte ao Lucas. Decisão nova entra lá com data.
6. **Fato de terceiro tem data.** Limite de hospedagem, preço, comportamento de API: tudo isso envelhece. Cite a data em que foi conferido e reconfira antes de depender.
7. **Resultado inventado só com nome inventado.** `tests/mock_espn.py` usa lutadores fictícios. Amostra real fica em `tests/fixtures/espn/` e não é editada à mão.
8. **Não pule o harness.** O hook em `.claude/settings.json` roda `scripts/verify.sh --quick` quando a tarefa termina e segura o encerramento se falhar. Não desative, não contorne, e não edite um teste só para ele passar: se o teste está errado, explique por quê no PR.
9. **Na dúvida, pare e diga.** Uma resposta incompleta e honesta vale mais que uma completa e inventada.

O que cada peça do harness cobre:

| Peça | Protege contra |
|---|---|
| `scripts/verify.sh` | Afirmar que está certo sem ter rodado nada |
| `tests/unit.py` | Mexer em preço ou liquidação e quebrar uma regra sem notar |
| `tests/contract.py` + `tests/fixtures/espn/` | Escrever leitor para um formato de API imaginado |
| `tests/contract_live.py` (toda semana no GitHub Actions) | A API real mudar e a documentação continuar dizendo o contrário |
| `tests/docs_check.py` | Documentação citar número, arquivo ou chave que não existe mais |
| `tests/e2e.py` | Tudo passar isolado e o fluxo real pela interface estar quebrado |
| Hook de parada (`.claude/hooks/verify-on-stop.sh`) | Encerrar a tarefa com checagem falhando |
| `docs/verificacao.md` | Tratar suposição como fato |
| `docs/decisoes.md` | Depender da memória de uma conversa |

## Estado atual

- `index.html`: o app inteiro. HTML + CSS + JS num arquivo só, sem build, sem dependências, sem backend. Ícone embutido em base64.
- `scripts/verify.sh`: o comando único de verificação.
- `tests/unit.py`: testes do `Core` (conversão de odds, normalizadores, preço, combinadas, liquidação).
- `tests/contract.py`: normalizadores contra respostas reais gravadas em `tests/fixtures/espn/`.
- `tests/contract_live.py`: confere a API real da ESPN (agendado em `.github/workflows/espn-contract.yml`).
- `tests/docs_check.py`: confere a documentação contra o código.
- `tests/e2e.py` + `tests/mock_espn.py`: teste ponta a ponta com Playwright e a ESPN simulada.
- CI em `.github/workflows/ci.yml`: roda tudo isso (menos o ao vivo) em cada PR e em cada push na `main`.
- `.claude/settings.json` + `.claude/hooks/verify-on-stop.sh`: hook de parada do Claude Code.
- `docs/decisoes.md`: tudo que foi decidido e por quê. `docs/verificacao.md`: o que foi verificado e o que não foi. `docs/escala.md`: caminho de escala.
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE` (MIT, Lucas Magalhães).
- Publicado em https://oito-lados.vercel.app. A Vercel está ligada ao repositório e publica em produção a cada merge na `main`.

O que já foi verificado, e o que ainda não foi, está em [`docs/verificacao.md`](docs/verificacao.md). Em resumo: lógica e fluxo cobertos por testes, leitura da ESPN conferida contra respostas reais, CI e deploy de produção funcionando; **não** verificados ainda um evento ao vivo de verdade e a instalação no iPhone.

## Requisitos do produto

1. Saldo fictício: o usuário deposita quanto quiser, quantas vezes quiser.
2. Odds reais de UFC, atualizadas sozinhas a cada semana, sem redeploy.
3. Mercados: vencedor, método (KO/TKO, finalização, decisão), rounds, quedas.
4. Aposta simples, múltipla entre lutas e combinada na mesma luta (com preço coerente, não multiplicação).
5. Apostas acompanham a luta ao vivo e fecham sozinhas com o resultado oficial.
6. Controle de ganhos e perdas: lucro/prejuízo, ROI, acerto, gráfico, quebra por mercado e por evento.
7. Tem que funcionar bem em tela de celular (393 px de largura).
8. Cashout: devolve o valor integral da aposta, só enquanto nenhuma luta dela começou.
9. Repetir uma aposta com um toque, enquanto as seleções dela ainda estiverem abertas.
10. Campos de valor com máscara de milhares.
11. Moeda da simulação: real, dólar ou euro.
12. Gestão de unidade: uma unidade é uma porcentagem da banca, 10% por padrão e ajustável.

Escala fica para depois: ver "Escopo: MVP" acima e `docs/escala.md`.

## Por que um arquivo estático chamando a ESPN direto

Tempo real exige que o navegador consulte a fonte. A API pública da ESPN aceita chamadas de navegador vindas de outra origem (testado a partir de `example.com`), não pede chave e traz odds, status ao vivo, resultado e estatísticas. Então não precisa de servidor.

Risco conhecido: a API não é oficial nem documentada e pode mudar sem aviso. Todo acesso a ela passa pelas funções `norm*` em `Core`, que é onde mexer se o formato mudar.

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
- Nomes de resultado vistos: `kotko`, `decision---unanimous`. Classificação por regex em `normResult` (ordem: no contest, draw, sub, dec, ko/dq).
- "Fight To Go The Distance" vem como dois preços **sem rótulo de sim/não**. `attachDistance` decide qual é o "sim" comparando com a probabilidade de decisão implícita nas linhas de método.
- A linha de total (`overUnder`) é em rounds.
- `takedownAvg` igual a 0 aparece tanto para trocador puro quanto para estreante sem minutos.
- Lutas sem linha publicada devolvem `items: []`. Na data do teste, o card da semana seguinte não tinha linha nenhuma e o do UFC 333 só tinha vencedor nas duas lutas principais.
- Eventos do Contender Series vêm no mesmo placar e não têm odds; o app esconde.
- A ESPN recusa navegador headless (403, sem cabeçalho de CORS). Por isso nenhum teste automatizado chama a ESPN pelo Chromium, e o script de conferência não se disfarça de navegador comum.
- Em 09/10/2026 a ESPN listava duas lutas já encerradas com `format.regulation.periods: 4`. O app usa o número como vem; não foi visto em luta agendada.

## Arquitetura do `index.html`

Um IIFE com blocos nesta ordem:

1. **`Core`**: funções puras, sem DOM. Conversão de odds, normalização da ESPN, modelo de preço, liquidação. É o que testar e o que reaproveitar se o projeto ganhar backend.
2. **Formatação**: moeda BRL, datas pt-BR, tradução de categorias de peso.
3. **Estado persistente**: `S` (carteira e apostas) e `D` (cache de dados da ESPN).
4. **API**: `getJSON`, `loadBoard`, `loadOdds`, `loadResults`, `fetchTd`.
5. **Liquidação**: `legOut`, `settle`, `resultText`.
6. **Laço de sincronização**: `sync`, `schedule`.
7. **Renderização**: `render` e as três telas (`vLutas`, `vApostas`, `vCarteira`), cupom (`renderSheet`, `slipSummary`), gráfico (`bindChart`).
8. **Eventos**: um listener de clique delegado por `data-act`.

`window.__OL` expõe `{Core, D, ui, slip, sync, settle, S}` para teste.

Renderização é `innerHTML` a partir do estado. Toda string vinda da ESPN passa por `esc()`. `render()` não repinta a tela se o foco estiver num campo dela, para não derrubar o que a pessoa está digitando.

### Estado no `localStorage`

`oitolados.v1`:
```js
{ v: 1,
  cur: 'BRL'|'USD'|'EUR',        // moeda da simulação
  unitPct: 10,                    // porcentagem da banca que vale uma unidade
  deposits: [{ t, v }],
  bets: [{ id, t, type: 'single'|'multi', stake, unit, odd, sgp, legs, status: 'open'|'won'|'lost'|'void'|'cashed', payout, settledAt }] }
```
Perna (`legs[]`): `{ fid, eid, key, market, sel, cat, fight, event, date, odd, src: 'real'|'est', out, res }`. Os textos são copiados na hora da aposta para o histórico continuar legível depois que a luta sai do placar.

`sgp`: `{ [fid]: odd }` com o preço de cada combinada na mesma luta, fixado na hora da aposta.

`unit`: quanto valia uma unidade quando a aposta foi feita. O resultado em unidades do histórico usa esse valor, não a unidade de hoje.

O saldo **não é guardado**: é sempre `depósitos − soma das stakes + soma dos payouts`. Não criar campo de saldo.

`oitolados.cache.v1`: último placar, odds, resultados, quedas e estatísticas, para abrir instantâneo e offline.

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
- Empate: vencedor anulado, método por lutador perdido, conta como "foi para a decisão".
- Total de rounds: compara round e tempo do fim com a marca de 2:30; exatamente 2:30 anula.
- Quedas: só fecham com a estatística congelada, 2 min depois de a luta aparecer como encerrada (ou 6 h depois do horário). Sem estatística por 2 dias: anula.
- Resultado final sem método reconhecido depois de 1 dia: vencedor liquida pela marcação de vencedor, o resto anula.
- Luta que some do placar: anula 36 h depois do horário.

`Core.betResult`: qualquer perna perdida perde a aposta na hora. Perna anulada tira aquela luta da aposta com odd 1,00 (numa combinada, tira a luta inteira). Tudo anulado devolve a stake.

## Cashout

Regra definida pelo Lucas em 09/10/2026 (D21 em `docs/decisoes.md`): **devolve o valor integral apostado, e só se a luta não começou**. Com luta em andamento, cashout e apostas ficam congelados.

`Core.cashout(bet, fights)` recebe a luta de cada perna e devolve `{ ok: true, value: stake }` ou `{ ok: false, why }`:

| `why` | Quando | O que a tela mostra |
|---|---|---|
| `live` | alguma luta da aposta está em andamento | "Cashout congelado" |
| `started` | alguma luta da aposta já começou ou terminou (inclui cancelada, que é anulada pela liquidação) | "Cashout encerrado" |
| `unknown` | alguma luta não está no placar carregado | "Cashout indisponível" |
| `closed` | a aposta não está mais aberta | nada |

- Vale para simples, múltipla e combinada. Numa múltipla, basta **uma** luta ter começado para o cashout acabar.
- O valor não depende das odds: é sempre a stake. Não há cashout parcial nem valor de mercado.
- `doCashout` recarrega o placar antes de devolver (mesma regra de `place()`): sem conexão não faz; se a luta começou nesse meio tempo, recusa.
- A aposta fica com `status: 'cashed'`, `payout` igual à stake e `settledAt`. No saldo ela soma zero. Nas estatísticas conta como apostado e retornado, e fica fora da taxa de acerto, igual a uma aposta anulada.

## Repetir aposta

O botão "Repetir aposta" aparece em qualquer aposta, aberta ou encerrada, cujas seleções ainda estejam todas abertas e com preço (`repeatable`). `repeatBet` só enche o cupom com as mesmas seleções, o mesmo tipo e o mesmo valor, e abre o cupom. A aposta continua sendo feita pelo botão de sempre, com a odd de agora e a conferência na ESPN. Depois que a luta começa, o botão some.

## Campos de valor e moeda

- **Máscara:** os campos de aposta e de depósito formatam enquanto se digita (`Core.maskMoney`): 1500 vira 1.500 e 12345,6 vira 12.345,6. Ponto é sempre separador de milhar; a primeira vírgula abre os centavos, com no máximo duas casas. `applyMask` mantém o cursor no lugar. Em teclado sem vírgula, um ponto digitado vira vírgula.
- **Leitura:** `Core.parseMoney` ignora os pontos, então "1.000" é mil.
- **Moeda:** `S.cur` guarda BRL, USD ou EUR, escolhida na Carteira. Muda só o símbolo e o formato (sempre no padrão brasileiro: US$ 1.000,00). **Os valores não são convertidos** e não há câmbio.

## Unidade

- Uma unidade vale `unitPct`% da banca. O padrão é 10% da banca; o valor aceito vai de 0,1% a 100% (`Core.unitPct`, `Core.unitValue`).
- **Banca** é o saldo disponível mais o que está em jogo nas apostas abertas. Assim a unidade não encolhe só porque há apostas abertas, e muda sozinha quando a banca muda.
- No cupom há atalhos de 0,5u, 1u, 2u e 3u, que **definem** o valor da aposta (não somam), e o total aparece também em unidades.
- Cada aposta guarda em `unit` o valor da unidade na hora em que foi feita. A Carteira mostra o resultado em unidades somando `(payout − stake) / unit` das apostas encerradas. Aposta antiga, sem `unit`, fica fora dessa conta.

## Sincronização

- `loadBoard`: placar de 4 dias atrás (ou 1 dia antes da aposta aberta mais antiga) até 16 dias à frente.
- `loadOdds`: por evento, só lutas `pre`, no máximo a cada 5 min; forçado no botão Atualizar e antes de aceitar aposta.
- Intervalo do laço: 15 s com luta ao vivo, 30 s em noite de evento, 120 s no resto. Para com a aba oculta e sincroniza na volta.
- Antes de gravar uma aposta, `place()` recarrega placar e odds das lutas envolvidas. Se a luta começou, recusa; se a odd mudou, mostra a nova e pede confirmação.
- Apostas travam quando a luta sai de `pre`. Não há aposta ao vivo. O cashout segue a mesma trava.
- Só atualiza com o app aberto; ao reabrir, busca os resultados e liquida o que ficou pendente.

## Interface

Uma coluna de até 720 px. Barra superior fixa com saldo, barra de abas embaixo (Lutas, Apostas, Carteira), cupom como folha que sobe do rodapé.

Identidade: cantos vermelho e azul para os lutadores, dourado para seleção e ação principal. Títulos em Big Shoulders Display, texto em Barlow (Google Fonts, com fallback). Tema claro e escuro por `prefers-color-scheme`, tudo em variáveis CSS no `:root`. Verde e vermelho de ganho/perda são separados das cores de canto.

Cuidados de iPhone já aplicados: `viewport-fit=cover` com `env(safe-area-inset-*)`, campos com fonte de 16 px ou mais (evita zoom), metas `apple-mobile-web-app-*`. O Safari pode limpar o `localStorage` de site sem uso por semanas; por isso a Carteira tem backup e restauração por texto.

## Testes

```bash
pip install -r tests/requirements.txt && playwright install chromium
scripts/verify.sh            # tudo: docs, unit, contract, e2e claro e escuro
scripts/verify.sh --quick    # sem o e2e (poucos segundos)
python3 tests/contract_live.py   # API real da ESPN (precisa de internet)
```
`unit.py` carrega a página com a rede bloqueada e exercita `window.__OL.Core` com tabelas de casos. Regra nova de preço ou de liquidação entra ali primeiro.

`contract.py` passa as respostas reais gravadas pelos normalizadores. `contract_live.py` faz o mesmo contra a API de verdade: as chamadas saem do Python, com um user agent que identifica o script e a origem de produção, e cada resposta é conferida também pelo cabeçalho de CORS; o navegador só roda os leitores do app. Saída 0 = a API continua batendo; 1 = uma checagem falhou (a API mudou); 3 = inconclusivo, a máquina não alcançou a ESPN. Aviso é normal quando não há card ou odds publicadas. `--mock` testa o próprio script. No GitHub Actions, falhas e avisos aparecem como anotações na execução.

`docs_check.py` confere links, arquivos citados, constantes, chaves de seleção e o saldo esperado contra o código.

`e2e.py` simula um card de 3 lutas em 4 fases, aposta pela interface (simples, múltipla, combinada, combinação impossível), faz um cashout e confere quando ele congela e quando acaba, imprime preços e liquidações e confere o saldo final esperado de R$ 1.604,40. Capturas em `tests/shots/`. O erro de rede no fim da saída é a fonte do Google bloqueada de propósito.

O fixture inventa resultados, então usa só lutadores fictícios. As telas do README saem dele: `OL_EVENT_NAME='UFC Fight Night: Almeida vs. Dunne' python3 tests/e2e.py dark` e copiar de `tests/shots/` para `docs/screenshots/`.

Para testar contra a ESPN de verdade, servir a pasta (`python3 -m http.server`) e abrir no navegador.

## Publicação

Deploy contínuo pela integração da Vercel com o GitHub: cada PR ganha uma URL de prévia e cada merge na `main` publica em produção. Não há etapa de build: o `vercel.json` fixa o projeto como site estático (`"framework": null`, instalação vazia) e o `.vercelignore` deixa só o `index.html` no site. Sem o `vercel.json`, a Vercel escolheu sozinha o preset "FastHTML" (Python) na importação e o primeiro deploy falhou procurando um `main.py`.

A Vercel publica o que chegar na `main` sem olhar o CI. Quem garante que só entra código testado é a proteção do branch `main` exigindo os checks `checks`, `e2e (dark)` e `e2e (light)`.

No iPhone: abrir a URL no Safari → Compartilhar → Adicionar à Tela de Início.

## Ideias para depois

- PWA de verdade: `manifest.json`, ícone em arquivo, service worker para abrir offline.
- Linhas alternativas de quedas por lutador (hoje só "pelo menos 1").
- Notificação quando uma aposta fecha (exige service worker e permissão).
- Mostrar quedas no resultado de todas as lutas, não só das que têm aposta.
