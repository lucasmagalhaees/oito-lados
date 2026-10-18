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
- Em 17/10/2026 ele pediu a etapa 2: a mesma banca no iPhone e no computador, com Supabase Free e Vercel Hobby (D98, D99). O servidor só guarda uma cópia: a página continua estática, falando com a ESPN, dando preço e liquidando, e funciona igual sem ele. Ver "Sincronizar aparelhos".
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
| `npm run mutation` (Stryker, `stryker.config.mjs`; fora do `verify.sh`) | Os casos do núcleo passarem sem pegar o erro que dizem pegar: troca um `<` por `<=`, um `+` por `-`, apaga um `return`, e vê se algum caso falha |
| `tests/contract.py` + `tests/fixtures/espn/` | Escrever leitor para um formato de API imaginado |
| `tests/contract_live.py` (toda semana no GitHub Actions) | A API real mudar e a documentação continuar dizendo o contrário |
| `tests/docs_check.py` | Documentação citar número, arquivo ou chave que não existe mais |
| `tests/e2e.py` | Tudo passar isolado e o fluxo real pela interface estar quebrado |
| `tests/settle.py` | A aposta só fechar certo quando a ESPN responde tudo de uma vez: resultado que atrasa, ou que vem com um nome que o app não conhece |
| `tests/pwa.py` | Dizer que o app abre sem internet e avisa de versão nova sem nunca ter visto acontecer |
| `tests/cov.py` (cobertura medida pelo navegador) | Achar que está testado sem estar |
| `tests/a11y.py` | Texto com contraste baixo, botão sem nome, campo sem rótulo, alvo de toque pequeno ou foco que some, sem ninguém notar |
| `tests/robust.py` | Um estado, um backup, uma linha do servidor ou um cache estragado (ou de outra versão) derrubar todas as telas |
| `tests/keepalive.mjs`, `tests/schema_check.sh` | A rotina diária deixar entrar quem não é o cron, e o banco deixar alguém ler ou escrever a linha de outro |
| `tests/cloud_live.py` (workflow `Servidor`, no PR que mexe no servidor e toda semana) | O projeto do Supabase de verdade estar desligado, sem o schema ou com as regras abertas, e o código achar que está tudo certo |
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
- `api/keepalive.ts`: a única função de servidor, chamada uma vez por dia pelo cron da Vercel (`vercel.json`) para o projeto do Supabase não pausar. `tests/keepalive.mjs` a roda no Node com a rede trocada, empacotada e também compilada arquivo por arquivo, como a Vercel publica (foi assim que um import sem `.js`, que quebrava a função ao carregar, apareceu).
- `supabase/schema.sql` + `supabase/README.md`: a tabela, as regras de acesso e o passo a passo de montar o projeto. `tests/schema_check.sh` roda o schema num Postgres local e confere as regras. `tests/cloud_live.py` confere o projeto de verdade, pelo workflow `Servidor` (`.github/workflows/servidor.yml`), que roda no PR que mexe no servidor e toda sexta.
- `package.json`, `package-lock.json`, `vite.config.js`, `tsconfig.json`: o build. Sem framework e sem dependência em tempo de execução.
- `scripts/verify.sh`: o comando único de verificação.
- `scripts/check_production.py` + `.github/workflows/producao.yml`: confere se a produção está no commit da `main`.
- `scripts/capture_espn.py`: grava respostas reais da ESPN como amostra em `tests/fixtures/espn/`. De uma máquina que não alcança a ESPN, roda pelo workflow `ESPN contract` com a entrada `capture`, que commita as amostras no branch em que foi disparado (nunca na `main`).
- `tests/unit.cases.mjs`: os casos do `Core` (conversão de odds, normalizadores, preço, combinadas, liquidação, leitor de apostas, histórico), num arquivo só. Dois executores rodam os mesmos casos: `tests/unit.py`, no navegador, contra a página gerada, e `tests/core.mjs`, no Node, contra o núcleo construído sozinho.
- `stryker.config.mjs`: o teste de mutação do núcleo (`npm run mutation`), que planta um erro pequeno de cada vez em `src/core` e roda `node tests/core.mjs`. Relatório em `reports/mutation/`, fora do repositório. Não está no `verify.sh`, porque leva mais de duas horas. A pontuação por módulo está em `docs/verificacao.md`.
- `tests/contract.py`: normalizadores contra respostas reais gravadas em `tests/fixtures/espn/` e `tests/fixtures/fx/`.
- `tests/contract_live.py`: confere a API real da ESPN (agendado em `.github/workflows/espn-contract.yml`).
- `tests/docs_check.py`: confere a documentação contra o código.
- `tests/e2e.py` + `tests/mock_espn.py`: teste ponta a ponta com Playwright e a ESPN simulada.
- `tests/settle.py`: a liquidação pela interface com a ESPN simulada segurando respostas: resultado que atrasa e resultado com nome desconhecido.
- `tests/pwa.py`: o service worker de ponta a ponta, com a página servida por um servidor local: abrir sem conexão e trocar de versão.
- `tests/cov.py`: cobertura de código da página gerada, medida pelo próprio navegador durante os testes.
- `tests/a11y.py`: acessibilidade em 393 px, nos dois temas, em todas as telas: contraste, nomes, rótulos, área de toque e foco do teclado.
- `tests/robust.py`: dados estragados ou de versão antiga no aparelho, num backup e no servidor.
- `tests/package.json`: cópias locais do que o app busca na jsDelivr (os arquivos do leitor de imagem e a fonte das bandeiras), para os testes rodarem sem internet.
- CI em `.github/workflows/ci.yml`: roda tudo isso (menos o ao vivo) em cada PR e em cada push na `main`.
- `.claude/settings.json` + `.claude/hooks/verify-on-stop.sh`: hook de parada do Claude Code.
- `docs/decisoes.md`: tudo que foi decidido e por quê. `docs/verificacao.md`: o que foi verificado e o que não foi. `docs/escala.md`: caminho de escala.
- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `LICENSE` (MIT, Lucas Magalhães).
- Publicado em https://oito-lados.vercel.app. A Vercel está ligada ao repositório e publica em produção a cada merge na `main`.

O que já foi verificado, e o que ainda não foi, está em [`docs/verificacao.md`](docs/verificacao.md). Em resumo: lógica e fluxo cobertos por testes, leitura da ESPN conferida contra respostas reais, CI e deploy de produção funcionando; **não** verificados ainda um evento ao vivo de verdade, a instalação no iPhone e o service worker fora do Chromium dos testes.

## Requisitos do produto

1. Saldo fictício: o usuário deposita quanto quiser, quantas vezes quiser.
2. Odds reais de UFC, atualizadas sozinhas a cada semana, sem redeploy.
3. Mercados: vencedor, método (KO/TKO, submission, decisão), rounds, quedas.
4. Aposta simples, múltipla entre lutas e combinada na mesma luta (com preço coerente, não multiplicação).
5. Apostas acompanham a luta ao vivo e fecham sozinhas com o resultado oficial.
6. Controle de ganhos e perdas: lucro/prejuízo, ROI, acerto, gráfico, quebra por mercado, e a comparação das apostas próprias com as copiadas de tipster (frente a frente, em unidades primeiro, com o cartel, o ROI e quem está na frente), para tudo, para os últimos 7, 15 ou 30 dias ou para o último evento. A lista de apostas pode mostrar só as próprias, só as de tipster ou as de um tipster.
7. Tem que funcionar bem em tela de celular (393 px de largura).
8. Cashout: devolve o valor integral enquanto nenhuma luta da aposta foi decidida; com parte da múltipla já batida, oferece um valor de mercado para encerrar. Congela com luta em andamento.
9. Repetir uma aposta com um toque, enquanto as seleções dela ainda estiverem abertas.
10. Campos de valor com máscara de milhares.
11. Moeda da banca: real, dólar ou euro, escolhida no cartão de depósito. Passar para outra moeda converte a banca inteira pela cotação do dia, com ou sem depósito.
12. Gestão de unidade: uma unidade é uma porcentagem da banca, 10% por padrão e ajustável. O valor da aposta é digitado em dinheiro ou em unidades, conforme a configuração escolhida na Carteira. Em unidades, o campo tem setas de meia em meia unidade. Numa múltipla de cinco seleções ou mais, o app sugere uma stake de 0,2u a 0,4u.
13. Copiar uma aposta a partir de um print (imagem) ou de um texto, com a odd de agora. O valor que entra segue a mesma configuração do cupom, à risca: em dinheiro, o mesmo valor do original; em unidades, a stake do original, e 1u quando ele não diz unidades. Cada aposta lida mostra a stake em unidades e em dinheiro e a hora da luta. Um botão cola o texto ou a imagem da área de transferência, sem precisar salvar o print. Dá para mandar várias fotos de uma vez, cada uma vira uma aposta, e fazer todas juntas. O leitor sabe quando o original é simples e quando é múltipla (dupla, tripla, quádrupla, quíntupla). O cupom de múltipla que não mostra todas as seleções é completado com a foto da lista de seleções, ou à mão. Valor e tipo de cada aposta podem ser mudados na lista, e o que o leitor leu errado pode ser corrigido ali. A aposta copiada guarda de quem veio e a odd do original. Antes de apostar várias de uma vez, o app avisa o que já está apostado, o que está repetido na lista e, se houver um limite configurado, a odd que caiu demais em relação ao print.
14. Mais e menos de uma linha aparecem como + e −, em tons neutros e com seta, e toda opção ligada a um lutador leva a cor do canto dele. Com os mercados de uma luta abertos, uma legenda que não sai da tela lembra de quem é cada cor.
15. Tema automático (segue o aparelho), claro ou escuro, escolhido na Carteira. As cores dos cantos têm três pares (vermelho e azul, rosa e verde, laranja e roxo), escolhidos separadamente para lutas masculinas e femininas.
16. O app fica guardado no aparelho: abre na hora e também sem internet, com os últimos dados que carregou. Quando uma versão nova é publicada, avisa e troca com um toque.
17. Ao reabrir o app, um resumo do que fechou sozinho desde a última vez: quantas apostas, o resultado e a quebra por origem.
18. Antes de apostar numa luta que já tem aposta aberta, o app diz quanto já está em jogo nela e se a aposta nova vai contra a que existe. No card, a luta mostra quantas apostas abertas tem e quanto está em jogo.
19. As apostas abertas aparecem agrupadas por evento, na ordem das lutas, com o total em jogo, o retorno e o ganho se todas baterem.
20. Onde aparece dinheiro em jogo aparece também em unidades, e onde aparece o retorno possível aparece o ganho possível (retorno menos a stake), em dinheiro e em unidades: em cada aposta aberta, em cada evento, no total em aberto, no card da luta, na Carteira, no cupom e na lista de copiar. O resultado de aposta encerrada também vem em unidades.

21. Na tela de Lutas, um campo de busca acha a luta por um pedaço do nome de um lutador, em todos os eventos carregados, sem depender de acento ou caixa.
22. O card de um evento vem separado em card principal, preliminares e primeiras preliminares, e um toque mostra uma parte só.
23. Em cada aposta, cada seleção diz em palavras e em cor onde está: bateu, perdeu, anulada, ao vivo, vai começar, aguardando, não começou ou não contou. A múltipla conta as seleções no alto, e com uma seleção anulada mostra a odd, o retorno e o ganho que passa a pagar.
24. A Carteira abre com a gestão da banca: a banca, o que está em jogo, quanto vale uma unidade e para onde a banca vai se as apostas abertas baterem todas ou perderem todas, com ganho e perda em cores diferentes.
25. Toda aposta que entra pelo "Copiar aposta" é marcada como do tipster; a que é montada no card é do próprio usuário. Cada aposta mostra de quem é.
26. Os detalhes de uma luta trazem as três últimas lutas de cada lutador: vitória ou derrota, como acabou e em que round e tempo. As de todo mundo do card da semana são buscadas sozinhas e ficam guardadas por uma semana.
27. Backup em arquivo, que pode ser mandado pelo Telegram ou guardado nos Arquivos, e restauração a partir do arquivo, mostrando o que ele traz antes de substituir qualquer coisa. O backup por texto continua existindo.
28. Extrato em unidades, sempre à vista na Carteira e sem depender do período escolhido: o resultado em unidades, o cartel (apostas ganhas e perdidas) e o ROI dos últimos 7, 15 e 30 dias e do geral, e de cada evento, com tudo, as apostas próprias e as de tipster lado a lado.
29. A bandeira do país de cada lutador vem antes do nome dele, no card da luta e no quadro das últimas lutas.
30. O que em português seria finalização é escrito "Submission" em toda a interface, e a luta que acabou assim diz qual foi ("Rear Naked Choke"), com o nome que a ESPN dá.
31. Na tela de Lutas, um filtro por país mostra as lutas do card escolhido no alto que têm lutador daquele país. O Brasil tem um botão próprio ("Brasileiros"), sempre ali; cada outro país do card tem o seu ao lado.
32. No alto da tela de Lutas ficam os três próximos cards. O card que a ESPN marca como encerrado sai da tela, e os três seguintes são os que estão lá.
33. Na Carteira, o cartão "Uso da ESPN" conta as chamadas que o app faz à ESPN neste aparelho: quantas, de que tipo, quanto demoram, quanto voltou e quantas falharam, de hoje e dos últimos 7 dias, e hora a hora nas últimas 24 horas. As contagens podem ser exportadas em arquivo ou copiadas como texto.
34. A mesma banca e as mesmas apostas no iPhone e no computador: entrar com e-mail e senha, e o que muda num aparelho aparece no outro. Sem conexão com o servidor, o app funciona como antes e sincroniza quando ele volta.

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
| Card e status ao vivo | `SITE/scoreboard?dates=YYYYMMDD-YYYYMMDD&limit=100` | `events[].competitions[]`: `id`, `date`, `type.abbreviation` (categoria), `format.regulation.periods` (rounds), `status.type.{name,state}`, `status.{period,displayClock}`, `competitors[].{id,order,winner,athlete,records}`; do `athlete`, os nomes e `flag.alt` (o país, em inglês) |
| Odds | `CORE/events/{ev}/competitions/{luta}/odds` | `items[0]`: `provider.name`, `homeAthleteOdds`/`awayAthleteOdds` (`moneyLine`, `current.victoryMethod.{koTkoDq,submission,points}.american`, `athlete.$ref`), `overUnder`, `overOdds`, `underOdds`, `propBets.$ref` |
| Vai até a decisão | o `propBets.$ref` acima, com `limit=100` | itens com `type.name` contendo "Distance"; `odds.american.value` |
| Resultado | `CORE/events/{ev}/competitions/{luta}/status` | `result.{name,displayName,displayDescription}` (a descrição é o nome da submission ou do golpe), `period`, `clock`, `displayClock` |
| Quedas da luta | `CORE/events/{ev}/competitions/{luta}/competitors/{atleta}/statistics` | `splits.categories[].stats[]` com `name == "takedownsLanded"` |
| Média de quedas do lutador | `https://sports.core.api.espn.com/v2/sports/mma/athletes/{atleta}/statistics` | stat `takedownAvg` (quedas por 15 min) |
| Lutas que o lutador já fez | `https://sports.core.api.espn.com/v2/sports/mma/athletes/{atleta}/eventlog` | `events.items[]`: `competition.$ref`, `played` |
| Uma luta passada | o `competition.$ref` acima | `id`, `date`, `type.abbreviation`, `format.regulation.periods`, `competitors[].{id,winner}`, `status.$ref` (o resultado vem desse `status`, no formato de sempre) |

Detalhes que já morderam:
- O placar lista as lutas da primeira preliminar até a luta principal (a principal é o último índice).
- Lutador `a` é o de `order` 1, `b` o de `order` 2. Casa e visitante das odds são mapeados pelo id em `athlete.$ref`.
- `state`: `pre`, `in`, `post`. O objeto `result` só existe no `status` do CORE, não no placar.
- O tempo do fim da luta é lido de `displayClock` ("3:26"); o `clock` numérico é só reserva. Nas amostras de 10/10/2026 ele veio também em lutas que acabaram antes da hora, e é o tempo decorrido em segundos (63 para "1:03").
- A lista de lutas do atleta (`eventlog`) vem da mais recente para a mais antiga, com a luta ainda por acontecer na frente, marcada `played: false`. Vem paginada de 25 em 25; o app só olha a primeira página. As referências (`$ref`) vêm com `http`, e o app troca por `https`.
- A luta, no CORE, traz também `cardSegment` ("Main Card", "Prelims", "Early Prelims"). O placar, que é de onde o app tira o card, não foi visto com esse campo; por isso as partes do card continuam saindo das horas.
- No nível do evento só o `status.type.name` foi visto. `normEvent` aceita `completed`, `state` ou o nome contendo FINAL.
- Nomes de resultado vistos em 160 lutas encerradas, em 10/10/2026: `kotko` (80), `decision---unanimous` (45), `submission` (25), `decision---split` (8), `dq` (1) e `tko---doctors-stoppage` (1). Empate, no contest e decisão majoritária não apareceram. Classificação por regex em `normResult` (ordem: no contest, draw, sub, dec, ko/dq). O `tests/contract_live.py` refaz essa varredura toda semana e falha se aparecer um nome que o app não classifica.
- Nas mesmas 160 lutas, toda luta com vencedor tinha o vencedor marcado no placar, e todas tinham o objeto `result`. Quanto tempo a ESPN leva, depois do fim da luta, para marcar o vencedor e para publicar o resultado não foi medido.
- "Fight To Go The Distance" vem como dois preços **sem rótulo de sim/não**. `attachDistance` decide qual é o "sim" comparando com a probabilidade de decisão implícita nas linhas de método.
- A linha de total (`overUnder`) é em rounds.
- `takedownAvg` igual a 0 aparece tanto para trocador puro quanto para estreante sem minutos.
- Lutas sem linha publicada devolvem `items: []`. Na data do teste, o card da semana seguinte não tinha linha nenhuma e o do UFC 333 só tinha vencedor nas duas lutas principais.
- Eventos do Contender Series vêm no mesmo placar e não têm odds; o app esconde.
- A ESPN recusa navegador headless (403, sem cabeçalho de CORS). Por isso nenhum teste automatizado chama a ESPN pelo Chromium, e o script de conferência não se disfarça de navegador comum.
- Vistos em 10/10/2026, no card ao vivo, pelo resumo de uma ferramenta de leitura de páginas, **sem amostra gravada**:
  - **Empate:** `result.name` "draw" e `displayName` "Draw", sem descrição, e nenhum dos dois lutadores com `winner` no placar. É o que `normResult` já classifica como empate. O `status` desse empate foi gravado depois, como amostra, em `tests/fixtures/espn/status_draw.json`.
  - **Luta prestes a começar:** `status.type.name` "STATUS_PRE_FIGHT" com `state` "in", `period` 0 e `displayClock` "-". O app não mostra "R0": diz "vai começar". Apostas e cashout já travam, porque o `state` é `in`.
  - **Relógio:** numa luta encerrada no round 1, o placar trazia `displayClock` "3:11" e o `status` do CORE "1:49". Somam 5:00: o relógio do placar parece contar o que falta no round, e o do CORE o que já passou. O app mostra o do placar com a luta rolando e fecha a aposta pelo do CORE. Visto numa luta só.
  - **Partes do card:** sete lutas com uma hora e cinco com outra, três horas depois. As lutas do card principal tinham todas a mesma hora.
- **País do lutador** (`flag.alt`): vem em inglês ("Brazil", "England", "USA", "Türkiye", "Democratic Republic of Congo"). Em 11/10/2026 os placares de 120 dias traziam 58 nomes diferentes, e mais "default", que é o que a ESPN escreve para o lutador sem país. Inglaterra, Escócia e País de Gales vêm separados. O `tests/contract_live.py` lista os nomes toda semana e avisa do que o app não tem bandeira.
- **Nome da submission** (`result.displayDescription`): nas 23 submissions de 160 lutas encerradas, em 11/10/2026, todas vieram com nome: "Rear Naked Choke" (10), "Guillotine Choke" (5), "Triangle Choke" (2), "Arm Triangle" (2), "D'Arce Choke", "Armbar", "Von Flue Choke" e "Twister" (1 cada). O app mostra o nome como vem, em inglês.
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
| `src/core/espn.ts` | Os leitores da ESPN: `normEvent`, `normOdds`, `attachDistance`, `normResult`, `statValue`, e os do histórico do atleta (`normEventlog`, `normPastFight`, `statusRef`). Único lugar que conhece o formato da API |
| `src/core/pricing.ts` | `probs`, `jointModel`, `combo`, `price`, `sideOf`, `overUnder`, `isWomens` |
| `src/core/settlement.ts` | `legOutcome`, `betResult`, `oddLeft` (a odd que a aposta paga sem as lutas anuladas) e `legState` (onde está cada seleção, nas palavras da lista de apostas) |
| `src/core/cashout.ts` | `cashout`, `CASHOUT_MARGIN` |
| `src/core/money.ts` | Máscara e leitura de valores, unidade (`unitPct`, `unitValue`), valor em unidades, a stake sugerida para múltipla longa (`suggestedUnits`) e o passo do campo de unidades (`stepUnits`) |
| `src/core/fx.ts` | `normFx`, `fxRate`, `convertState`, `balanceOf` |
| `src/core/tip.ts` | `parseTip`, `tipStake`, `completeTip` (preenche a seleção que o original não mostra), `printedEdge` e `edgeSummary` (a odd do original contra a odd pega) |
| `src/core/history.ts` | Perguntas feitas ao histórico de apostas: `selSig`, `dupBets` (a aposta já está aberta?), `exposure` (quanto já está em jogo numa luta), `openTotals` (o que um conjunto de abertas tem em jogo e pode pagar, em dinheiro e em unidades), `oddNow` (a odd que uma aberta paga agora), `openByEvent` (as abertas por evento, na ordem das lutas), `copyDrop` (quanto a odd caiu em relação ao print), `isTip` (a aposta veio de um tipster?), `byOrigin`, `benchmark` (as próprias contra as de tipster), `renameOrigin`, `periodBets` (com `PERIOD_DAYS`, os períodos que são um número de dias), `statement` (o extrato: as mesmas somas por janela de tempo e por evento) e `sinceSummary` |
| `src/core/flags.ts` | `flagOf`: a bandeira de um país pelo nome em inglês, como a ESPN escreve; nome que a tabela não tem fica sem bandeira. `countryCode`: o código do país, para a página dizer o nome em português |
| `src/core/form.ts` | As últimas lutas de um atleta somadas: `formSummary` (vitórias, derrotas e como as lutas acabaram) e `fightSeconds` (quanto a luta durou). E a leitura de volta do que foi guardado, no aparelho ou no servidor: `readPastFight`, `readForm`, `readForms`, `formRows` (as linhas do servidor que valem agora) e `isAthleteId` |
| `src/core/card.ts` | O card de um evento: `cardSections` (as partes do card, pela hora em que as lutas começam) e `cardsToShow` (os eventos que aparecem no alto: os três próximos que não acabaram), `findFights` (as lutas com o que foi digitado no nome dos lutadores), `fromCountry` (as lutas com lutador de um país) e `countries` (os países que há, e em quantas lutas cada um tem lutador) |
| `src/core/usage.ts` | A contagem das chamadas à ESPN: `usageAdd` (conta uma chamada no dia e no tipo dela), `usageSum` (as somas de um dia em diante, por tipo e no total), `usageHours` (as horas pedidas que têm chamada), `usageRead` (lê o que foi guardado, descartando o que não é contagem) e os tipos de chamada (`USAGE_KINDS`) |
| `src/core/pace.ts` | `retryDelay`: quanto esperar pela próxima sincronização depois de rodadas que falharam, com o teto `RETRY_MAX` |
| `src/core/sync.ts` | Juntar dois aparelhos: `stamp` (as marcas que cada gravação põe: `u` em cada aposta, `setAt`, `epoch`), `mergeStates` (junta a cópia do aparelho com a do servidor), `sameState` e `stateSize` |
| `src/core/cloud.ts` | O servidor: `CLOUD_URL` e `CLOUD_KEY`, `cloudSet`, `cloudHeaders` (como uma chamada é assinada), `TOKEN_MARGIN` e a conferência do e-mail e da senha (`isEmail`, `isPassword`, `MIN_PASSWORD`) |
| `src/core/index.ts` | O objeto `Core`, com a mesma superfície que os testes sempre usaram |

### `src/app/`: a página

| Módulo | O que tem |
|---|---|
| `src/app/state.ts` | `S` (carteira e apostas), `D` (cache da ESPN), `U` (as chamadas à ESPN contadas neste aparelho), `ui`, `slip`, `imp`, gravação no `localStorage`. `S` é substituído só por `setS`. Também o tema (`applyTheme`), os pares de cor dos cantos (`CORNER_SETS`, `cornerSet`) e `settingsOf`, a lista única do que é configuração |
| `src/app/format.ts` | Moeda da banca, datas pt-BR, categorias de peso, `esc`, e os acessos ao DOM (`$`, `part`, `valOf`, `blurField`, e `keepFocus`, que devolve o foco do teclado ao mesmo botão depois de uma repintura) |
| `src/app/api.ts` | `getJSON` (toda chamada passa por ele, dizendo para que é, e é contada), `loadBoard`, `loadOdds`, `loadResults`, `fetchTd`, e `loadForm`, que busca as últimas lutas de uma lista de lutadores |
| `src/app/fx.ts` | `FX` (cotação guardada) e `loadFx` |
| `src/app/settle.ts` | `legOut`, `settle`, `resultText` |
| `src/app/cashout.ts` | `cashoutOf`, `chanceNow`, as mensagens de cada motivo |
| `src/app/repeat.ts` | `repeatBet`, `doCashout` |
| `src/app/backup.ts` | O backup: como texto (`backupText`), como arquivo (`saveBackupFile`, `backupName`, e `handFile`, que entrega qualquer texto como arquivo), o que um backup traz (`peekBackup`, `pickBackupFile`) e a restauração (`restoreFrom`) |
| `src/app/import.ts` | Copiar aposta: leitor de imagem, a lista de apostas lidas (`runImport`, `importImages`, `renderImport`), o que cada item vira agora (`impResolve`: seleções, correções, avisos), `importToSlip` e `placeAll`, que faz várias de uma vez |
| `src/app/sync.ts` | `sync`, `schedule`, `pickEvent`, `weekEvent` (o card da semana) e `preloadForm`, que adianta as últimas lutas de quem está nele |
| `src/app/helpers.ts` | `wallet`, `statsOf` (os números de um conjunto de apostas encerradas), `priceOf`, `slipCalc`, `groupsOf` e `payoutOf` (o preço por luta e o que uma stake devolve, do jeito que o cupom calcula), `exposureNotes`, valor do cupom em dinheiro e em unidades |
| `src/app/render.ts` | `render` e as três telas, a lista de lutas que se repinta sozinha debaixo da busca (`paintList`), cupom (`renderSheet`, `slipSummary`), a folha de baixo (`paintPanel`, que o cupom e a tela de copiar usam), gráfico, `place` e as duas partes dele que o lote também usa (`recheck`, `writeBets`) |
| `src/app/events.ts` | Um listener delegado por `data-act`, depósito e troca de moeda |
| `src/app/update.ts` | Registro do service worker, aviso de versão nova (`initUpdates`, `applyUpdate`, `checkNow`) e `builtFrom`, o commit da página |
| `src/app/cloud.ts` | A sincronização: o login com e-mail e senha (`signIn`, `signOut`), a cópia no servidor (`syncNow`, `queueSync`, `resolveFirst` para o primeiro encontro de dois históricos), `initCloud`, o cartão da Carteira (`cloudHtml`) e as últimas lutas guardadas no servidor (`cloudForms`, `keepForms`) |
| `src/app/usage.ts` | O uso da ESPN: `record` (conta cada chamada, chamado por `getJSON`), o cartão da Carteira (`usageHtml`), e as contagens entregues como arquivo, como texto ou zeradas (`saveUsageFile`, `copyUsage`, `resetUsage`) |
| `src/main.ts` | Entrada: liga os listeners, expõe `window.__OL`, dispara a primeira sincronização e registra o service worker |
| `src/env.d.ts` | Declarações de tipo de `window.__OL` e do leitor de imagem; os tipos do Vite (import de CSS, `import.meta.env`) vêm por referência |

`src/sw.js` é o service worker. É JavaScript puro, fora dos módulos e do `tsc`: roda em outro contexto, sem página, e o build só o copia para `dist/sw.js` trocando a versão.

Os módulos de `src/app/` se importam em círculo (a tela chama ações, ações repintam a tela). Funciona porque nada é chamado enquanto os módulos carregam: o que roda na carga fica em `src/app/state.ts` (ler o que está salvo e aplicar o tema) e em `src/main.ts`. Código novo não deve chamar função de outro módulo no nível de cima do arquivo.

`window.__OL` expõe `{Core, D, ui, slip, imp, sync, settle, settling, S, FX}` para teste.

Renderização é `innerHTML` a partir do estado. Toda string vinda da ESPN passa por `esc()`. `render()` não repinta a tela se o foco estiver num campo dela, para não derrubar o que a pessoa está digitando. A exceção é o campo de busca da tela de Lutas: com o foco nele, `render()` repinta só a lista de lutas (`#list`), e o campo fica como está. Uma repintura troca todos os botões daquela parte; quem usa teclado não perde o lugar porque `keepFocus` devolve o foco ao botão equivalente (mesmo `data-act` e mesmos `data-*`). Abrir a folha de baixo (cupom ou copiar aposta) leva o foco para ela, e ela diz o que é (`aria-label`).

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
           from, printed, copied }] }   // só em aposta copiada: de quem veio, a odd que o original dá para a aposta inteira, e a marca de que é do tipster
```
Perna (`legs[]`): `{ fid, eid, key, market, sel, cat, weight, fight, event, date, odd, src: 'real'|'est', out, res, printed }`. `printed` é a odd que o original imprime para aquela seleção, quando a aposta foi copiada de um que a traz. Os textos são copiados na hora da aposta para o histórico continuar legível depois que a luta sai do placar. `weight` é a categoria como a ESPN escreve ("W Flyweight"), usada para a cor do canto; perna antiga não tem.

Configuração nova entra em `settingsOf` (`src/app/state.ts`): é o que um "Zerar simulação" mantém e o que volta com um backup. Hoje são `unitPct`, `stakeIn`, `theme`, `corners` e `copyDrop`. `seen` não é configuração: zerar e restaurar o põem em agora, e um estado de versão antiga, sem ele, recebe o instante da carga, para não anunciar o histórico inteiro. Um estado salvo por versão antiga pode trazer `tip`, que é descartado na carga.

`sgp`: `{ [fid]: odd }` com o preço de cada combinada na mesma luta, fixado na hora da aposta.

`cash`: só em aposta encerrada por cashout: `{ kind: 'refund'|'market', full, chance }`, o retorno possível e a chance usados na oferta.

`unit`: quanto valia uma unidade quando a aposta foi feita. O resultado em unidades do histórico usa esse valor, não a unidade de hoje.

**Na carga, só entra o que as telas conseguem desenhar** (`soundBet`, `soundDeposit`, `soundEvent` em `src/app/state.ts`): aposta sem stake, sem seleção, ou com seleção sem `fid`, `key` ou `date`; depósito sem valor ou sem instante; e evento ou luta do cache em outro formato ficam de fora. Antes, um item desses derrubava todas as telas, e o app não abria mais. A mesma conferência vale para o backup restaurado e para a cópia do servidor. O que fica de fora não é guardado à parte.

O saldo **não é guardado**: é sempre `depósitos − soma das stakes + soma dos payouts`. Não criar campo de saldo.

`oitolados.cache.v1`: último placar, odds, resultados, quedas, estatísticas e as últimas lutas de cada lutador já buscadas (`form`), para abrir instantâneo e offline. Na carga, o `form` passa por `Core.readForms`: o que não é uma lista de lutas válida é descartado.

`oitolados.fx.v1`: última cotação lida, `{ date, rates: { BRL: 1, USD, EUR }, ts }`.

`oitolados.usage.v1`: as chamadas à ESPN contadas neste aparelho, `{ v: 1, days: { 'AAAA-MM-DD': { peak, k: { board|odds|result|td|astats|form: { n, err, ms, bytes, max } }, h: { '0'..'23': { n, err, bytes, peak, k: { tipo: n } } } } } }` (`h` só nos 7 dias mais recentes) (seção "Uso da ESPN"). Não faz parte do backup, e "Zerar simulação" não mexe nele.

`oitolados.auth.v1`: a sessão no servidor, `{ email, uid, access, refresh, exp }` (seção "Sincronizar aparelhos"). Sem ela, não há sincronização. Não faz parte do backup.

`oitolados.link.v1`: o `uid` da conta com que o histórico deste aparelho já foi juntado. Fica separado da sessão, para sair e entrar de novo não contar como primeira vez.

Para juntar dois aparelhos, `oitolados.v1` ganhou três marcas, postas por `Core.stamp` a cada gravação: `u` em cada aposta (quando ela mudou pela última vez), `setAt` (quando uma configuração mudou) e `epoch` (quando o histórico foi reescrito: aposta ou depósito que sumiu, ou troca de moeda).

### Chaves de seleção

| Chave | Mercado |
|---|---|
| `ml:a`, `ml:b` | Vencedor |
| `mov:{a\|b}:{ko\|sub\|dec}` | Método de vitória por lutador |
| `fm:{ko\|sub\|dec}` | Como a luta termina |
| `dist:{yes\|no}` | Vai até a decisão |
| `tot:{o\|u}:{linha}` | Total de rounds (linha X.5 = 2:30 do round seguinte) |
| `rnd:{n}` | Round em que a luta acaba por nocaute ou submission |
| `wr:{a\|b}:{n}` | Vencedor e round |
| `td:{o\|u}:{linha}` | Total de quedas da luta |
| `tda:{a\|b}:{yes\|no}` | Lutador acerta pelo menos 1 queda |

KO e TKO são um mercado só, como nas casas. Desclassificação conta como KO/TKO, igual à DraftKings. A finalização é escrita "Submission" em toda a interface (D85); as chaves continuam com `sub`.

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

O botão "Repetir aposta" aparece em qualquer aposta, aberta ou encerrada, cujas seleções ainda estejam todas abertas e com preço (`repeatable`). `repeatBet` só enche o cupom com as mesmas seleções, o mesmo tipo e o mesmo valor, e abre o cupom. A aposta continua sendo feita pelo botão de sempre, com a odd de agora e a conferência na ESPN. Depois que a luta começa, o botão some. A repetição não leva a odd do print da aposta original: é uma aposta nova, na odd de agora. Mas a repetição de uma aposta de tipster continua sendo do tipster, com o mesmo nome (D77).

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
- **Mercados que entende:** vencedor ("para ganhar/vencer a luta", "ML", "vence", "1X2: V1"), método por lutador ("por KO/TKO", "por finalização" ou "por submission", "por decisão"), vencedor e round, como a luta termina, vai ou não até a decisão, mais/menos de X.5 rounds, mais/menos de X.5 quedas (também escritos como "+2.5" e "−2.5"; um traço seguido de espaço é separador, não sinal) e round em que acaba. Só o nome do lutador, sem mercado, vira vencedor e é avisado como presumido.
- **Valor** (`Core.tipStake(stake, S.stakeIn, unidade)`): não existe configuração separada para prints. Vale a mesma do cupom, e ela é seguida à risca: ou se copia o valor, ou se copia a stake (D42, revista pela D68):

  | "Valor das apostas" | O original traz só dinheiro (R$ 1.750,00) | O original traz só unidades ("2u") | O original traz os dois |
  |---|---|---|---|
  | Em R$ (mesmo valor) | aposta os mesmos R$ 1.750,00 | aposta 2u na sua unidade | copia o dinheiro |
  | Em unidades (mesma stake) | aposta **1u**: o dinheiro do print não é copiado | aposta 2u na sua unidade | copia as unidades |

  Se o original não diz valor nenhum, considera 1u. O 1u do print que traz dinheiro, com a configuração em unidades, é regra pedida pelo Lucas e conta como valor dito: a aposta entra no lote. O 1u do original que não diz valor nenhum continua presumido e fora do lote. `parseTip` devolve `stake` como `{ kind: 'units', units, money? }`, `{ kind: 'money', money }` ou `{ kind: 'default' }`; o dinheiro é o primeiro valor do texto (no print é a aposta, não o retorno). Quando o original traz os dois, a tela de copiar diz qual ficou de fora. **Quanto vale a unidade de quem fez o print não é perguntado**: o app não ajusta a aposta de outra pessoa à sua banca. O leitor não olha o símbolo de moeda do print: o número é lido como está.
- **Odd:** a aposta é feita com a odd de agora. A odd do original aparece só para comparar.
- **Colar** (D65, revista pela D76): o botão "Colar" lê a área de transferência inteira (`navigator.clipboard.read`). Havendo imagem, ela passa pelo leitor de prints, como uma foto escolhida: é o caminho para o print que foi copiado e não está na galeria. Sem imagem, o texto vai para o campo e é lido na hora. Se o navegador não tiver essa leitura, ou recusar, o botão tenta só o texto (`navigator.clipboard.readText`); se nem isso, a tela diz para colar no campo. O gesto de colar na página continua valendo para imagem.
- **Stake e hora à vista** (D69): cada seleção lida diz a hora da luta; a linha recolhida de cada item traz a hora da primeira luta e a stake dos dois jeitos, na ordem da configuração ("1u · R$ 100,00" em unidades, "R$ 100,00 · 1u" em dinheiro); o total do lote vem também em unidades. Na aba Apostas, o total em jogo de cada evento vem também em unidades, somando a stake de cada aposta pela unidade do dia dela. Cada item aberto diz o ganho se bater, e o total do lote diz o retorno e o ganho se todas baterem, em dinheiro e em unidades (D70).
- **Completar o que o original não mostra** (D45): para cada luta que o original cita sem dizer a aposta (`nomarket`), a tela oferece três caminhos, e `Core.completeTip` aplica o escolhido:
  - **Sozinho, pela lista de seleções:** se outro item da lista é uma *lista de seleções* (não diz valor nem tipo de aposta) e traz uma seleção para aquela luta, ela é usada, com a odd que a lista imprime. A seleção aparece marcada "Completada com a foto N", com "desfazer". Se duas listas discordam, nada é preenchido sozinho.
  - **De outro item**, com um toque: cada seleção de outro item para aquela luta vira um botão "Usar da foto N".
  - **À mão:** o botão "Escolher a aposta nessa luta" abre todos os mercados daquela luta, com a odd de agora, e um toque escolhe (D96).
  A lista de seleções que serviu para completar outra aposta é tratada como referência: fica de fora do lote e sai junto quando o lote é feito. Ela também empresta a odd de cada seleção ao cupom, e a tela confere: se todas as seleções têm odd no print e o cupom tem a odd da aposta, mostra a multiplicação e se bate.
- **Mudar na lista** (D46): cada item tem um campo com o valor (em dinheiro ou em unidades, conforme a configuração) e, com mais de uma seleção, a escolha entre múltipla e simples. Campo vazio volta ao que o original diz.
- **Corrigir o que foi lido** (D51): cada seleção lida tem "trocar", que abre os mercados daquela luta e a opção de tirar a seleção (`ImportOp.edits`, pela posição em `res.items`). Os mercados são botões do app, embaixo do nome de cada mercado e com a odd de agora (`marketPicker`), e não um seletor do sistema (D96). A trocada perde a odd do print, que era da seleção lida. Cada foto tem "Ver o texto lido" e "Corrigir no campo de texto", que leva o texto para o campo e tira a foto da lista. A correção feita numa lista de seleções vale também para o que ela completa.
- **Avisos que seguram a aposta fora do lote** (`held`), até o toque em "Apostar mesmo assim":
  - **Já apostada** (D49): existe aposta aberta com exatamente as mesmas seleções, feita do mesmo jeito (`Core.dupBets`: uma múltipla igual, ou a simples de cada seleção). Aposta encerrada não conta.
  - **Repetida na lista** (D49): um item anterior da lista tem as mesmas seleções. Lista de seleções sem valor não conta dos dois lados.
  - **Odd mínima** (D50): `S.copyDrop`, escolhida no cartão "Ao copiar apostas" entre desligada, 3%, 5% e 10%. `Core.copyDrop` compara a odd de agora com a do print: a aposta inteira quando o original dá a odd dela, ou a de todas as seleções, e cada uma é de uma luta; senão, a seleção que mais caiu. Simples são comparadas uma a uma. Sem odd no print não há o que comparar.
  Com um item só não há lote: o aviso aparece e a aposta segue para o cupom normalmente. Corrigir uma seleção desfaz o "mesmo assim".
- **Quanto já está em jogo** (D54): `exposureNotes` diz, para cada luta da aposta nova, quanto já existe em apostas abertas naquela luta (`Core.exposure`; a múltipla conta inteira) e se a nova vai contra alguma: as seleções das duas naquela luta não têm desfecho em comum no `jointModel`. Aparece na tela de copiar e no cupom. É aviso, não bloqueia.
- **Do tipster ou minha** (D77): toda aposta que sai da tela de copiar, pelo cupom ou pelo lote, é gravada com `copied` e conta como aposta do tipster; a que é montada tocando nas odds do card é do próprio usuário. `Core.isTip` responde de quem é: a marca, ou o que só uma cópia tem (o nome em `from`, ou uma odd do print), o que cobre as apostas copiadas antes de a marca existir. Com alguma aposta de tipster no histórico, cada aposta leva no alto a etiqueta "Tipster" (com o nome, se tiver) ou "Minha", e a aba Apostas ganha o filtro "Todas", "Minhas", "Tipster" e um botão por nome (`ui.origin`).
- **De quem é** (D47, D53): um campo opcional na tela de copiar, com os nomes já usados como botões logo abaixo. Vale para todas as apostas que saem dali e fica em `from` na aposta. Sem nome, a aposta é só de "Tipster" (D80). O cartão "Ao copiar apostas", na Carteira, renomeia um tipster (`Core.renameOrigin`) e dá nome às apostas de tipster que não têm; o tipster a renomear é escolhido entre botões (`ui.orgFrom`), o primeiro já marcado; dar a um o nome de outro junta os dois, e sem nome novo nada muda.
- **A odd do original fica com a aposta** (D48): `printed` em cada perna e, quando o original dá uma odd para a aposta inteira, `printed` na aposta. `Core.printedEdge(bet)` compara com a odd pega: usa a odd da aposta inteira se houver; senão a das seleções, multiplicadas quando são de lutas diferentes. A lista de apostas mostra "odd do print X, você pegou Y", e a Carteira a média (`Core.edgeSummary`), geral e por origem (`Core.byOrigin`); essa média conta todas as apostas copiadas, abertas ou não, e não segue o período. O cupom leva isso em `slip.copy`, que é apagado quando o cupom esvazia, quando uma aposta é repetida e quando o cupom é começado à mão. A odd da aposta inteira só é gravada se as seleções do cupom ainda são exatamente as do original.
- **Fluxo, com uma aposta:** a tela mostra o que foi entendido e o que não foi, o tipo (simples ou múltipla), o valor e de onde ele veio. "Levar pro cupom" enche o cupom; a aposta é feita pelo botão de sempre.
- **Várias de uma vez** (D44): a tela guarda uma lista (`imp.ops`). Cada foto escolhida é uma aposta da lista; o texto colado é mais uma. Uma foto sozinha, com a lista vazia, passa pelo campo de texto, para dar para corrigir o que o leitor leu. As fotos aparecem numeradas ("Foto 1", "Foto 2"), porque o nome de arquivo que o celular dá não serve para ninguém; a contagem recomeça quando a lista fica sem foto. Com duas ou mais na lista aparece "Apostar as N de uma vez" (`placeAll`): só entram as que estão inteiras (tudo que o original diz foi lido ou completado, tem odd agora, e o valor, de pelo menos 1, veio do original ou foi digitado) e sem aviso pendente. Lista de seleções sem valor não entra sozinha: o "1u" presumido vale no cupom, não no lote. As outras ficam de fora, com o motivo, e podem ir para o cupom uma a uma.
- **Uma linha por item** (D58): numa lista de várias, cada item é uma linha com o rótulo, a situação ("pronta", "referência", "falta seleção", "já apostada", "repetida", "odd caiu", "sem valor", "conferir"), as seleções e o valor, e abre ao toque (`ImportOp.open`). Na primeira vez que aparece, o item que precisa de atenção vem aberto e o que está pronto, ou é só referência, vem recolhido; depois disso só o toque muda. Com um item só não há linha: ele aparece inteiro.
- **O lote tem o mesmo cuidado do cupom:** antes de gravar, `recheck` recarrega placar e odds das lutas envolvidas. Sem conexão não faz; se uma odd mudou ou uma luta começou, não grava nada, mostra a lista com os valores novos e pede de novo. Cada aposta passa pela conta do próprio cupom (`slipCalc`), então múltipla e combinada na mesma luta têm o mesmo preço que teriam lá. Ou todas as que estavam prontas são gravadas, ou nenhuma.
- **Limpar:** o botão "Limpar" apaga o texto, a lista e a mensagem. Fechar a tela não apaga: o que foi lido continua lá até limpar, ir para o cupom ou ser apostado.
- **Limite conhecido:** o leitor de texto foi feito em cima de formatos reais: uma mensagem de canal, um print de casa de apostas, a "dupla" de canal e cinco prints de cupom de outra casa. Formato novo que ele não entender: acrescentar o caso em `tests/unit.cases.mjs` primeiro, com nomes inventados.

## Carteira: período, origem e o que fechou

- **Período** (D55): os números de ganhos e perdas (resultado, unidades, apostado, retornado, ROI, acerto, gráfico, a tabela por mercado e a comparação com o tipster) cobrem "Tudo", "7 dias", "15 dias", "30 dias" ou "Último evento" (`ui.period`, `Core.periodBets`, `statsOf`; D83). Os períodos em dias (`Core.PERIOD_DAYS`) contam pela data em que a aposta fechou. Último evento é o evento da aposta que fechou por último (a luta mais tardia dela, numa múltipla entre eventos), e uma aposta conta se tem seleção nele. Saldo e depósitos nunca seguem o período. A escolha não é guardada: o app abre em "Tudo".
- **Extrato em unidades** (D82): com alguma aposta encerrada, o cartão "Extrato em unidades" vem logo abaixo da gestão da banca e **não segue o período**: está sempre inteiro. Uma tabela tem uma linha para 7, 15 e 30 dias e uma para o geral; outra, uma linha por evento, o mais recente em cima (`Core.statement`). Em cada linha, na primeira coluna, o nome, quantas apostas e o resultado em dinheiro; nas outras, o resultado em unidades, o cartel ("5V 3D": apostas ganhas e perdidas; anulada e cashout ficam fora do cartel e entram nas unidades) e o ROI. Com aposta de tipster no histórico são três colunas, "Tudo", "Minhas" e "Tipster", e um ponto dourado marca, em cada linha, quem está na frente pelo ROI (o mesmo critério da D77); sem nenhuma, uma coluna só. A múltipla entre eventos vai numa linha "Vários eventos", para cada aposta estar numa linha só. Aparecem os 5 eventos mais recentes (`STMT_EVENTS`), e um botão mostra todos. Aposta sem `unit` conta no cartel e no dinheiro, e a nota embaixo diz de quantas são as unidades. A tabela por evento que ficava entre os números do período saiu: os eventos estão aqui.
- **Você × tipster** (D77, D83): com alguma aposta de tipster no histórico, dois quadros lado a lado, "Você" e "Tipster", trazem de cada um o resultado em unidades em destaque, o cartel, o ROI e o resultado em dinheiro, e o que está na frente leva a borda dourada e "na frente". Embaixo, a tabela "Você × tipster" põe na primeira linha as apostas próprias ("Minhas") e depois uma linha por tipster; com mais de um, uma linha "Tipster · todos" entre as duas. Em cima, uma frase diz quem está na frente pelo retorno sobre o apostado (`Core.benchmark`: o ROI de cada lado nas apostas encerradas do período), ou que ainda não dá para comparar enquanto um dos lados não tem aposta encerrada. A tabela tem quatro colunas, que é o que cabe em 393 px; o número de apostas, o valor apostado e a odd contra o print ficam embaixo do nome. Embaixo do resultado em dinheiro vai o resultado em unidades (D61), cada aposta medida pela unidade do dia em que foi feita: uma aposta grande decide o resultado em dinheiro, e não o em unidades.
- **Desde a última vez** (D56): `Core.sinceSummary(S.bets, S.seen)` soma as apostas que fecharam sozinhas (ganhas, perdidas e anuladas) depois de `S.seen`, em dinheiro e em unidades, com a quebra entre as próprias e as de cada tipster quando alguma é de tipster. A faixa aparece no topo de qualquer aba e fica até o toque em "Ok" ou em "Ver" (que abre as encerradas); os dois gravam `S.seen`. Cashout fica de fora, porque foi a própria pessoa que fez.

## Apostas abertas e o card da luta

- **Abertas por evento** (D60): `Core.openByEvent` agrupa as apostas abertas pelo evento, o que começa primeiro em cima, e dentro dele põe na frente a aposta cuja primeira luta vem antes (o desempate entre lutas do mesmo horário é o lugar da luta no card). Cada grupo abre com um quadro (D70): quantas apostas tem, quanto está em jogo (em dinheiro e em unidades), o retorno e o ganho se todas baterem (o ganho também em unidades), o que apostas uma contra a outra não conseguem fazer. Com apostas em mais de um evento, um quadro igual, "Tudo em aberto", vem antes dos grupos. Múltipla entre eventos vai num grupo "Vários eventos". As encerradas continuam em lista, da mais recente para a mais antiga.
- **Em cada aposta** (D70): a aberta mostra o apostado (em dinheiro e em unidades), a odd, o retorno e, numa linha própria, o "Ganho se bater" em dinheiro e em unidades. A encerrada mostra o resultado em dinheiro e em unidades.
- **Onde está cada seleção** (D74): cada seleção de uma aposta é um bloco com a borda na cor do estado, a marca à esquerda e, à direita, embaixo da odd, uma etiqueta com o estado em palavras (`Core.legState`): "Bateu", "Perdeu", "Anulada", "Ao vivo", "Vai começar" (a ESPN já pôs a luta em andamento e o primeiro round não começou), "Aguardando" (a luta acabou e o resultado ainda não saiu), "Não começou" e "Não contou" (a aposta fechou sem precisar daquela seleção: a múltipla perdida em outra luta, ou o cashout). Com a luta rolando, o que já está decidido no papel aparece como "Bateu" ou "Perdeu", com "já bateu" ou "já perdeu" na linha da luta; o dinheiro só entra com a luta encerrada.
- **A múltipla conta as seleções** (D74): toda aposta com mais de uma seleção tem, embaixo do título, a contagem por estado ("1 bateu · 1 ao vivo · 1 não começou").
- **Seleção anulada numa múltipla** (D74): o bloco diz "Sai da múltipla: esta luta passa a valer odd 1.00." e mostra a odd riscada ao lado do 1.00. A odd, o retorno e o ganho da aposta passam a ser os que ela paga agora (`Core.oddLeft`), com "era X" embaixo da odd, e os totais do evento, de tudo em aberto e da Carteira acompanham (`Core.openTotals` com o que cada seleção já virou). Só conta o que está resolvido de vez (`legOut` sem o `early`). A aposta encerrada como ganha com uma seleção anulada mostra a mesma odd reduzida.
- **Números longos** (D75): os quadros de três números (do evento, de tudo em aberto e da gestão da banca) passam a dois por linha quando algum número tem mais de 12 caracteres ("R$ 100.000,00"), em vez de quebrar o número no meio. No rodapé de cada aposta a coluna da odd é mais estreita que as de dinheiro.
- **No card da luta** (D59): a luta com aposta aberta mostra "N apostas · R$ X · Yu" (`Core.exposure`, a múltipla contando inteira), e o toque leva à aba Apostas.
- **Na Carteira** (D70, revista pela D75): embaixo do saldo, o cartão "Gestão da banca" tem três números lado a lado (a banca, o que está em jogo, com unidades e número de apostas, e quanto vale uma unidade) e, havendo aposta aberta, dois quadros: "Se todas baterem", em verde, com o ganho em dinheiro e em unidades, o retorno e para quanto a banca vai (saldo mais o retorno); e "Se todas perderem", em vermelho, com a perda e a banca que sobra (o saldo). Com uma aposta só, "Se bater" e "Se perder". O total depositado fica numa linha no fim. A tabela por mercado traz o resultado em unidades embaixo do resultado em dinheiro, como a tabela por origem; os eventos estão no extrato em unidades (D82).

## Tela de Lutas: partes do card e busca

- **Os cards no alto** (D90, revista pela D91): `Core.cardsToShow` escolhe, entre os eventos que a ESPN lista, os que aparecem: os 3 próximos que ainda não acabaram (`NEXT_CARDS`), contando o card em andamento como um dos três. **O card encerrado não aparece**: sai da tela assim que a ESPN marca o evento como encerrado, e os três seguintes são os que estão lá. O que decide é a marca da ESPN (`completed`, lida por `normEvent`), **nunca a data**: card de sábado acaba de madrugada, já no domingo, e um filtro por dia erraria. Um card mais à frente que tenha aposta aberta aparece também. O Contender Series fica de fora, e o evento que a ESPN nunca marca como encerrado sai depois de 5 dias (`RECENT_CARD`). O app abre no próximo card (`weekEvent`). As lutas de um card encerrado não ficam à vista; o resultado das que tinham aposta está na aba Apostas.
- **Partes do card** (D72): a ESPN só diz a hora de cada luta, então as partes saem das horas (`Core.cardSections`): as lutas da hora mais tardia são o card principal; com três horas ou mais, as da mais cedo são as primeiras preliminares; o resto, preliminares. Dentro de cada parte, a luta que acontece por último vem em cima. Com mais de uma parte, botões logo acima da lista ("Tudo", "Principal", "Preliminares", "Primeiras", cada um com o número de lutas) mostram uma parte só (`ui.part`). A escolha não é guardada, e volta a "Tudo" num evento que não tem aquela parte.
- **Busca** (D71): o campo "Buscar" acha a luta por um pedaço do nome de qualquer um dos dois lutadores (`Core.findFights`). Cada palavra digitada tem que aparecer nos nomes; acento e caixa não contam. Procura em todos os eventos carregados, o que está na tela primeiro, e cada luta achada aparece com o evento e a parte do card dela. O nome de outro evento é um botão que abre aquele card com a busca ainda lá; é nesse toque que as odds dele são pedidas, como ao escolher o evento no alto. Luta de outro evento aparece com a odd que estiver guardada, ou "sem odds ainda". **Buscar não faz chamada à ESPN.**
- **Filtro por país** (D86, revista pela D87): logo abaixo da busca, uma fileira de botões que rola para o lado: "Brasileiros (N)", sempre o primeiro e sempre ali (`HOME_LAND`), e um botão para cada outro país que tem lutador **no card escolhido no alto**, o de mais lutas primeiro, pelo nome em português e com o número de lutas (`Core.countries`). Tocar num mostra as lutas desse card em que um dos dois lutadores é daquele país (`Core.fromCountry`); um segundo toque solta; um país por vez. **O filtro olha só o card na tela**, e continua ligado ao trocar de card: o país escolhido que não tem ninguém no card novo fica na fileira com "(0)", para poder ser solto. Com um nome digitado na busca, a luta tem que passar pelos dois, e aí a busca também fica nesse card. A escolha não é guardada entre uma abertura do app e outra (`ui.land`). O lutador sem país ("default") não tem botão; o país que o app não tem bandeira tem, com o nome que a ESPN dá. **Filtrar não faz chamada à ESPN.**
- **Com mouse, a fileira quebra em linhas** (D89): uma fileira que rola para o lado serve para o dedo. No computador não há como arrastá-la, e o botão que não cabe fica cortado e fora de alcance. Onde o aparelho aponta com mouse (`hover: hover` e `pointer: fine`), a fileira de países e a de eventos, no alto, quebram em quantas linhas precisarem; no toque continuam numa linha só.
- **São botões do app, não a lista do aparelho** (D87): a primeira versão usava um seletor do sistema, e o Lucas o viu branco no tema escuro. Num seletor desses, a lista que abre é desenhada pelo aparelho, com as cores dele. **O app não tem nenhum** (D96): os três que sobravam, o do tipster a renomear e os dois de mercados na tela de copiar aposta, também viraram botões do app, e o `docs_check.py` confere que nenhum volta.
- **Nome do país em português:** a ESPN manda o nome em inglês. A página pede ao aparelho o nome do país pelo código dele (`Core.countryCode` e `Intl.DisplayNames`, em `landName`); Inglaterra, Escócia e País de Gales são escritos à mão; o país que a tabela não tem fica como veio.
- O "×" limpa o campo e deixa o cursor nele. Escolher um evento no alto limpa a busca. A tecla "buscar" do teclado só guarda o teclado.
- No iPhone um botão tocado não tira o foco do campo. Por isso o que é tocado dentro da lista (uma odd, "Método, rounds e quedas") repinta só a lista, com o campo no lugar, e qualquer toque fora dela solta o campo antes.

## Últimas lutas de cada lutador

Pedido do Lucas em 10/10/2026 (D57, feito na D79): nos detalhes de uma luta, as três últimas lutas de cada um.

- **Onde aparece:** ao abrir os mercados de uma luta ("Método, rounds e quedas"), logo abaixo da legenda dos cantos, um quadro "Últimas 3 lutas" com uma coluna por lutador, na cor do canto dele. Em cada coluna: o cartel recente ("2V 1D", e "1E" para o que ninguém venceu), "Como acabaram" (quantas por KO/TKO, por submission e por decisão, **de quem quer que tenha vencido**) e um bloco por luta: V, D ou E e o método; embaixo, o nome da submission, quando foi uma e a ESPN diz qual (D85); e, na última linha, o round e o tempo em que acabou (ou o número de rounds, numa decisão) e o mês e o ano. Cada coisa na sua linha porque a coluna tem meia tela. O nome de cada lutador vem com a bandeira do país (D84).
- **De onde vem:** `loadForm` pede a lista de lutas do atleta (`eventlog`), fica com as 3 primeiras já lutadas (`FORM_FIGHTS`) e, para cada uma, pede a luta e o `status` dela. `Core.normPastFight` junta os dois; o resultado é lido por `normResult`, como o de qualquer luta. Não traz o nome do adversário, que custaria mais uma chamada por luta.
- **Quanto custa:** 7 chamadas por lutador (1 da lista e 2 por luta), 14 por luta do card, umas 170 para um card de 12 lutas, uma vez por semana.
- **Quando busca** (D80, que revê a D79): o card da semana (`weekEvent`: o próximo evento que ainda não acabou) é adiantado sozinho. Depois de cada sincronização, `preloadForm` busca as últimas lutas de quem ainda tem luta por fazer nesse card e ainda não está guardado, 3 lutadores por vez (`FORM_AT_ONCE`) e uma chamada depois da outra para cada um. Corre ao lado do laço de sincronização, sem segurá-lo. Se a leitura para no meio, só é tentada de novo depois de 10 min (`FORM_RETRY`). Para luta de outro evento, a busca acontece ao abrir os mercados dela, como antes.
- **Guardado:** o que foi lido fica em `D.form`, por atleta, dentro de `oitolados.cache.v1`, e vale por 7 dias (`FORM_TTL`). Passado o prazo, a lista é pedida de novo (1 chamada) e só a luta que ainda não estava guardada é buscada, porque luta passada não muda. O lutador de quem ninguém pede nada há 35 dias (`FORM_KEEP`) sai do que está guardado. O que foi guardado por uma versão que ainda não lia como cada luta acabou (`desc`) não vale como lido (`formFresh`): é buscado de novo, uma vez, para trazer o nome da submission.
- **Guardado também no servidor** (D103): com login, antes de ir à ESPN, `loadForm` pede ao servidor, numa chamada só (`cloudForms`), o que ele tem dos lutadores que faltam, lido nos últimos 7 dias. O que vem passa por `Core.formRows`, que confere lutador por lutador e luta por luta, e só então vai para `D.form`, sem chamada à ESPN. O que for lido da ESPN é gravado lá numa chamada só (`keepForms`), sem ninguém esperar. Assim o segundo aparelho não refaz as ~170 chamadas do card que o primeiro já fez. Cada pessoa tem as suas linhas (tabela `form_cache`): ninguém lê o que outra gravou, então ninguém consegue pôr lutas inventadas na tela de outro. O servidor tem 5 s para responder (`FORM_CLOUD_WAIT`); fora do ar, lento ou sem login, a ESPN, como sempre. Leitura do servidor não conta no "Uso da ESPN".
- **Tudo ou nada:** se uma das chamadas de um atleta falha, nada dele é guardado e a coluna diz "Não deu pra buscar agora"; abrir a luta de novo tenta outra vez, e a rodada seguinte do adiantamento também. Assim a lista nunca fica com uma luta a menos sem avisar.
- **Estreante:** lista sem luta já feita mostra "Nenhuma luta anterior na ESPN."
- **Limites conhecidos:** a ESPN lista também lutas fora do UFC (referências em `leagues/other`), e o app segue a referência como vem; a resposta de uma dessas não foi gravada como amostra. Luta com resultado sem método publicado aparece como "resultado não informado", com o vencedor que o placar marcar.

## Backup

Pedido do Lucas em 11/10/2026 (D81): baixar um arquivo que possa ser mandado pelo Telegram.

- **Salvar:** "Salvar backup em arquivo" monta um arquivo `oito-lados-backup-AAAA-MM-DD-HHMM.json` (`backupName`) com tudo o que está em `oitolados.v1`, mais `app` e `savedAt` (`backupText`). Onde a página pode entregar um arquivo à folha de compartilhamento do aparelho (`navigator.canShare` com `files`), ela abre: dali o arquivo vai para o Telegram, para os Arquivos ou para onde a pessoa quiser. Fechar a folha sem escolher não faz nada. Onde não pode, ou se o compartilhamento falha, o arquivo é baixado.
- **Restaurar:** "Restaurar de um arquivo" abre o seletor de arquivos. O arquivo escolhido é lido e **mostrado antes**: o nome, quando foi salvo, quantas apostas (e quantas abertas) e quanto foi depositado (`peekBackup`). Só o toque em "Restaurar e substituir tudo" troca o que está no aparelho (`restoreFrom`); "Cancelar" não muda nada. Arquivo que não é um backup dá aviso e não muda nada.
- **Texto:** "Copiar como texto" e "Colar um texto" continuam, em botões menores. É o mesmo conteúdo do arquivo; um backup feito de um jeito restaura pelo outro.
- **O que volta:** depósitos, apostas, conversões de moeda e as configurações (`settingsOf`). Aposta ou depósito estragado no arquivo fica de fora, como na carga (seção "Estado no `localStorage`"). `seen` vai para agora. O cache da ESPN não faz parte do backup.
- **Limite conhecido:** o Telegram entrega o arquivo de volta como um anexo; para restaurar é preciso salvá-lo nos Arquivos do aparelho e escolher de lá. O app não recebe o arquivo direto do Telegram.

## Uso da ESPN (contagem no aparelho)

Pedido do Lucas em 11/10/2026 (D92): saber como está o uso da API da ESPN, com número na mão, antes de otimizar qualquer coisa. Sem backend, a contagem fica no aparelho e só sai dele quando a pessoa exporta.

- **O que é contado:** toda chamada à ESPN passa por `getJSON` (`src/app/api.ts`), que diz para que ela é. São seis tipos (`Core.USAGE_KINDS`):

  | Tipo | No cartão | Chamadas |
  |---|---|---|
  | `board` | Placar | o placar |
  | `odds` | Odds | as odds de uma luta e a linha de "vai até a decisão" dela |
  | `result` | Resultado | o resultado de uma luta encerrada |
  | `td` | Quedas da luta | as quedas de cada lutador numa luta |
  | `astats` | Média de quedas | a média de quedas de um lutador |
  | `form` | Últimas lutas | a lista de lutas de um lutador, cada luta passada e o resultado dela |

  A chamada ao serviço de câmbio não é da ESPN e não é contada (`getJSON` com tipo `null`).
- **O que fica de cada chamada:** por dia e por tipo, o número de chamadas (`n`), as que falharam (`err`: erro de rede, resposta que não é 200, tempo esgotado), o tempo somado (`ms`), a mais lenta (`max`) e o tamanho somado das respostas (`bytes`). E, por dia, o pico (`peak`): o maior número de chamadas dentro de um mesmo minuto do relógio.
- **O tamanho é o do texto da resposta**, em caracteres, depois de aberta. Quanto trafegou comprimido a página não vê.
- **O dia** é o do relógio do aparelho. Ficam guardados os 30 dias mais recentes (`USAGE_DAYS`).
- **Hora a hora** (D95): dos 7 dias mais recentes (`USAGE_HOURLY`) fica também, por hora do relógio do aparelho, o número de chamadas, as que falharam, o tamanho, o pico num minuto e quantas de cada tipo. É o que mostra onde, numa noite de card, as chamadas vão: a luta ao vivo, a espera do resultado.
- **Guardado** em `oitolados.usage.v1`, 2 s depois da última chamada (`USAGE_SAVE`) e ao sair da página. O que foi contado desde que o app abriu ("a sessão") fica só na memória.
- **Na Carteira:** o cartão "Uso da ESPN" diz as chamadas de hoje, o tamanho, as falhas, o pico por minuto e as chamadas da sessão; uma tabela traz, por tipo e no total, as chamadas de hoje e dos últimos 7 dias, o tempo médio, a mais lenta e o tamanho médio de uma resposta. O botão "Ver hora a hora" abre as últimas 24 horas que têm chamada, a mais recente em cima (as de antes da meia-noite como "ontem 23h"), com as chamadas, as falhas, o pico por minuto, o tamanho e, embaixo da hora, quantas de cada tipo. Aberto ou fechado não é guardado (`ui.usageHours`).
- **Exportar:** "Exportar em arquivo" gera `oito-lados-uso-espn-AAAA-MM-DD-HHMM.json`, pela folha de compartilhamento ou baixado, como o backup (`handFile`). "Copiar como texto" copia o mesmo conteúdo; onde a página não pode copiar, o texto aparece para ser copiado à mão. O arquivo traz `days` (como está guardado), `session`, `today`, `version` (o commit da página) e a legenda dos campos. **Só contagens: nada de apostas, saldo ou depósitos.**
- **Zerar contagem** apaga tudo o que foi contado neste aparelho e recomeça a sessão.
- **Ninguém mais vê:** as contagens não são enviadas a lugar nenhum. Para alguém analisar, é preciso mandar o arquivo ou o texto.
- **Limite conhecido:** conta o que a página pediu, não o que a ESPN recebeu. Um app aberto em dois aparelhos tem duas contagens.

## Sincronizar aparelhos (servidor)

Pedido do Lucas em 17/10/2026 (D98, feito na D99): a mesma banca no iPhone e no computador, no plano grátis.

- **O aparelho continua sendo a fonte da verdade.** Tudo segue em `oitolados.v1`, como antes; o servidor guarda uma cópia. Servidor fora do ar, pausado ou sumido: o app funciona igual, só não sincroniza, e o cartão diz "Sem conexão com o servidor". O plano B, se ele morrer de vez, é o backup em arquivo.
- **Onde:** Supabase Free (banco e login) e uma função na Vercel Hobby. A página chama o Supabase direto; a função só mantém o banco acordado. Tudo no mesmo repositório e no mesmo deploy.
- **O projeto:** `CLOUD_URL` e `CLOUD_KEY` (`src/core/cloud.ts`), o endereço e a chave publicável, mandados pelo Lucas em 17/10/2026. Vazios, o cartão não aparece e nada é chamado. O teste ponta a ponta serve a página com um servidor simulado no lugar dos dois, e também com os dois vazios. Montar o projeto: `supabase/README.md`.
- **Login** (D100, que revê a D99): e-mail e senha. "Criar conta" na primeira vez (`/auth/v1/signup`), "Entrar" no outro aparelho (`/auth/v1/token?grant_type=password`). **Nenhum e-mail é mandado**: o projeto está com "Confirm email" desligado. O código por e-mail da D99 não deu: no plano grátis, projeto novo não edita o modelo do e-mail, que só traz link, e o link não chega ao app instalado na Tela de Início do iPhone. A senha tem de 8 (`MIN_PASSWORD`, o mesmo mínimo configurado no projeto) a 72 bytes, só vai para o servidor e nunca é guardada no aparelho. A sessão fica em `oitolados.auth.v1` e é renovada 1 min antes de vencer (`TOKEN_MARGIN`). Sessão recusada pelo servidor: o app pede para entrar de novo, e os dados do aparelho ficam. "Sair" apaga só a sessão.
- **O que vai para o servidor:** uma linha por pessoa na tabela `states`, com o estado inteiro (`oitolados.v1`). Quem lê e escreve cada linha é decidido no banco (`supabase/schema.sql`): cada um só a sua, ninguém apaga, e sem login não se vê nada. O endereço e a chave publicável vão na página e são públicos por natureza; a chave secreta nunca entra no código (o `docs_check.py` confere). Também vão as últimas lutas de cada lutador já lidas, na tabela `form_cache`, uma linha por pessoa e lutador (seção "Últimas lutas de cada lutador").
- **Quando sincroniza:** ao abrir, ao voltar para o app, no "Sincronizar agora" e 2 s depois da última gravação (`SYNC_AFTER`; as gravações vêm em rajadas). Uma de cada vez: a pedida durante outra roda quando ela acaba. Cada chamada espera no máximo 15 s (`CLOUD_TIMEOUT`). Um 401 do banco renova o token uma vez e tenta de novo. A cópia do servidor passa pela mesma conferência de um backup antes de entrar, e só volta ao servidor se a junção mudou alguma coisa (a comparação, `Core.sameState`, não depende da ordem das chaves).
- **Como junta** (`Core.mergeStates`): apostas pelo `id`, depósitos pelo instante e valor, conversões de moeda pelo instante. A mesma aposta nos dois: a encerrada (ganha, perdida, anulada ou com cashout) vence a aberta, qualquer que seja a marca, porque aposta não reabre e cashout não se refaz; entre duas abertas ou duas encerradas, fica a que mudou por último (`u`). Configurações: as que mudaram por último (`setAt`). `seen`: o maior. Com as marcas diferentes, juntar em qualquer ordem dá o mesmo resultado; num empate exato de marcas, fica o do aparelho que está juntando.
- **Zerar, restaurar e trocar de moeda reescrevem o histórico** (`epoch`): aí não se junta item por item, senão o zerado voltaria do outro aparelho. Vale a reescrita mais nova, e do outro lado só entra o que foi criado depois dela, na mesma moeda. A marca de uma reescrita nunca fica atrás da que o aparelho já conhecia (`Math.max(agora, epoch + 1)`), para um aparelho com o relógio atrasado não perder o próprio zerar. Dois históricos em moedas diferentes nunca são somados: sem reescrita que os separe, fica inteiro o que teve movimento por último. O que ficou de fora é contado e dito ("2 itens ficaram de fora…").
- **Primeira vez de um aparelho com a conta** (`Core.firstMeet`, D102): servidor vazio, o histórico daqui sobe; aparelho vazio, ele fica com o do servidor, mesmo que tenha zerado ou trocado de moeda antes de entrar (zerar antes de entrar não apaga o servidor); um lado já contém tudo do outro, na mesma moeda, os dois são somados sem perguntar. Se cada um tem algo só seu, o cartão pergunta antes de mexer, com quantas apostas e depósitos tem cada um: "Juntar os dois" (`Core.joinBoth`: soma tudo, sem reescrita cortando nada), "Ficar com o deste aparelho" ou "Ficar com o do servidor". Ficar com um apaga o outro, aqui e no servidor. Em moedas diferentes não há "Juntar": a tela diz as duas moedas e oferece só ficar com um.
- **Rotina diária** (`api/keepalive.ts`): o cron da Vercel chama `/api/keepalive` uma vez por dia (`17 9 * * *`, em UTC: 06:17 em Brasília). Ela faz uma consulta (`keepalive()`, uma contagem feita como visitante anônimo, que não vê linha nenhuma), para o projeto do Supabase não pausar depois de uma semana sem uso. Só o cron entra: a Vercel manda o `CRON_SECRET` no cabeçalho, e sem ele a resposta é 401. A Vercel diz que o cron é "melhor esforço", sem nova tentativa: um dia que falha não pausa o projeto, uma semana inteira sim.
- **Limites conhecidos:** a sincronização é feita só com o app aberto. Dois aparelhos mexendo na mesma aposta ao mesmo tempo: fica a última mudança. Nada disso foi visto com o Supabase de verdade (ver `docs/verificacao.md`).

## Sincronização

- `loadBoard`: placar de 4 dias atrás (ou 1 dia antes da aposta aberta mais antiga) até 30 dias à frente (`BOARD_AHEAD`): o bastante para ter os três cards seguintes ao que acabou, mesmo com uma semana sem evento no meio.
- `loadOdds`: por evento, só lutas `pre`, no máximo a cada 5 min; forçado no botão Atualizar e antes de aceitar aposta.
- `loadResults` (D93): o resultado de uma luta encerrada é pedido uma vez, e só onde é usado: num card que está na tela, ou para fechar uma aposta aberta. Card encerrado não está na tela (D91), então dele só se pede o resultado das lutas com aposta.
- Intervalo do laço: 8 s enquanto uma aposta aberta espera por uma luta que já acabou (o resultado, ou as quedas fecharem; `settling`), por até 30 min depois de a luta aparecer como encerrada; 15 s com luta ao vivo, 30 s em noite de evento, 120 s no resto. Para com a aba oculta e sincroniza na volta. Uma página restaurada da memória (`pageshow`) e a volta da conexão (`online`) também sincronizam, se a última sincronização foi há mais de 5 s.
- **Quando a ESPN não responde** (D94): cada rodada seguida em que o placar não vem dobra a espera até a próxima (`Core.retryDelay`), até o teto de 5 min (`RETRY_MAX`), e nunca abaixo do intervalo do momento: de 8 s vai a 16, 32, 64, 128, 256 e 300 s. A primeira rodada que dá certo traz o intervalo de volta. A linha debaixo dos eventos diz "Sem conexão com a ESPN" e em quanto tempo é a nova tentativa. O botão Atualizar, a volta ao app e a volta da conexão tentam na hora, sem esperar.
- Antes de gravar uma aposta, `place()` recarrega placar e odds das lutas envolvidas. Se a luta começou, recusa; se a odd mudou, mostra a nova e pede confirmação.
- Apostas travam quando a luta sai de `pre`. Não há aposta ao vivo, e é decisão (D73): a ESPN não publica odd com a luta em andamento. O cashout congela enquanto houver luta da aposta em andamento.
- Só atualiza com o app aberto; ao reabrir, busca os resultados e liquida o que ficou pendente.

## App guardado no aparelho (offline e versão nova)

Pedido do Lucas em 10/10/2026 (D37): entrega mais rápida, abrir sem internet e avisar quando sai versão nova.

- **O que fica guardado:** `dist/sw.js` (de `src/sw.js`) é um service worker. Na instalação ele guarda a página no cache `oito-lados-page-<versão>` e passa a responder toda abertura do app com essa cópia, sem ir à rede. Arquivos de `fonts.googleapis.com`, `fonts.gstatic.com` e `cdn.jsdelivr.net` (fontes, a fonte das bandeiras e o leitor de imagem) vão para o cache `oito-lados-assets-v1` na primeira vez que passam por ele e depois saem do aparelho.
- **O que nunca passa pelo service worker:** ESPN e câmbio. O app precisa deles frescos e já guarda a última resposta no `localStorage` (`oitolados.cache.v1`, `oitolados.fx.v1`), que é o que aparece sem conexão. Sem conexão dá para ver lutas, apostas e carteira; apostar, fazer cashout e converter moeda continuam exigindo rede.
- **Versão:** o build calcula um hash da página sem o carimbo de commit e grava em `sw.js`. Publicação que não muda o app (documentação, testes) gera o mesmo `sw.js` e não incomoda ninguém.
- **Aviso de versão nova:** o navegador baixa o `sw.js` novo, que guarda a página nova e fica **esperando**. A página mostra a faixa "Saiu uma versão nova do app." com o botão "Atualizar agora" (`#update`). O toque manda o service worker novo assumir, a página recarrega já na versão nova e a cópia antiga é apagada. Sem o toque, o app aberto continua o mesmo: trocar a versão debaixo de um cupom aberto não é aceitável. Fechar o app de vez e abrir de novo também entra na versão nova.
- **Quando procura:** ao abrir, toda vez que o app volta para a frente e a cada 30 min com ele aberto (`CHECK_EVERY`). O cartão "Versão do app", na Carteira, mostra o commit da página e tem o botão "Procurar versão nova".
- **Onde não vale:** o service worker só é registrado na página publicada (`import.meta.env.PROD`, por http ou https). No `npm run dev` e na página aberta do disco (como os testes fazem) não há service worker, e o cartão diz isso.
- **Dados não são tocados:** trocar de versão não mexe no `localStorage`.
- **Limites conhecidos:** primeira visita sem conexão não abre (não há o que mostrar). O service worker só guarda resposta que consegue conferir (`res.ok`); arquivo pedido sem CORS chega opaco e não é guardado. Se o leitor de imagem pedir algum assim, ele não funciona sem internet: ler print sem conexão não foi testado e não deve ser prometido. Nada disso foi visto no Safari do iPhone (ver `docs/verificacao.md`).

## Interface

Uma coluna de até 720 px. Barra superior fixa com saldo, barra de abas embaixo (Lutas, Apostas, Carteira), cupom como folha que sobe do rodapé.

Identidade: uma cor para cada canto (vermelho e azul por padrão), dourado para seleção e ação principal. Títulos em Big Shoulders Display, texto em Barlow (Google Fonts, com fallback). Verde e vermelho de ganho/perda são separados das cores de canto. Luta em andamento é azul (`--live`), com a marca pulsando, e nunca vermelha: vermelho na lista de apostas quer dizer aposta perdida (D78).

Bandeira (D84): `Core.flagOf(país)` devolve a bandeira como emoji, a partir do nome do país em inglês que a ESPN manda (sem depender de caixa ou acento). A tabela de nomes é do app (`src/core/flags.ts`): cobre os países e os nomes alternativos mais comuns ("USA" e "United States", "Türkiye" e "Turkey"), e Inglaterra, Escócia e País de Gales têm a bandeira própria. **Nome que a tabela não tem fica sem bandeira, nunca com uma chutada**; "default", que é o lutador sem país, também. A bandeira vem antes do sobrenome no card da luta e no quadro das últimas lutas, e antes do nome do país no filtro, com o nome do país em `title` e `aria-label`. É um caractere, não uma imagem.

Bandeira onde o sistema não tem (D88): o Windows não tem emoji de bandeira, e o navegador desenha as duas letras do país ("BR") no lugar. Por isso toda bandeira fica num elemento próprio (`.flag`), com uma lista de fontes que termina numa fonte só de bandeiras, a "Twemoji Country Flags" (pacote `country-flag-emoji-polyfill` 0.1.10, 78 kB, da jsDelivr; a arte é do Twemoji, CC-BY 4.0). As fontes do sistema vêm antes na lista ("Apple Color Emoji", "Noto Color Emoji"): **quem tem bandeira no sistema, como o iPhone, desenha a sua e nunca pede a fonte**; só quem não tem é que baixa. O service worker guarda a fonte como guarda as outras, então ela continua lá sem internet depois da primeira vez. A versão fica na folha de estilo e em `tests/package.json`, que o `docs_check.py` compara. Sem a fonte (primeira visita sem internet, jsDelivr fora do ar), o computador sem bandeira mostra as letras.

Submission (D85): o método é escrito "Submission" nos mercados ("Almeida por Submission", "Luta termina por Submission"), no resultado da luta e no quadro das últimas lutas ("2 por submission"). A luta que acabou em submission diz qual foi, com o nome que a ESPN dá, em inglês: "Almeida venceu por Submission (Rear Naked Choke) · R4 2:00" no card e nas apostas, e embaixo do método no quadro das últimas. Sem nome na ESPN, fica só "Submission". O leitor de prints continua entendendo "finalização" e "submission". Aposta feita antes da mudança continua com "Finalização" no histórico, porque o texto é copiado na hora da aposta.

Tema: claro e escuro, tudo em variáveis CSS no `:root`. Por padrão segue o aparelho (`prefers-color-scheme`); o cartão "Aparência", na Carteira, deixa fixar um dos dois (`S.theme`, D38). `applyTheme` põe a escolha em `data-theme` no `<html>` e acerta a cor das barras do navegador (`theme-color`). A paleta escura aparece duas vezes em `src/styles.css`, uma para "o aparelho pediu" e outra para "a pessoa escolheu"; o `docs_check.py` confere que as duas são iguais.

Cor de canto nas opções: `Core.sideOf(key)` diz de qual lutador é uma seleção (`ml`, `mov`, `wr` e `tda`; o resto é da luta inteira e devolve `null`). Nos mercados, a opção de um lutador ganha a barra e um fundo leve na cor do canto dele, e o cabeçalho da coluna ganha um traço na mesma cor. No cupom, na tela de copiar aposta e na lista de apostas, a seleção leva um quadradinho da cor. Os botões de vencedor não repetem a marca porque já ficam na linha do lutador.

Pares de cor dos cantos (D40): três pares, sempre com a cor quente no lutador `a` (o de cima): vermelho e azul (`red-blue`, o padrão), rosa e verde (`green-pink`), laranja e roxo (`purple-orange`). O cartão "Aparência" deixa escolher um par para as lutas masculinas e outro para as femininas (`S.corners`). `Core.isWomens(weight)` reconhece a luta feminina pela categoria da ESPN começando com "W "; um peso casado feminino não é reconhecido e sai no par das masculinas. O card da luta, ou a marca de uma seleção, leva `data-corners` com o par, e a folha de estilo troca `--ca` e `--cb` ali. Os tons ficam longe do verde de "ganhou" e do dourado de seleção. Aposta antiga, sem `weight` na perna, usa a categoria da luta enquanto ela estiver no placar e depois o par das masculinas.

Legenda dos cantos (D35): com os mercados de uma luta abertos, uma faixa com os dois sobrenomes e a cor de cada canto (`.corners`) fica presa logo abaixo da barra superior enquanto os mercados daquela luta rolam. Toda opção de lutador também leva `title` com o nome e a cor do canto ("Almeida · canto vermelho"); no iPhone não existe ponteiro, então quem resolve lá é a faixa.

Mais e menos de uma linha (rounds e quedas) aparecem como `+2.5` e `−2.5`, com a legenda "+ é mais de, − é menos de" no título do mercado. Esses dois lados têm marca própria (D34, revista pela D41): `Core.overUnder(key)` devolve `'o'` ou `'u'` para `tot` e `td`, e a opção é montada como a de um lutador (barra lateral e fundo leve), mas em tons neutros (`--over` mais forte, `--under` mais claro) e com uma seta (▲ no +, ▼ no −). São neutros de propósito: + e − não pertencem a lutador nenhum, e com três pares de cor nos cantos qualquer cor ali bateria com algum par. A mesma seta marca a seleção no cupom, na tela de copiar aposta e na lista de apostas. Aposta feita antes dessa mudança continua com o texto antigo no histórico, porque o texto é copiado na hora da aposta.

Acessibilidade (conferida por `tests/a11y.py`): texto com contraste AA (4,5:1) nos dois temas, inclusive o texto de dica dos campos (`::placeholder` no cinza do app, não no do navegador) e o `≈` da odd estimada; todo botão com nome e todo campo com rótulo; o saldo no alto é lido com o valor; o cupom diz qual tipo está ligado (`aria-pressed`). Os botões desenhados menores que um dedo e soltos na tela (o `×`, "Atualizar", o chip de apostas da luta, os botões-link como "trocar" e "desfazer") recebem 44 px de área de toque sem mudar o desenho. Os de 38 px que ficam em fileira (atalhos de valor, escolhas de período, tema e afins) continuam como estão. Os botões que escolhem arquivo ("Escolher fotos", "Restaurar de um arquivo") funcionam também pelo teclado. O aviso que aparece no alto (`#toast`) não segura toque: o que está embaixo dele continua respondendo.

Cuidados de iPhone já aplicados: `viewport-fit=cover` com `env(safe-area-inset-*)`, campos com fonte de 16 px ou mais (evita zoom), metas `apple-mobile-web-app-*`. O Safari pode limpar o `localStorage` de site sem uso por semanas; por isso a Carteira tem backup e restauração, por arquivo e por texto (seção "Backup").

## Testes

```bash
npm ci                       # Vite e TypeScript
pip install -r tests/requirements.txt && playwright install chromium
npm ci --prefix tests        # arquivos do leitor de imagem usados pelo e2e
scripts/verify.sh            # tudo: tipos, build, docs, core, a rotina diária, o schema do banco (se houver Postgres), unit, contract, autoteste da checagem de produção, e2e claro e escuro, settle, pwa, acessibilidade, dados estragados e cobertura
scripts/verify.sh --quick    # sem o e2e (poucos segundos)
node tests/core.mjs          # os casos do núcleo, sem navegador
npm run mutation             # teste de mutação do núcleo (Stryker rodando o core.mjs); mais de 2 h em 2 núcleos; um módulo: npm run mutation -- --mutate src/core/fx.ts
node tests/keepalive.mjs     # a rotina diária (api/keepalive.ts), com a rede trocada
tests/schema_check.sh        # o schema do banco num Postgres local
python3 tests/cloud_live.py  # o projeto do Supabase de verdade (precisa alcançá-lo; --mock testa o script)
python3 tests/contract_live.py   # API real da ESPN (precisa de internet)
npm run dev                  # servidor de desenvolvimento do Vite
```
O `verify.sh` começa pelo `tsc` e pelo build; se um dos dois falha, os testes nem rodam. **Todo teste usa `dist/`**, o que o build gerou, e não o código-fonte: o que é testado é o que é publicado. Todos abrem `dist/index.html` do disco, menos o `pwa.py`. A única exceção é o `core.mjs`, descrito abaixo.

Os casos do núcleo ficam em `tests/unit.cases.mjs`, uma função de `Core` com tabelas de casos. Regra nova de preço, de liquidação, do leitor ou do histórico entra ali primeiro. Dois executores rodam os mesmos casos (D62):

- `unit.py` carrega a página com a rede bloqueada e roda os casos contra `window.__OL.Core`: é o que testa o que vai para o ar, e o que conta para a cobertura.
- `core.mjs` constrói `src/core` sozinho, com o mesmo Vite, importa o resultado no Node e roda os casos sem página nem navegador. Antes de carregar o núcleo ele arma `window`, `document`, `localStorage` e `fetch` para estourarem se forem tocados: é isso que mostra que o núcleo se sustenta sozinho. O que ele constrói fica em `tests/.build/`, fora do repositório.

Os casos são JavaScript, não TypeScript: muitos passam de propósito dados tortos, que o compilador recusaria. A verificação não ficou mais rápida com isso (o `unit.py` leva pouco mais de um segundo); o ganho é o núcleo provado fora da página.

`contract.py` passa as respostas reais gravadas (ESPN e câmbio) pelos normalizadores, inclusive a lista de lutas de um atleta, três lutas passadas com o `status` de cada uma e o `status` de um empate. `contract_live.py` faz o mesmo contra a API de verdade (ESPN e o serviço de câmbio), e varre até 160 lutas encerradas dos últimos 120 dias para conferir que todo nome de resultado é classificado e que toda luta com vencedor tem o vencedor marcado no placar; lista também os países dos placares, com aviso para o nome que o app não tem bandeira, e os nomes de submission: as chamadas saem do Python, com um user agent que identifica o script e a origem de produção, e cada resposta é conferida também pelo cabeçalho de CORS; o navegador só roda os leitores do app. Saída 0 = a API continua batendo; 1 = uma checagem falhou (a API mudou); 3 = inconclusivo, a máquina não alcançou a ESPN. Aviso é normal quando não há card ou odds publicadas. `--mock` testa o próprio script. No GitHub Actions, falhas e avisos aparecem como anotações na execução.

`docs_check.py` confere links, arquivos citados, constantes, chaves de seleção e o saldo esperado contra o código em `src/`, e também a configuração do build (versões exatas, modo `strict`, núcleo sem DOM, módulos documentados).

`a11y.py` serve a página com o servidor simulado no lugar do Supabase (nomes do mesmo tamanho, para a cobertura continuar valendo por posição) e passa por todas as telas nos dois temas: Lutas, mercados abertos, cupom, copiar aposta, apostas abertas e encerradas, e a Carteira inteira, com o cartão do servidor já logado. Em cada uma mede o contraste de todo texto que não está desligado, procura botão sem nome e campo sem rótulo, e confere com `elementFromPoint` que cada botão recebe o toque no próprio centro e, se é desenhado menor que 44 px, também 22 px em volta (os de fileira, de 38 px, ficam numa lista). Uma vez só, confere o foco depois de repintar, o foco ao abrir a folha de baixo, os botões de arquivo pelo teclado, o toque que passa pelo aviso, o saldo lido com o valor e o mesmo ROI em todos os lugares da Carteira.

`robust.py` abre o app com dez tipos de dado estragado no aparelho (aposta sem seleção, seleção vazia, depósito nulo, cache de outro formato e afins), restaura um backup estragado e entra numa conta cuja linha no servidor tem apostas estragadas. Em todos, as três telas têm que desenhar sem erro e o que está inteiro tem que ficar.

**Cobertura:** com `OL_COVERAGE=1` (o `verify.sh` completo liga sozinho), cada suíte grava quais funções e trechos do script de `dist/index.html` executou, usando a cobertura precisa do V8. `python3 tests/cov.py` junta tudo, lista as funções nunca chamadas (nome e linha da página gerada) e falha abaixo dos mínimos: 95% das funções e 90% do código. Feature nova entra com teste, senão a cobertura cai e o `verify.sh` acusa. Teste que recarrega a página usa `cov.reload(pg)` em vez de `pg.reload()`: a recarga descarta o script, e no GitHub Actions as contagens de antes da recarga se perdiam (cobertura de 91,7% para um código que mede 97,2%). `cov.stop` para a medição e solta a página: com o medidor ainda preso, uma página fechada continuava contando como aberta para o service worker. No `e2e.py`, toda página do app aberta depois da medição principal também é medida (`app_page` e `done`), cada uma com um nome próprio. A página servida com o projeto do Supabase trocado pelo simulado mantém cada caractere no lugar: o endereço e a chave de teste têm o tamanho dos reais, e as constantes vazias levam os espaços que faltam, porque o `cov.py` casa o que foi medido com `dist/index.html` pela posição.

`e2e.py` simula um card de 3 lutas em 4 fases, aposta pela interface (simples, múltipla, combinada, combinação impossível), copia apostas de texto e de prints (inclusive uma imagem que só está na área de transferência, e quatro fotos de uma vez: um cupom de múltipla completado pela lista de seleções, à mão e por outro item, seleção trocada e tirada, valor e tipo mudados na lista, aposta repetida na lista, odd mínima, os mercados de uma luta como botões do app nas cores do tema, três apostas feitas juntas com a origem e a odd do print guardadas, a fonte fora do ar, uma odd que muda no meio, e as mesmas fotos mandadas de novo com as apostas já abertas), confere a bandeira de cada lutador no card, confere que as últimas lutas de quem está no card da semana são buscadas sozinhas e o que os detalhes da luta mostram delas (com o nome da submission; quantas chamadas faz, o que guarda, o que busca de novo e o que faz quando a fonte falha), salva o backup em arquivo (baixado e pela folha de compartilhamento simulada) e restaura dele, mostra uma parte do card só, busca luta pelo nome (com um segundo evento no placar, e com o toque que não tira o foco do campo) e filtra as lutas do card por país (o botão dos brasileiros, os dos outros países, junto com a busca, de um card para o outro, e as cores dos botões no tema escolhido), confere os cards no alto (o da semana e os dois seguintes antes de ele acabar, inclusive com todas as lutas encerradas e o evento ainda não marcado; só os três seguintes depois que a ESPN o marca como encerrado; o card distante com aposta aberta; o placar pedido um mês à frente), confere as fileiras de eventos e de países com o dedo (uma linha que rola para o lado) e com o mouse (quebram em linhas, sem botão cortado, na largura do celular e numa janela larga), e, no fim, abre o Chromium de novo sem a fonte de emoji da máquina, para fazer as vezes de um computador sem bandeira: a fonte das bandeiras é pedida e a bandeira sai em cores; sem ela, só letras; e com a fonte de emoji no lugar, o app não pede nada), confere o cartão do uso da ESPN (todo tipo de chamada contado, a contagem zerada, o que é contado dali em diante contra o que a fonte simulada viu, a chamada que falha, o arquivo exportado, a folha de compartilhamento, o texto copiado e o que fica guardado; o hora a hora; e, numa página só dela, tipo por tipo contra a fonte e de novo depois de recarregar), confere que o resultado de uma luta só é pedido onde é usado (nenhum com o card encerrado e sem aposta; só o da luta apostada; todos enquanto o card está na tela) e que a espera dobra a cada rodada que falha, até 5 min, e volta ao normal na primeira que dá certo, confere a etiqueta de tipster em cada aposta e a comparação com as próprias (os dois quadros frente a frente e a tabela), confere o extrato em unidades (as janelas de 7, 15 e 30 dias e o geral, os eventos, o ponto de quem está na frente, e que ele não segue o período), renomeia tipster, filtra as apostas por quem é, confere a faixa do que fechou desde a última vez e o período da Carteira, faz cashout nos dois regimes (devolução antes do card e valor de mercado com uma perna da múltipla já batida) e confere quando ele congela, troca a moeda da banca com e sem depósito e confere a conversão (cotação simulada, com números redondos e data antiga para não passar por cotação real), imprime preços e liquidações e confere o saldo final esperado de R$ 1.609,59. Capturas em `tests/shots/`. O erro de rede no fim da saída é a fonte do Google bloqueada de propósito.

`settle.py` aposta pela interface na primeira luta do card (vencedor, o outro lado, método, quedas e uma múltipla) e confere a etiqueta de cada seleção pelo caminho. Faz a ESPN simulada segurar respostas: primeiro a luta acaba com o vencedor marcado e sem resultado (as duas de vencedor fecham, o resto espera, e a fonte é consultada de novo em menos de 10 s); depois o resultado vem com um nome inventado (nada anula, o nome aparece); depois vem certo (método e quedas fecham). Confere também a volta ao app e a múltipla perdida na luta principal. Numa segunda sessão, limpa, a primeira luta acaba em empate: a simples no vencedor é devolvida, e a múltipla segue aberta com a seleção marcada como anulada, a odd reduzida e os totais acompanhando, até ganhar na luta que restou. Nessa sessão, em que nada foi copiado, confere também o extrato em unidades com uma coluna só. Numa terceira, aberta com o card pela metade, confere que o adiantamento das últimas lutas só busca quem ainda tem luta por fazer. O `e2e.py` liquida com tudo chegando de uma vez; este é o que cobre a noite em que não chega.

`pwa.py` é o único teste que serve `dist/` por um servidor local, porque service worker não existe em página aberta do disco. Ele publica o build e depois uma "versão seguinte" (outra página, outro `sw.js`) e confere: a página fica guardada, a primeira instalação não anuncia nada, o app abre com o site fora do ar sem pedir a página à rede, a versão nova é anunciada, o app em uso só troca depois do toque, a cópia antiga é apagada, e publicar de novo sem mudar o app não avisa. O teste não consegue interceptar o que o próprio service worker pede; por isso um segundo servidor local faz o papel dos endereços de fontes e do leitor de imagem, e o `sw.js` servido no teste guarda arquivos só dele (sem isso, o teste iria ao Google de verdade a cada abertura). Quais endereços o `sw.js` de verdade guarda é conferido pelo `docs_check.py`. No fim o teste fecha o app com uma versão esperando e abre de novo, para ver que ela assume.

O fixture inventa resultados, então usa só lutadores fictícios. As telas do README saem dele: `OL_EVENT_NAME='UFC Fight Night: Almeida vs. Dunne' python3 tests/e2e.py dark` e copiar de `tests/shots/` para `docs/screenshots/`.

Para testar contra a ESPN de verdade: `npm run dev` e abrir o endereço que o Vite mostrar.

## Publicação

Deploy contínuo pela integração da Vercel com o GitHub: cada PR ganha uma URL de prévia e cada merge na `main` publica em produção. O `vercel.json` manda a Vercel fazer o mesmo que o `verify.sh` e o CI fazem: `npm ci`, `npm run build`, publicar `dist/`. O `.vercelignore` deixa de fora o que o build não lê (testes, documentação). São publicados dois arquivos, `index.html` e `sw.js`, e uma função, `api/keepalive.ts`, que o cron do `vercel.json` chama uma vez por dia. A primeira importação do projeto, ainda sem `vercel.json`, falhou porque a Vercel escolheu sozinha o preset "FastHTML" (Python) e procurou um `main.py`.

O build grava o commit em `<meta name="ol-commit">`. Na Vercel ele vem da variável `VERCEL_GIT_COMMIT_SHA`; fora dela, do `git`.

A Vercel publica o que chegar na `main` sem olhar o CI. Quem garante que só entra código testado é a proteção do branch `main` exigindo os checks `checks`, `e2e (dark)` e `e2e (light)`.

**Merges em sequência podem deixar a produção numa versão antiga.** Em 09/10/2026 os PRs #4, #5, #6 e #7 foram mesclados em menos de um minuto. A Vercel fez um deploy por merge, o do #4 terminou por último e ficou com o endereço de produção: CI verde, quatro deploys com sucesso, e o app no ar sem nada dos outros três PRs (D32). Por isso:

- Mesclar um PR por vez e esperar o deploy, ou mesclar só o último quando um PR já contém os anteriores.
- O workflow `Produção` roda `scripts/check_production.py` depois de cada push na `main`: espera a produção mostrar o carimbo do commit que entrou e **continua olhando por 5 min**, porque o deploy errado pode chegar depois do certo. Falhou: na Vercel, promover o deploy do commit mais recente da `main`, ou fazer um novo merge. Com o commit certo no ar, chama também `/api/keepalive` sem o segredo e exige 401: a rotina diária que não carrega (um 500) ou que não foi publicada (404) falha o workflow.
- Em PR o mesmo script só informa qual commit a produção está servindo (`--report`) e nunca falha. `--selftest` testa o script contra um servidor local e roda no `verify.sh`.

**Publicar não troca o app de quem já abriu.** O aparelho mostra a cópia guardada até a pessoa tocar em "Atualizar agora" (seção "App guardado no aparelho"). A checagem de produção lê o servidor, não o aparelho: produção certa e app antigo na mão é o estado normal entre a publicação e o toque.

No iPhone: abrir a URL no Safari → Compartilhar → Adicionar à Tela de Início.

## Ideias para depois

- O resto da PWA: `manifest.json` e ícone em arquivo. O service worker e a abertura sem internet já existem (D37).
- Linhas alternativas de quedas por lutador (hoje só "pelo menos 1").
- Notificação quando uma aposta fecha (exige permissão e um servidor para enviar; o service worker já existe).
- Mostrar quedas no resultado de todas as lutas, não só das que têm aposta.
