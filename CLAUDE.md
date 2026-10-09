# Oito Lados

Simulador de apostas de UFC com **dinheiro fictício** e **odds reais**. Uso pessoal do Lucas, no iPhone 15 (Safari, adicionado à Tela de Início). Não existe e não deve existir dinheiro real, cadastro de pagamento nem nada que pareça uma casa de apostas de verdade. Marca própria ("Oito Lados"); não imitar bet365 nem outra casa.

Idioma da interface: português do Brasil, informal. Comentários no código: inglês.

## Estado atual

- `index.html`: o app inteiro. HTML + CSS + JS num arquivo só, sem build, sem dependências, sem backend. Ícone embutido em base64.
- `tests/e2e.py`: teste ponta a ponta com Playwright e a API da ESPN simulada. Roda no CI (`.github/workflows/ci.yml`) em cada push e PR.
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE` (MIT, Lucas Magalhães).
- Ainda não foi publicado. Plano: hospedagem estática (Vercel é a preferência; GitHub Pages também serve).

Verificado até aqui:
- Simulação completa com API simulada (pré-luta → ao vivo → resultado): preços, liquidação e saldo conferem.
- Leitura de odds rodada contra a API real da ESPN no card de 10/10/2026 (11 de 12 lutas com linha).

Ainda **não** verificado: um evento ao vivo de verdade e a instalação no iPhone.

## Requisitos do produto

1. Saldo fictício: o usuário deposita quanto quiser, quantas vezes quiser.
2. Odds reais de UFC, atualizadas sozinhas a cada semana, sem redeploy.
3. Mercados: vencedor, método (KO/TKO, finalização, decisão), rounds, quedas.
4. Aposta simples, múltipla entre lutas e combinada na mesma luta (com preço coerente, não multiplicação).
5. Apostas acompanham a luta ao vivo e fecham sozinhas com o resultado oficial.
6. Controle de ganhos e perdas: lucro/prejuízo, ROI, acerto, gráfico, quebra por mercado e por evento.
7. Tem que funcionar bem em tela de celular (393 px de largura).

Pedido em aberto, ainda sem definição: "o app tem que escalar". Antes de construir, confirmar com o Lucas qual sentido: (a) multiusuário com login e ranking, (b) sincronizar entre aparelhos, (c) mais esportes e ligas, (d) virar projeto estruturado (TypeScript, build, testes). Os itens (a) e (b) exigem backend e mudam a arquitetura.

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
- Nomes de resultado vistos: `kotko`, `decision---unanimous`. Classificação por regex em `normResult` (ordem: no contest, draw, sub, dec, ko/dq).
- "Fight To Go The Distance" vem como dois preços **sem rótulo de sim/não**. `attachDistance` decide qual é o "sim" comparando com a probabilidade de decisão implícita nas linhas de método.
- A linha de total (`overUnder`) é em rounds.
- `takedownAvg` igual a 0 aparece tanto para trocador puro quanto para estreante sem minutos.
- Lutas sem linha publicada devolvem `items: []`. Na data do teste, o card da semana seguinte não tinha linha nenhuma e o do UFC 333 só tinha vencedor nas duas lutas principais.
- Eventos do Contender Series vêm no mesmo placar e não têm odds; o app esconde.

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
  deposits: [{ t, v }],
  bets: [{ id, t, type: 'single'|'multi', stake, odd, sgp, legs, status: 'open'|'won'|'lost'|'void', payout, settledAt }] }
```
Perna (`legs[]`): `{ fid, eid, key, market, sel, cat, fight, event, date, odd, src: 'real'|'est', out, res }`. Os textos são copiados na hora da aposta para o histórico continuar legível depois que a luta sai do placar.

`sgp`: `{ [fid]: odd }` com o preço de cada combinada na mesma luta, fixado na hora da aposta.

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

## Sincronização

- `loadBoard`: placar de 4 dias atrás (ou 1 dia antes da aposta aberta mais antiga) até 16 dias à frente.
- `loadOdds`: por evento, só lutas `pre`, no máximo a cada 5 min; forçado no botão Atualizar e antes de aceitar aposta.
- Intervalo do laço: 15 s com luta ao vivo, 30 s em noite de evento, 120 s no resto. Para com a aba oculta e sincroniza na volta.
- Antes de gravar uma aposta, `place()` recarrega placar e odds das lutas envolvidas. Se a luta começou, recusa; se a odd mudou, mostra a nova e pede confirmação.
- Apostas travam quando a luta sai de `pre`. Não há aposta ao vivo.
- Só atualiza com o app aberto; ao reabrir, busca os resultados e liquida o que ficou pendente.

## Interface

Uma coluna de até 720 px. Barra superior fixa com saldo, barra de abas embaixo (Lutas, Apostas, Carteira), cupom como folha que sobe do rodapé.

Identidade: cantos vermelho e azul para os lutadores, dourado para seleção e ação principal. Títulos em Big Shoulders Display, texto em Barlow (Google Fonts, com fallback). Tema claro e escuro por `prefers-color-scheme`, tudo em variáveis CSS no `:root`. Verde e vermelho de ganho/perda são separados das cores de canto.

Cuidados de iPhone já aplicados: `viewport-fit=cover` com `env(safe-area-inset-*)`, campos com fonte de 16 px ou mais (evita zoom), metas `apple-mobile-web-app-*`. O Safari pode limpar o `localStorage` de site sem uso por semanas; por isso a Carteira tem backup e restauração por texto.

## Testes

```bash
pip install -r tests/requirements.txt && playwright install chromium
python3 tests/e2e.py dark    # ou light
```
Simula um card de 3 lutas em 4 fases, aposta pela interface (simples, múltipla, combinada, combinação impossível), imprime preços e liquidações e confere o saldo final esperado de R$ 1.584,30. Capturas em `tests/shots/`. O erro de rede no fim da saída é a fonte do Google bloqueada de propósito.

O fixture inventa resultados, então usa só lutadores fictícios. As telas do README saem dele: `OL_EVENT_NAME='UFC Fight Night: Almeida vs. Dunne' python3 tests/e2e.py dark` e copiar de `tests/shots/` para `docs/screenshots/`.

Para testar contra a ESPN de verdade, servir a pasta (`python3 -m http.server`) e abrir no navegador.

## Publicação

```bash
npx vercel --prod      # dentro da pasta com o index.html
```
Depois, no iPhone: abrir a URL no Safari → Compartilhar → Adicionar à Tela de Início.

## Ideias para depois

- PWA de verdade: `manifest.json`, ícone em arquivo, service worker para abrir offline.
- Linhas alternativas de quedas por lutador (hoje só "pelo menos 1").
- Notificação quando uma aposta fecha (exige service worker e permissão).
- Cancelar aposta antes de a luta começar.
- Mostrar quedas no resultado de todas as lutas, não só das que têm aposta.
