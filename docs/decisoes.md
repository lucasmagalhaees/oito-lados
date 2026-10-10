# Decisões do projeto

Registro do que foi decidido, por quê, e o que foi descartado. Existe para que ninguém (pessoa ou IA) dependa da memória de uma conversa. Decisão nova entra aqui, com data.

Formato de cada item: **contexto**, **decisão**, **descartado**, **consequência**.

## Linha do tempo de 09/10/2026 (sessão de criação)

1. Pedido inicial: app de apostas tipo bet365, fictício, com saldo virtual livre e odds reais de UFC atualizadas a cada fim de semana.
2. Pode ser página web, para usar no iPhone 15; app nativo fica para uma v2.
3. Mercados pedidos: múltipla, rounds, KO/TKO, finalização, decisão, quedas. Validação com dados reais das lutas. Controle de ganhos e perdas.
4. Pedido de acompanhamento em tempo real durante as lutas. Isso definiu a arquitetura (D2).
5. Entrega da primeira versão em um `index.html`.
6. Dúvidas respondidas: como publicar, como atualiza toda semana, opções de hospedagem, Vercel ou Netlify.
7. Pedido de combinada na mesma luta "que faça sentido" (D6) e de o app "escalar".
8. Decisão de seguir como MVP para um usuário e documentar a escala para depois (D11).
9. Criação do repositório `lucasmagalhaees/oito-lados` (MIT), fluxo por branch e PR, deploy no merge, testes automatizados (D13).
10. Pedido de documentar tudo no repositório e de um harness contra alucinação de IA (D16).
11. Acesso de escrita do Claude ao repositório liberado; primeiro branch enviado.
12. PR #1 (o app) aprovado e mesclado pelo Lucas. Primeiro deploy na Vercel falhou por detecção de Python (ver D12); correção enviada no PR seguinte, junto com a documentação e o harness.
13. PRs #2 e #3 mesclados; produção no ar em https://oito-lados.vercel.app. Pedido de cashout (D21).
14. Pedidos em sequência: repetir aposta (D22), máscara de milhares e moeda (D23), unidade (D24), pesquisa sobre pontuação por round (D25) e copiar aposta por imagem ou texto (D26).
15. Pedido de cobertura de testes: cobertura do `index.html` passa a ser medida e cobrada no `verify.sh`.
16. Respostas do Lucas às interpretações pendentes: cashout dinâmico em múltipla (D27), moeda só no depósito e com conversão (D28), banca e unidade confirmadas (D24), valor do print configurável (D29).
17. Pedido de um botão para converter a banca sem depositar (ajuste na D28). Dúvida do Lucas sobre o modo "fixo" do valor de print (D29), explicada; ele ainda não disse se fica.
18. O Lucas mesclou os PRs #4 a #7 em sequência e a produção ficou na versão do #4 (D32). Pedidos seguintes: atalhos de valor altos e valor em unidades (D30), print só com "mesmo valor" ou "mesma stake" (D29), + e − e cores dos lutadores (D31).
19. Perguntas sobre mais de um usuário e sobre custo de backend, respondidas e anotadas em `docs/escala.md`. O Lucas pediu a migração para Vite + TypeScript (etapa 1 da escala), a fazer num PR separado.
20. Migração feita no mesmo dia (D33), em cima do PR dos pedidos anteriores.

## Linha do tempo de 10/10/2026

1. O Lucas mesclou os PRs #8 e #9 com 25 segundos de intervalo. O workflow `Produção` rodou no modo estrito no commit `4e3e31d` e passou: a produção ficou na versão certa e o carimbo de commit chegou à página publicada pela Vercel.
2. Pedido das 07:45, com um print do mercado "Total de rounds": faltou esquema de cores ali; um jeito de lembrar quem é azul e quem é vermelho sem rolar a tela de volta; dinheiro ou unidades como configuração e não por aposta; ver o que dá para guardar do app para abrir mais rápido, o modo offline, e avisar quando sai versão nova.
3. Duas perguntas feitas antes de implementar. Cores no total de rounds: criar um mercado por lutador ou dar cores próprias a + e −? Resposta: "quero o 2" (D34). Tema: quer escolher dentro do app? Resposta: "sim, quero dark mode no app" (D38).
4. Feito num PR só: D34 a D38.
5. PR #10 mesclado às 09:36; o workflow `Produção` passou no commit `bcbf6c1`. Pedido seguinte, às 10:30: "faltou opções de depósito de milhares, e milhão" (D39).
6. Entre 10:31 e 10:38, com o app já publicado na mão: as cores de + e − nas quedas "não ficaram boas, estão destoando do tom de vermelho e azul" (D41); "quero opções de temas de cores para os corners, pode ser azul × vermelho, verde × rosa, roxo × laranja", com padrão separado para lutas femininas e masculinas (D40); "a mesma stake não precisa desse campo para inserir valor" e "sempre que eu escolher mesmo valor, fixa a opção acima para reais; se escolher mesma stake, fica a opção acima para unidades" (D42).
7. O Lucas pediu para revisar se as alterações faziam sentido e um code review "como se fosse análise de negócio e como se fosse tech lead". A revisão está no PR; dois achados viraram código (a tela de copiar diz o que ficou de fora quando o original traz unidades e dinheiro; a lista de configurações passou a existir num lugar só).
8. PR #11 mesclado às 11:06; o workflow `Produção` passou no commit `3331e05`. Às 14:54, usando o app com apostas de verdade para copiar: a "dupla" de um canal não foi reconhecida como múltipla, a foto de um cupom não foi reconhecida, e os pedidos de mandar várias fotos e fazer várias operações de uma vez, de um botão para limpar a tela de copiar, e de o leitor entender dupla, tripla, quádrupla e quíntupla, e simples contra múltipla (D43, D44). O Lucas mandou cinco prints reais para testar.
9. PR #12 mesclado às 15:23; o workflow `Produção` passou no commit `228792e`. O Lucas pediu "propõe melhorias, 10 melhorias"; das dez propostas, respondeu "faz o 1 a 5": completar o acumulador na própria tela, juntar duas fotos numa aposta só, editar valor e tipo na lista, guardar de quem veio a aposta e medir por origem, e guardar a odd do print (D45 a D48). Mandou de novo os cinco prints como massa de teste e três capturas do iPhone, das 15:30, com a versão do PR #12 em produção: as fotos escolhidas de uma vez viraram lista com o card de verdade, os dois acumuladores ficaram com "só uma seleção lida" e cada foto aparecia com o nome de arquivo que o iPhone dá (um código de 36 caracteres).
10. PR #13 mesclado às 16:01; o workflow `Produção` passou no commit `6886992`. O Lucas pediu "mais melhorias"; das dez propostas, respondeu "faz todos menos o 3" (ficou de fora guardar a odd de fechamento): D49 a D56. No meio, perguntou se dava para ter um retrospecto das últimas lutas de cada atleta, guardado no aparelho, e qual o peso disso na performance. Respondido com o que a ESPN oferece e o custo em chamadas (anotado na D57); **o retrospecto não foi implementado e espera ele mandar**.
11. PR #14 mesclado às 16:45; o workflow `Produção` passou no commit `5d7d4e7`. Terceira leva de dez propostas; resposta: "Não faz: 1 8 7 6 9". Ficaram cinco: lista de copiar recolhida, apostas no card da luta, abertas agrupadas por evento, unidades por origem e os testes do núcleo sem navegador (D58 a D62). De fora, a pedido dele: lembrete de backup, aviso de amostra pequena, guardar o texto original da aposta, limite de exposição por evento e exportar em CSV.
12. Com a terceira leva em andamento, entre 16:59 e 17:04, mais pedidos, **ainda não feitos e fora deste PR**: um botão para colar o texto da área de transferência; sugerir stake de 0,2u a 0,4u em múltipla com mais de quatro seleções; setinhas de meio em meio no campo de unidades; e uma revisão da regra de valor ao copiar ("tem que seguir o que foi parametrizado: ou segue a stake, ou segue o valor"; em unidades, print que não diz unidades vale 1u, e não o dinheiro do print, o que revê a D42), com a stake em unidades e a hora de cada aposta à vista para conferir o consolidado. E uma pergunta: dá para mandar notificação quando a aposta é resolvida? Respondida (D63).
13. Às 17:09: "deixa quieto esse lance da notificação" e "só garante que está numa forma bacana esse lance de resolver a aposta, pra ganho e pra perda; seria bacana não demorar tanto depois que a luta acabou, mas eu consigo esperar um tempo". É a primeira noite com luta de verdade. Revisão do caminho de liquidação (D64), num PR à frente dos outros pedidos da fila.
14. PR #15 mesclado às 17:19 (depois de um conserto: o `docs_check.py` falhou no CI por exigir uma pasta que só existe depois de um teste rodar). PR #16, da liquidação, aberto com o CI verde. Em seguida, os pedidos do item 12: botão de colar (D65), stake sugerida em múltipla longa (D66), setas no campo de unidades (D67), a regra de valor ao copiar seguida à risca (D68) e a stake e a hora à vista em cada aposta lida (D69).
15. PR #16 mesclado às 17:42 e PR #17 às 17:46. A checagem de produção do #16 foi cancelada pela do #17 (o workflow `Produção` cancela a execução anterior do mesmo branch); a do #17 passou no commit `3491921`. O Lucas perguntou por que a do #16 "falhou" (respondido: cancelada, não falha) e se compartilhar a sessão já exigiria um backend. Respondido, sem implementar nada: mandar uma cópia já sai pelo backup por texto; acompanhar ao vivo, ou a mesma banca em dois aparelhos, é a etapa 2 do `docs/escala.md` e só começa se ele pedir. Às 17:57: "falta trazer a quantidade de unidades apostadas no evento, e de outras visualizações de unidades também, ganhos potenciais em reais e em unidades" (D70).
16. PR #18 mesclado às 18:33; o workflow `Produção` passou no commit `23ed70e`. Às 18:37, quatro coisas: perguntou se o retrospecto das três últimas lutas tinha sido feito (não tinha: ele mesmo tinha dito que avisaria; a pergunta voltou para ele); pediu busca pelo nome do lutador (D71); sugeriu separar o card em preliminar e principal para navegar melhor (D72); e perguntou da aposta com a luta em andamento, respondendo ele mesmo "deixa como tá" (D73).
17. PR #19 mesclado às 19:03; o workflow `Produção` passou no commit `c425193`. Às 19:24, com o card rolando, uma captura do iPhone e o pedido: a sinalização da seleção que bateu e da que foi perdida numa múltipla não está clara. Às 19:26: é de interface que ele fala; "de resto, acho que está funcionando bem, ele está mostrando as apostas conforme o evento vai transcorrendo" (D74). É o primeiro retorno dele com luta de verdade: as apostas fecharam sozinhas, e um empate real foi lido como empate. Às 19:36, outra captura: as informações de gestão de banca no topo da Carteira eram só texto, sem cor nem formatação (D75). Às 19:40, mais dois pedidos, **fora deste PR**: colar uma imagem que não está na galeria, e marcar toda aposta que vem do copiar como do tipster, para comparar com as dele.

## D1. Dinheiro fictício e marca própria

- **Contexto:** a referência era o bet365, mas sem dinheiro real.
- **Decisão:** saldo de mentira com depósito livre. Nome e identidade próprios ("Oito Lados", o octógono). Aviso de dinheiro fictício sempre visível.
- **Descartado:** copiar nome, cores ou layout de uma casa existente.
- **Consequência:** nada de pagamento, cadastro financeiro ou prêmio pode entrar sem rever esta decisão e os pontos jurídicos de `escala.md`.

## D2. Página estática que consulta a ESPN direto do navegador

- **Contexto:** o requisito de tempo real exige consultar a fonte a cada poucos segundos durante a luta.
- **Decisão:** um arquivo estático, sem backend. O navegador chama a API.
- **Descartado:**
  - Página hospedada dentro do Claude lendo um banco alimentado por tarefa agendada. Páginas publicadas lá não podem chamar APIs externas, e tarefa agendada roda no máximo de hora em hora. Serviria para odds semanais, não para tempo real.
  - Backend próprio com coletor. Desnecessário para um usuário (ver D11).
- **Consequência:** precisa de hospedagem estática com https. Só atualiza com o app aberto. Cada aparelho fala direto com a ESPN.

## D3. Fonte de dados: API pública da ESPN

- **Contexto:** precisava de odds reais, status ao vivo, resultado e quedas.
- **Decisão:** ESPN (`site.api.espn.com` e `sports.core.api.espn.com`), que traz odds da DraftKings.
- **Descartado:**
  - The Odds API: exige chave e, para MMA, cobre vencedor e pouca coisa de totais. Não traz resultado nem estatística.
  - BestFightOdds: só raspando a página.
  - UFC Stats: bloqueia leitura automática pelo `robots.txt`.
- **Consequência:** sem chave e sem custo, mas a API não é oficial nem documentada. Todo acesso passa pelos normalizadores e é vigiado por `tests/contract.py` e `tests/contract_live.py`.

## D4. Odd real e odd estimada ficam visivelmente separadas

- **Contexto:** a ESPN publica vencedor, método por lutador, "vai até a decisão" e uma linha de total de rounds. Não publica quedas, round exato nem linhas alternativas.
- **Decisão:** o que a casa publica é mostrado como está. O resto é calculado por um modelo e marcado com `≈` na interface e `src: 'est'` nos dados.
- **Descartado:** esconder a diferença, ou não oferecer os mercados sem linha real (quedas eram requisito).
- **Consequência:** nunca apresentar preço de modelo como se fosse da casa.

## D5. Modelo de preço ancorado nas linhas reais

- **Decisão:** probabilidades sem margem a partir das linhas reais; rounds de término em distribuição geométrica calibrada pela linha real de total; quedas por binomial negativa com a média de quedas de cada lutador e a duração esperada. Margem de 7% nas estimadas. Parâmetros em `CLAUDE.md`.
- **Descartado:** tabela fixa de odds por mercado (ignoraria a luta) e Poisson simples para quedas (subestima luta sem queda nenhuma).
- **Consequência:** as odds estimadas mudam quando as linhas reais mudam. Plausibilidade ainda não foi comparada com casas de verdade (ver `verificacao.md`).

## D6. Combinada na mesma luta por probabilidade conjunta

- **Contexto:** pedido de múltipla com a mesma luta "de uma maneira que faça sentido", exemplo KO e mais de 1,5 rounds.
- **Decisão:** enumerar os desfechos possíveis da luta e somar a probabilidade dos que satisfazem todas as seleções. Recusar o impossível e o redundante. Se a combinação equivale a um mercado existente, pagar a odd dele. Margem de 10%. Nunca pagar menos que a melhor perna.
- **Descartado:** multiplicar as odds (errado quando as pernas dependem uma da outra) e proibir mais de uma seleção por luta (era a primeira versão).
- **Consequência:** toda combinada é estimada. Numa múltipla, cada luta entra uma vez.

## D7. Liquidação automática com o resultado oficial

- **Decisão:** a aposta fecha quando a ESPN marca a luta como encerrada e publica o resultado. Quedas só fecham com a estatística congelada (2 minutos depois do fim). Regras completas em `CLAUDE.md`.
- **Descartado:** o usuário marcar o resultado à mão.
- **Consequência:** se a ESPN atrasar ou não publicar, a aposta fica aberta e depois é anulada pelos prazos definidos.

## D8. Dados no aparelho, saldo derivado

- **Decisão:** `localStorage`. O saldo não é guardado; é calculado de depósitos, stakes e pagamentos. Backup e restauração por texto na Carteira.
- **Descartado:** campo de saldo (pode divergir do histórico) e sincronização (ver D11).
- **Consequência:** um aparelho só. O Safari pode limpar dados de site sem uso.

## D9. Sem aposta ao vivo; revalidar antes de aceitar

- **Decisão:** mercados fecham quando a luta começa. Antes de gravar a aposta, o app recarrega placar e odds; se a luta começou recusa, se a odd mudou pede confirmação.
- **Descartado:** aceitar aposta com odd em cache.
- **Consequência:** apostar exige conexão.

## D10. Um arquivo, sem build

- **Decisão:** `index.html` com HTML, CSS e JS. `Core` puro e isolado dentro dele.
- **Descartado, por enquanto:** Vite, TypeScript e módulos (é a etapa 1 de `escala.md`).
- **Consequência:** publicar é copiar um arquivo. O custo é o arquivo crescer.
- **Revista pela D33** (mesmo dia): o código passou a ser TypeScript em módulos, com build. O que vai para o ar continua sendo um arquivo só.

## D11. MVP para um usuário; escala fica documentada

- **Contexto:** foi pedido que o app "escale" e, em seguida, decidido começar simples.
- **Decisão:** um usuário, sem backend. Validar hipóteses com uso real e escalar só se preciso.
- **Consequência:** hipóteses, gatilhos, etapas, modelo de dados e pontos jurídicos estão em `escala.md`. Nada disso deve ser implementado sem pedido.

## D12. Hospedagem: Vercel

- **Contexto:** precisa de https estático, barato, com deploy a cada merge.
- **Decisão:** Vercel ligada ao repositório.
- **Comparação usada (limites gratuitos conferidos em um comparativo de setembro de 2026 e na documentação do GitHub; reconferir antes de depender deles):**

  | Opção | Limite grátis | Observação |
  |---|---|---|
  | Vercel Hobby | 100 GB de tráfego, 100 deploys por dia | Só uso pessoal, não comercial. Ao estourar, pausa em vez de cobrar |
  | Netlify Free | 300 créditos por mês; deploy de produção gasta 15, 1 GB gasta 20 | Cerca de 20 deploys por mês. Estouro pausa todos os projetos da conta |
  | Cloudflare Pages | Banda e requisições estáticas ilimitadas, 500 builds por mês | Sem restrição relevante |
  | GitHub Pages | 100 GB por mês, site até 1 GB | No plano gratuito exige repositório público |

- **Descartado:** Netlify (poucos deploys por mês enquanto o app muda muito).
- **Consequência:** se o projeto virar comercial, o plano Hobby da Vercel deixa de servir.
- **Ocorrido em 09/10/2026:** o primeiro deploy falhou com `Configured Python entrypoint "main.py" was not found`. Na importação, a Vercel escolheu sozinha o preset "FastHTML", um framework Python (os testes do repositório são em Python). Correção: `vercel.json` com `"framework": null` e `"installCommand": ""`, que pela documentação da Vercel selecionam o preset "Other" e pulam a instalação, mais o `.vercelignore` tirando `tests/` do deploy.

## D13. Fluxo: branch, PR, CI, deploy no merge

- **Decisão:** nada vai direto para a `main`. Branch a partir da `main`, PR, testes no CI, merge publica em produção.
- **Consequência:** exige proteger a `main` no GitHub e ligar a Vercel ao repositório (ver pendências).

## D14. Licença MIT

- **Decisão:** MIT, em nome de Lucas Magalhães, escolhida na criação do repositório.

## D15. Dados de teste: inventado usa nome inventado

- **Decisão:** `tests/mock_espn.py` inventa lutas e resultados e usa só lutadores fictícios. As amostras em `tests/fixtures/espn/` são respostas reais e mantêm os nomes reais.
- **Descartado:** fixture inventado com nomes reais (publicaria resultado falso sobre pessoa real).

## D16. Harness contra alucinação

- **Contexto:** o projeto é mantido com ajuda de IA, que pode afirmar coisas que não verificou.
- **Decisão:** a verdade fica em coisas executáveis, e a IA é obrigada a passar por elas:
  1. `scripts/verify.sh`: um comando que diz se está certo.
  2. `tests/contract.py`: os leitores da ESPN são conferidos contra respostas reais gravadas.
  3. `tests/contract_live.py`: confere a API real, toda semana, no GitHub Actions.
  4. `tests/docs_check.py`: a documentação é conferida contra o código.
  5. Hook de parada do Claude Code: a IA não encerra a tarefa com checagem falhando.
  6. `verificacao.md`: o que foi verificado, como e quando, separado do que não foi.
  7. Regras em `CLAUDE.md`.
- **Consequência:** afirmar "funciona" exige saída de comando. O que não tem como testar fica escrito como não verificado.
- **Ajuste em 09/10/2026 (cobertura):** a cobertura de código do `index.html` passou a ser medida pelo navegador durante os testes (`tests/cov.py`) e cobrada no `verify.sh` completo, com mínimos de 95% das funções e 90% do código. A primeira medição achou uma função morta, que foi removida.
- **Ajuste em 09/10/2026:** a primeira execução de `contract_live.py` no GitHub falhou porque a ESPN recusa navegador headless. Em vez de disfarçar o navegador, o script passou a chamar a API pelo Python, identificando-se, e a conferir o cabeçalho de CORS. Máquina que não alcança a ESPN dá resultado inconclusivo, não falha.

## D17. KO e TKO são um mercado; desclassificação conta junto

- **Decisão:** igual à DraftKings, que publica "KO/TKO/DQ" numa linha só.

## D18. Contender Series escondido

- **Decisão:** eventos do Contender Series vêm no placar do UFC sem odds; o app não mostra.

## D19. Interface

- **Decisão:** português informal. Uma coluna de celular, abas embaixo, cupom em folha. Cantos vermelho e azul, dourado para seleção. Tema claro e escuro.

## D20. iPhone

- **Decisão:** página web adicionada à Tela de Início. PWA completo e app nativo ficam para depois.

## D21. Cashout devolve o valor integral, só antes da luta

- **Contexto:** pedido de opção de cashout nas apostas. Nas palavras do Lucas: "pode retornar o valor integral apenas se a luta não começou; se a luta está em andamento, congela cashout e apostas".
- **Revista em parte pela D27** (mesmo dia): o cashout não acaba mais quando a primeira luta de uma múltipla termina. O resto continua valendo.
- **Decisão:** o cashout devolve a stake inteira enquanto nenhuma luta da aposta começou. Luta em andamento congela. Luta começada ou terminada encerra o cashout, e a aposta segue para a liquidação normal.
- **Interpretação que precisou ser feita (confirmar com o Lucas):** numa múltipla, basta uma luta ter começado para o cashout acabar, mesmo que as outras ainda não tenham começado. A alternativa seria liberar de novo entre uma luta e outra.
- **Descartado:** cashout a valor de mercado (stake × odd × chance atual, com margem), que chegou a ser desenhado. Exigiria odds ao vivo, que a ESPN não publica, e o pedido foi por devolução integral.
- **Consequência:** antes da luta o cashout funciona como cancelar a aposta sem custo. Dá para apostar, ver a odd piorar e desistir de graça; é aceitável porque o dinheiro é fictício. Aposta com cashout entra no histórico com resultado zero e fica fora da taxa de acerto.

## D22. Repetir aposta enche o cupom, não aposta sozinha

- **Contexto:** pedido de repetir uma aposta com um toque.
- **Decisão:** o toque enche o cupom (mesmas seleções, mesmo tipo, mesmo valor) e abre. A confirmação continua no botão de apostar.
- **Descartado:** gravar a aposta direto no toque. Toda aposta passa pela conferência de odd e de início da luta, e a odd pode ter mudado desde a original.
- **Consequência:** só dá para repetir enquanto as lutas não começaram. Serve bem para refazer uma aposta depois de um cashout.

## D23. Máscara de milhares e moeda da simulação

- **Contexto:** pedido de máscara nos campos de valor, para operar acima de mil, e de opção para dólar e euro.
- **Decisão:** máscara no padrão brasileiro em todos os campos de valor. Moeda escolhida na Carteira entre real, dólar e euro.
- **Revista pela D28** (mesmo dia): a moeda passou a ser escolhida no depósito e a troca converte os valores.
- **Interpretação que precisou ser feita (confirmar com o Lucas):** trocar a moeda muda só o símbolo. Não há conversão nem câmbio, e não existem carteiras separadas por moeda. O formato numérico continua brasileiro nas três.
- **Consequência:** corrigiu de passagem um erro antigo: "1.000" digitado era lido como 1.

## D24. Unidade como porcentagem da banca

- **Contexto:** pedido de gestão de unidade. Nas palavras do Lucas: "uma unidade geralmente é 10% da banca, mas a porcentagem pode ser parametrizada".
- **Decisão:** unidade igual a uma porcentagem da banca, 10% por padrão, ajustável na Carteira. Atalhos em unidades no cupom e resultado em unidades na Carteira.
- **Interpretações que precisaram ser feitas:**
  - Banca é o saldo mais o que está em jogo, não só o saldo. **Confirmado pelo Lucas em 09/10/2026.**
  - A unidade acompanha a banca o tempo todo (não é fixada por período). **Confirmado na mesma resposta.**
  - No histórico, cada aposta é medida pela unidade do momento em que foi feita. (Esta não foi perguntada; segue como interpretação.)
- **Descartado:** unidade fixa em valor, digitada à mão.

## D25. Cashout por round: não agora

- **Contexto:** ideia de um cashout dinâmico conforme quem vence cada round, e pedido de procurar uma API ou um serviço de torcedores que pontue os rounds.
- **O que foi encontrado em 09/10/2026 (fatos de terceiros; reconferir antes de depender):**
  - Não existe pontuação oficial por round durante a luta: as notas dos juízes só são divulgadas no fim.
  - **Verdict MMA:** aplicativo em que torcedores pontuam cada round em tempo real, com um placar médio ("Global Scorecard"). A página deles não menciona API pública; os dados aparecem em transmissões da PFL por parceria.
  - **Sportradar MMA:** API paga com estatísticas por round e resumo ao vivo. A página consultada não fala em pontuação por round.
  - **SportsAPI Pro:** a documentação lista notas por round (pelo exemplo, disponíveis depois da decisão) e um endpoint de odds ao vivo durante a luta. Preço, cobertura do UFC e forma de acesso não estavam na página.
- **Decisão:** não fazer agora. O cashout segue a D21 (e, entre uma luta e outra, a D27). Se um dia houver odd ao vivo confiável, o caminho é cashout a valor de mercado, não pontuação de round.
- **Próximo passo combinado:** observar num card ao vivo o que a ESPN entrega durante a luta.

## D26. Copiar aposta de print ou texto, com leitura de imagem no aparelho

- **Contexto:** pedido de enviar o print de uma aposta, em imagem ou texto, e o app copiar a operação. O Lucas mandou dois exemplos reais: um print de casa de apostas e uma mensagem de canal de palpites. Regra dita por ele: "a odd pode ser diferente, mas aplique a mesma stake"; o valor em unidades.
- **Decisão:**
  - Texto é interpretado por um leitor determinístico (`Core.parseTip`), coberto por testes.
  - Imagem é lida no aparelho por OCR (Tesseract.js), baixado só quando se escolhe uma imagem.
  - A aposta copiada usa a odd de agora. O valor é o do original: em unidades quando o original fala em unidades, o mesmo valor em dinheiro quando traz dinheiro, e 1u quando não diz.
  - Nada é apostado sozinho: o resultado vai para o cupom.
- **Descartado:** ler a imagem com um serviço de IA de visão. Seria mais tolerante a formatos diferentes, mas exige servidor e chave paga, o que contraria a D11 (MVP sem backend), e mandaria a imagem para fora do aparelho.
- **Consequência:** é a primeira dependência de terceiros em tempo de execução (uma biblioteca baixada de CDN, com versão fixa e hash de integridade no script principal). O leitor só conhece os formatos que foram testados; formato novo pode não ser entendido, e a tela diz o que não entendeu.
- **Interpretação a confirmar com o Lucas:** num print com valor em dinheiro (R$ 1.750,00), o app copia o mesmo valor em dinheiro, não converte para unidades. **Resolvida pela D29:** virou configuração.
- **Revista pela D44** (10/10/2026): com várias apostas lidas de uma vez, elas podem ser feitas direto da tela de copiar, sem passar pelo cupom. Com uma só, continua indo para o cupom.

## D27. Cashout dinâmico em múltipla

- **Contexto:** ao confirmar a D21, o Lucas pediu: "seria bacana ter um cashout dinâmico, tipo se 2 da múltipla bateram e falta 1 ele calcula e te oferece um valor para encerrar, igual ocorre numa bet real".
- **Decisão:** quando parte da múltipla já bateu e o que resta ainda não começou, o app oferece um valor para encerrar: `retorno possível × chance de agora do que falta × (1 − 5%)`. Sem nenhuma luta decidida continua valendo a devolução integral da D21. Luta em andamento continua congelando.
- **Por que dá para fazer sem odd ao vivo:** entre uma luta e outra a ESPN ainda publica a odd pré-luta das lutas que restam, e é ela que dá a chance de agora. O que a D21 descartou foi cashout **durante** a luta, que segue impossível pela mesma razão.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Margem de 5% sobre o valor justo. Casas reais cobram algo assim; o número é uma constante (`CASHOUT_MARGIN`).
  - Se a perna que resta é de odd estimada, a oferta usa a estimativa do modelo.
  - Com perna já perdida não há oferta: a aposta fecha como perdida.
  - Vale para múltipla entre lutas. Combinada na mesma luta não tem oferta parcial, porque as pernas dela se decidem juntas.
- **Descartado:** cashout parcial (encerrar só parte do valor) e oferta com a luta rolando.
- **Consequência:** o cashout deixa de ser neutro no resultado: uma aposta encerrada assim entra no histórico com lucro ou prejuízo. A primeira versão da oferta lia a chance do vencedor no modelo conjunto, que não reproduz a moneyline exatamente quando há linhas de método; o teste ponta a ponta acusou a diferença (46,1% contra 46,8%) e a chance de um palpite de vencedor sozinho passou a vir da própria moneyline.

## D28. Moeda escolhida no depósito, com conversão da banca

- **Contexto:** ao revisar a D23, o Lucas pediu: "só deixa trocar moeda na hora de depositar; mudando na banca converte tudo, e cacheia o índice de conversão".
- **Decisão:** o seletor de moeda saiu do cartão próprio e foi para o cartão de depósito. Passar para outra moeda, com ou sem depósito, troca a moeda da banca e converte depósitos e apostas pela cotação do dia. A cotação fica guardada no aparelho por 12 h.
- **Fonte da cotação:** Frankfurter (`api.frankfurter.dev`), gratuito e sem chave. Escolhido por não exigir cadastro nem servidor, o que mantém a D11.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - A banca tem uma moeda só. Não existem carteiras separadas por moeda.
  - ~~A troca só acontece junto com um depósito: não há botão de converter sem depositar.~~ **Corrigida pelo Lucas no mesmo dia:** ele pediu o botão de converter a banca sem depositar. O cartão de depósito passou a ter os dois: converter e depositar, ou só converter.
  - Com a banca vazia não há o que converter, então a moeda muda sem consultar cotação.
  - Sem internet, vale a última cotação guardada, com a data na tela. Sem nenhuma guardada, não converte.
  - Os centavos de arredondamento vão para o maior depósito, para o saldo convertido bater exatamente.
- **Descartado:** carteiras por moeda; cotação digitada à mão; converter só o saldo e deixar o histórico na moeda antiga (o gráfico e as tabelas somariam moedas diferentes).
- **Consequência:** segunda dependência de terceiros em tempo de execução, depois do leitor de imagem. Se o serviço sair do ar ou mudar o formato, só a troca de moeda para; o resto do app não depende dele.

## D29. Print em dinheiro: mesmo valor ou mesma stake

- **Contexto:** perguntado se um print de R$ 1.750,00 deveria ser copiado como R$ 1.750,00 ou convertido em unidades, o Lucas respondeu: "quero ter uma opção, mas configuração que parametrize isso".
- **Primeira versão (algumas horas):** três modos, "Mesmo valor", "Em unidades" e "Fixo". O terceiro foi acréscimo meu.
- **Correção do Lucas, no mesmo dia:** "não precisa ter a opção de fixo; ou você copia o mesmo valor ou a mesma stake", e "quando for em unidades, copia a stake do print".
- **Decisão:** dois modos. **Mesmo valor** (padrão): o print de R$ 1.750,00 vira aposta de R$ 1.750,00. **Mesma stake**: o valor do print é dividido pelo valor de 1u de quem o fez e a aposta usa essa quantidade da unidade do Lucas. Print ou texto que já fala em unidades copia as unidades nos dois modos.
- **Por que o campo "1u do print" continua:** um print que só traz dinheiro não diz quantas unidades aquilo é para quem apostou. Sem esse número não há como copiar a stake, e o app cai no mesmo valor avisando.
- **Interpretações que seguem valendo:** a configuração é uma só para todos os prints (não há unidade de origem por canal ou por pessoa).
- **Limite conhecido:** o leitor não considera a moeda do print. Com a banca em dólar, um print de R$ 250,00 no modo "mesmo valor" vira US$ 250,00.
- **Consequência:** quem tinha salvo o modo "Fixo" volta para "Mesmo valor" (`Core.tipCfg` não reconhece mais o modo).
- **Revista pela D42** (10/10/2026): a configuração separada e o campo "1u do print" saíram. Mesmo valor ou mesma stake passou a ser a própria escolha de dinheiro ou unidades.

## D30. Valor da aposta em dinheiro ou em unidades, e atalhos altos

- **Contexto:** dois pedidos seguidos: "nas opções de aposta precisa ter 10000 e 100000 e 1000000" e "na hora de apostar quero a opção em unidades da banca".
- **Decisão:** uma segunda linha de atalhos no cupom (+10.000, +100.000, +1.000.000), somando como os que já existiam. E uma chave "Em R$ / Em unidades" que troca o campo de valor por um campo em unidades; a escolha fica salva.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Os atalhos de 0,5u a 3u já existiam; entendi o pedido como poder **digitar** qualquer quantidade de unidades.
  - Em unidades, os atalhos de dinheiro saem da tela e ficam só os de unidade e o "Tudo".
  - Os atalhos altos são do cupom. Os do depósito continuam em 100, 500, 1.000 e 5.000. **Interpretação errada, corrigida pela D39:** ele queria os altos no depósito também.
- **Descartado:** trocar o padrão para unidades sem ele pedir.
- **Revista pela D36** (10/10/2026): a chave saiu do cupom e virou configuração na Carteira.

## D31. Mais e menos como + e −, e cor de canto nas opções

- **Contexto:** "em vez de usar a linguagem menos use − e em vez de mais use +; e quando tiver rounds + vencedor (seja round exato ou mais/menos) precisa ter cores e diferenciação dos lutadores, encontre uma forma bacana de fazer isso".
- **Decisão:** total de rounds e de quedas passam a "+2.5" e "−2.5", com uma legenda curta no título do mercado. Toda opção que pertence a um lutador (método por lutador, vencedor e round, acerta queda) ganha barra e fundo leve na cor do canto dele, o cabeçalho da coluna ganha um traço da cor, e no cupom e nas apostas a seleção leva um quadradinho da cor.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Usei o sinal de menos tipográfico (−), que tem a largura do +. O leitor de texto aceita também o hífen.
  - Não existe um mercado único de "vencedor e mais/menos rounds". Essa aposta é feita combinando as duas seleções da mesma luta no cupom, e ali a seleção do lutador aparece com a cor dele. Não criei mercado novo. **Confirmado pelo Lucas em 10/10/2026** (D34).
- **Consequência:** apostas antigas guardam o texto da época ("Mais de 2.5 rounds").

## D32. Produção servindo versão antiga depois de merges em sequência

- **O que aconteceu (09/10/2026):** os PRs #4, #5, #6 e #7 foram mesclados em menos de um minuto. A Vercel criou um deploy de produção para cada merge. O do #4 (o mais antigo) terminou às 00:00:28 UTC, dois minutos depois do #7 (23:58:39), e o endereço de produção ficou com ele. O Lucas procurou o copiar aposta e a unidade e não achou.
- **Como foi confirmado:** aberto https://oito-lados.vercel.app no navegador do computador do Lucas, o arquivo servido tinha 90.037 bytes e o mesmo sha256 do `index.html` do merge do #4 (`f76c9fdf…`). O da `main` tinha 127.845 bytes.
- **Por que nada acusou:** o CI confere o código, não o que está no ar. Os quatro deploys aparecem como sucesso.
- **Decisão:** um workflow novo (`Produção`) compara, depois de cada push na `main`, o que a produção serve com o `index.html` do commit, e continua olhando por 5 minutos depois de bater. Em PR só informa.
- **Descartado:** carimbo de versão dentro do `index.html` (exigiria etapa de build, contra a D10) e promover deploy pela API da Vercel (exigiria guardar um token).
- **Regra de uso:** mesclar um PR por vez e esperar o deploy; quando um PR contém os anteriores, mesclar só ele.
- **O que não se sabe:** se a Vercel sempre aponta a produção para o último deploy a terminar, ou se foi circunstância. Fato de terceiro, visto uma vez.

## D33. Vite + TypeScript em módulos (etapa 1 da escala)

- **Contexto:** em um dia o `index.html` passou de 1.600 linhas, com cashout dinâmico, câmbio, copiar aposta e unidades entrando em sequência. Perguntado se era a hora de migrar, o Lucas respondeu: "pode migrar então para Vite + TypeScript".
- **Decisão:** o código saiu do `index.html` para `src/`, em TypeScript `strict`: `src/core/` com a lógica pura e `src/app/` com a página. Build pelo Vite 8.3.3 e TypeScript 7.0.2, em versões exatas.
- **O que não mudou, de propósito:**
  - O produto. Os mesmos testes passam com os mesmos números (340 unitários, saldo final de R$ 1.609,59 no ponta a ponta).
  - O que vai para o ar continua sendo **um arquivo só** (`dist/index.html`, com script e estilo dentro; desde a D37 há um segundo arquivo, o service worker). Assim os testes continuam abrindo a página do disco, o deploy continua sendo uma página estática e nada depende de outros arquivos chegarem.
  - Sem framework e sem dependência em tempo de execução. Vite e TypeScript são só de build.
- **Escolhas dentro da decisão:**
  - **Sem minificar.** A cobertura é medida por nome de função e linha no arquivo gerado, e o que é testado é exatamente o que é publicado. São uns 125 kB; para um usuário, o tamanho não pesa.
  - **Plugin próprio de um arquivo só**, com umas 25 linhas no `vite.config.js`, em vez do `vite-plugin-singlefile`: o pacote trazia uma dependência com aviso de segurança no `npm audit`.
  - **Carimbo de commit na página** (`<meta name="ol-commit">`), que só passou a ser possível com um build. A checagem de produção (D32) deixou de comparar o arquivo por sha256 e passou a ler o carimbo.
  - **`vite.config.js` em JavaScript**, para não precisar dos tipos do Node só por causa de um arquivo de configuração.
- **O que ficou para depois:** passar os casos de `tests/unit.py` para um executor de testes de TypeScript sem navegador (previsto na etapa 1 do `escala.md`); PWA. Os testes atuais continuam valendo porque exercitam a página gerada.
- **Consequência:** publicar passou a depender de um build na Vercel (`npm ci`, `npm run build`). Se o build falhar lá, a produção fica na versão anterior.
- **Como a migração foi feita:** o script antigo foi cortado nas próprias seções, cada corte virou um módulo, e só depois vieram os tipos. Antes de tipar, a página gerada já passava em todos os testes; depois de tipar, passou de novo. Três trechos foram reescritos para o compilador aceitar, sem mudar o resultado: `legOutcome` (uma variável para "o resultado, se a luta acabou"), `slipCalc` (o preço da combinada lido só quando ela é válida) e `doCashout` (a oferta calculada uma vez antes de pedir confirmação).

## D34. + e − com cores próprias, sem relação com lutador

- **Contexto (10/10/2026):** o Lucas mandou um print do "Total de rounds" dizendo que "faltou o esquema de cores". Pela D31 só opção de lutador tinha cor, e + e − não são de lutador nenhum. Perguntei qual das duas coisas ele queria: (1) um mercado novo de total de rounds por lutador, que aí teria as cores dos cantos, ou (2) um esquema de cores próprio para + e −. Resposta: "quero o 2".
- **Decisão:** + e − ganham um par de cores só deles (`--over` e `--under`), com fundo leve, rótulo colorido e uma seta (▲ no +, ▼ no −). A seta existe para a diferença não depender só da cor. A mesma marca aparece no cupom, na tela de copiar aposta e na lista de apostas.
- **Descartado:** usar vermelho e azul nessas opções (diria que o + é de um lutador e o − do outro) e criar o mercado por lutador (opção 1, que ele não quis).
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Vale também para o total de quedas, que usa o mesmo + e −.
  - As duas cores (um azul-petróleo e um violeta) fui eu que escolhi, longe do vermelho e do azul dos cantos e do verde e vermelho de ganho e perda.

- **Revista pela D41** (mesmo dia): as duas cores que escolhi destoaram do vermelho e do azul. + e − ficaram neutros.

## D35. Legenda dos cantos presa na tela

- **Contexto (10/10/2026):** "poderia ter um tooltip ou algum mecanismo para me lembrar quem é azul e quem é vermelho sem ter que scrollar tudo de novo".
- **Decisão:** com os mercados de uma luta abertos, uma faixa com os dois sobrenomes e a cor de cada canto fica presa logo abaixo da barra superior enquanto os mercados daquela luta rolam. Além disso, cada opção de lutador tem um `title` com o nome e o canto.
- **Descartado:** só o tooltip. No iPhone não existe ponteiro parado em cima de botão, então ele não resolveria onde o app é usado. Também descartado escrever o nome do lutador em toda opção: a grade ficaria ilegível em 393 px.
- **Interpretação que precisou ser feita:** os dois nomes ficam juntos à esquerda da faixa. Um em cada ponta ficaria em cima das colunas de + e − e daria a entender que cada coluna é de um lutador.

## D36. Dinheiro ou unidades é configuração, não chave do cupom

- **Contexto (10/10/2026):** "quero também que a estratégia de valores ou unidades fique parametrizável nas configurações em vez de ser para cada aposta". Revê a D30, que tinha posto a chave dentro do cupom.
- **Decisão:** a Carteira ganhou o título "Configurações" e o cartão "Valor das apostas", com "Em R$" e "Em unidades". Vale para todas as apostas. O cupom só diz qual está valendo e tem um atalho para mudar.
- **O que não mudou:** os atalhos de 0,5u a 3u continuam no cupom nos dois modos, e a escolha continua salva em `stakeIn`, então quem já tinha escolhido unidades continua em unidades.
- **Interpretação que precisou ser feita:** com a banca vazia não existe unidade. Em vez de travar o cupom, ele pede dinheiro até o primeiro depósito, e o cartão explica.

## D37. App guardado no aparelho: abre sem internet e avisa de versão nova

- **Contexto (10/10/2026):** "veja o que dá para cachear do app para a entrega ser mais rápida, tem o modo offline que você comentou e talvez pudesse avisar ao usuário que tem nova versão publicada e aí pedir que ele faça um hard update na versão".
- **Decisão:** um service worker (`src/sw.js`, publicado como `sw.js`).
  - Guarda a página no aparelho e responde toda abertura com essa cópia: abre na hora e abre sem conexão, com os últimos dados que o app já guardava.
  - Guarda fontes e arquivos do leitor de imagem na primeira vez que passam por ele.
  - Quando uma versão nova é publicada, ela é baixada e fica esperando. O app mostra "Saiu uma versão nova do app." com o botão "Atualizar agora". O toque troca a versão e recarrega: é o "hard update", sem a pessoa ter que limpar cache.
  - Um cartão "Versão do app" na Carteira mostra o commit da página e tem "Procurar versão nova".
- **Escolhas dentro da decisão:**
  - **A versão nova espera o toque.** Trocar o app sozinho, com um cupom aberto, perderia o que a pessoa estava fazendo.
  - **ESPN e câmbio nunca são respondidos pelo service worker.** Odd velha servida como nova é o pior erro que este app pode cometer. O app já guarda a última resposta por conta própria e mostra com a data.
  - **A versão é um hash da página sem o carimbo de commit.** Se fosse o commit, todo merge de documentação faria o aparelho pedir atualização sem nada ter mudado.
  - **Service worker escrito à mão**, umas 40 linhas, em vez de Workbox ou `vite-plugin-pwa`: são dependências grandes para o que cabe em um arquivo, e o projeto não tem dependência em tempo de execução.
- **O que muda em decisões antigas:** a D33 dizia que vai para o ar "um arquivo só". Agora são dois, porque o navegador exige que o service worker seja um arquivo à parte. A página continua inteira num arquivo.
- **Descartado, por enquanto:** `manifest.json` e ícone em arquivo (não foram pedidos; estão nas ideias) e notificação.
- **Consequência:** publicar deixou de trocar na hora o app de quem já abriu. Entre a publicação e o toque em "Atualizar agora", o aparelho roda a versão anterior. Para saber qual versão está no aparelho: cartão "Versão do app".
- **O que não se sabe:** como isso se comporta no Safari do iPhone e no app instalado na Tela de Início. Só foi testado no Chromium (ver `verificacao.md`).

## D38. Tema escolhido no app

- **Contexto (10/10/2026):** o app já tinha tema escuro, mas só seguindo o aparelho. Perguntado se queria escolher dentro do app, o Lucas respondeu: "sim, quero dark mode no app".
- **Decisão:** cartão "Aparência" nas configurações, com Automático, Claro e Escuro. A escolha fica salva (`theme`) e sobrevive a backup, restauração e a zerar a simulação.
- **Interpretação que precisou ser feita (confirmar com o Lucas):** o padrão continua sendo Automático. Não troquei o padrão para escuro.

## D39. Atalhos altos também no depósito

- **Contexto (10/10/2026):** "faltou opções de depósito de milhares, e milhão". Na D30 eu tinha posto os atalhos altos só no cupom e anotado isso como interpretação a confirmar; a resposta é que faltaram no depósito.
- **Decisão:** o cartão de depósito ganhou uma segunda linha de atalhos, 10.000, 100.000 e 1.000.000, na moeda escolhida para o depósito. Somam ao que está no campo, como os outros.
- **Interpretação que precisou ser feita:** usei os mesmos três valores do cupom. A primeira linha (100, 500, 1.000 e 5.000) ficou como estava.

## D40. Pares de cor para os cantos, por luta masculina e feminina

- **Contexto (10/10/2026):** "quero opções de temas de cores para os corners, pode ser azul × vermelho, verde × rosa, roxo × laranja" e, em seguida, "o esquema de cores pode ficar na parte de configurações e eu poderia definir o padrão das lutas femininas e masculinas".
- **Decisão:** três pares (vermelho e azul, rosa e verde, laranja e roxo). No cartão "Aparência" há uma escolha para as lutas masculinas e outra para as femininas. Tudo que leva cor de canto segue o par da luta: a linha do lutador, as opções, a legenda, e a marca da seleção no cupom, na tela de copiar e na lista de apostas.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - A cor quente fica sempre com o lutador de cima (o `a`): vermelho, rosa, laranja. A fria com o de baixo.
  - O padrão das duas escolhas é vermelho e azul. Não presumi rosa para as femininas.
  - Os tons fui eu que escolhi: verde puxado para o limão, para não parecer o verde de "ganhou", e laranja mais fechado que o dourado de seleção.
- **Como a luta feminina é reconhecida:** pela categoria da ESPN começando com "W " ("W Flyweight"), que é o que aparece nas respostas reais gravadas. **Limite:** um peso casado feminino vem como "Catchweight" e sai no par das masculinas. Não foi visto como a ESPN escreve esse caso.
- **Consequência:** a perna da aposta passou a guardar a categoria (`weight`). Aposta antiga, sem ela, usa a categoria da luta enquanto estiver no placar e depois o par das masculinas.

## D41. + e − neutros (revê a D34)

- **Contexto (10/10/2026):** "as cores das quedas na luta não ficaram boas, estão destoando do tom de vermelho e azul". O azul-petróleo e o violeta da D34 tinham sido escolha minha.
- **Decisão:** + e − passam a ser montados como a opção de um lutador (barra lateral e fundo leve), mas em tons neutros do tema: + mais forte, − mais claro, com ▲ e ▼.
- **Por que neutros e não outras duas cores:** com três pares nos cantos (D40), seis matizes já têm dono. Qualquer cor em + e − bateria com algum par; o violeta bateria com o roxo.
- **O que continua da D34:** + e − não usam cor de canto, a seta distingue os dois sem depender de cor, e vale para rounds e para quedas.

## D42. Copiar print: uma configuração só, sem a unidade de quem fez o print (revê a D29)

- **Contexto (10/10/2026):** "a mesma stake não precisa desse campo para inserir valor, você já sabe quanto vale minha unidade" e "sempre que eu escolher mesmo valor, fixa a opção acima para reais; se escolher mesma stake, fica a opção acima para unidades".
- **O que expliquei antes de mexer:** o campo não era a unidade dele, era a de quem fez o print; sem ela, um print só em dinheiro não diz quantas unidades aquilo era. Resposta: "ou aposta a mesma stake que ele, ou o mesmo valor. Não preciso replicar a banca do cara".
- **Decisão:** as duas escolhas ligadas viram uma. O cartão "Ao copiar um print" e o campo "1u do print" saíram. "Valor das apostas" (Em R$ ou Em unidades) decide também o que entra de um print:
  - **Em R$ (mesmo valor):** o dinheiro do original. Se o original só fala em unidades, entram essas unidades na unidade dele.
  - **Em unidades (mesma stake):** as unidades que o original diz. Se o original só traz dinheiro, entra o mesmo dinheiro, mostrado em unidades.
  - **Original com os dois** ("Stake 2u" junto de R$ 250,00): a configuração escolhe. Antes as unidades ganhavam sempre.
- **O que se perde, sabido e aceito:** ajustar a aposta de um tipster à banca do Lucas a partir de um print só em dinheiro.
- **Acréscimo da revisão:** quando o original traz os dois, a tela de copiar diz qual ficou de fora ("o original também fala em 2u"). Em R$, um texto de canal que cite um valor qualquer junto da stake em unidades copiaria esse valor; a linha deixa isso à vista antes de ir para o cupom.
- **Consequência:** o `tip` salvo por versão antiga é descartado na carga, e a escolha de dinheiro ou unidades fica como estava. Quem tinha "Mesma stake" com a unidade de origem preenchida perde a conversão.

## D43. O leitor de apostas aprende com prints reais: múltipla por lutador, cupom "1X2", simples ou múltipla

- **Contexto (10/10/2026):** três falhas no uso real. A mensagem "DUPLA / Fulano + Beltrano - Para vencer a luta" era recusada como ambígua; a foto de um cupom "1X2: V1: A - B ... Aposta 1756 BRL" não virava aposta; e o pedido: "ele tem que entender o conceito de dupla e tripla, quádrupla, quíntupla; ele tem que entender quando é uma aposta simples e quando é uma múltipla".
- **Como foi feito:** o mesmo leitor de imagem do app (Tesseract.js 7.0.0) foi rodado em Node sobre os cinco prints que o Lucas mandou, e o texto que saiu virou caso de teste com nomes inventados. O leitor de imagem leu os cinco direito; quem não conhecia os formatos era o leitor de texto.
- **Decisão:**
  - Um lutador de cada luta, juntos por "+" ou "e", é uma **múltipla por lutador**. Antes era erro ("ambíguo"). Ambíguo ficou só o caso em que o mesmo nome serve a dois lutadores do card.
  - "1X2: V1" e "V2" são o primeiro e o segundo nome da linha do cupom, não o lutador `a` e `b` do card.
  - Nomes em linhas seguidas e o mercado embaixo, total "Acima de (1.5)", valor "1756 BRL", odd com três casas e sufixo "Jr."/"III" comido pelo leitor de imagem passam a ser entendidos.
  - O leitor diz se o original é **simples ou múltipla** e de quantas seleções, pelas palavras do original ("dupla" a "sêxtupla", "múltipla", "acumulador", "Eventos: N", "simples"). Se diz tripla e só duas foram achadas, avisa em vez de montar uma dupla calado.
  - Uma odd só para várias seleções é a odd da aposta inteira, mostrada ao lado do que as mesmas seleções pagam agora.
- **O que o leitor não faz, de propósito:** inventar seleção. Os dois cupons de acumulador mandados imprimem os dois eventos e o mercado só do primeiro; a aposta da segunda luta não está na imagem. O app mostra a primeira, avisa que falta, e deixa esse cupom fora do "apostar todas".
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Sem nada dito no original, várias seleções continuam virando **uma múltipla** (regra antiga). É o caso das duas listas de seleções mandadas, que não dizem o tipo nem o valor.
  - Original que diz "simples" e traz várias seleções vira várias simples, cada uma com o mesmo valor.
  - "A + B por KO": só o vencedor é herdado pelo nome de trás. O A fica como vencedor presumido, com aviso.
- **Teste que mudou de propósito:** "Dunne e Teles" esperava o erro de ambíguo. Agora espera duas seleções de vencedor presumidas.
- **Não verificado:** os cinco prints contra o card de verdade da ESPN (daqui não dá para alcançá-la; o teste usou um card montado com esses nomes). Ver `verificacao.md`.

## D44. Várias fotos de uma vez, várias apostas de uma vez, e o botão Limpar

- **Contexto (10/10/2026):** "permita mandar várias fotos e fazer várias operações de uma vez" e "faz um botão pra limpar tudo do texto de input ali do campo de texto / imagem".
- **Decisão:** a tela de copiar passa a guardar uma lista. Cada foto é uma aposta, com o tipo, o valor e a origem; o texto colado é mais uma. Com duas ou mais, o botão "Apostar as N de uma vez" faz todas as que estão inteiras. "Limpar" apaga texto, lista e mensagem.
- **O que muda na D26:** lá, nada era apostado fora do cupom. O lote é a exceção, porque o cupom tem um valor só e cada foto traz o seu. Com uma aposta só, continua "Levar pro cupom".
- **Cuidados mantidos:** antes de gravar, placar e odds são lidos de novo; sem conexão, odd diferente ou luta começada, nada é gravado e a lista aparece com os valores novos para confirmar. Tudo ou nada: se uma das prontas não fecha, nenhuma é gravada. O preço de cada aposta sai da conta do próprio cupom.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Só entra no lote a aposta **inteira**: tudo que o original diz foi lido, tem odd agora e valor de pelo menos 1. As outras ficam na lista, com o motivo, e podem ir para o cupom uma a uma.
  - Uma foto sozinha, com a lista vazia, continua passando pelo campo de texto, para dar para corrigir o que o leitor leu.
  - Fechar a tela não apaga a lista nem o texto; "Limpar" apaga. Antes, fechar apagava o resultado.
- **Descartado:** fila que carrega uma aposta por vez no cupom (seriam N toques em "Apostar", e o pedido foi "de uma vez").

## D45. Completar o acumulador: pela foto da lista de seleções, por outro item ou à mão

- **Contexto (10/10/2026):** itens 1 e 2 das melhorias ("faz o 1 a 5"). O cupom de acumulador imprime os dois eventos e o mercado só do primeiro (D43), então a aposta ficava pela metade e fora do lote. As capturas do iPhone mostraram isso acontecendo em produção com os dois acumuladores. Na mesma leva de fotos o Lucas manda a lista de seleções da casa, que tem a seleção que falta e a odd de cada uma.
- **Decisão:** para cada luta que o original cita sem dizer a aposta, três caminhos, todos passando por `Core.completeTip`:
  - **Sozinho:** se outro item da lista é uma *lista de seleções* (não diz valor nem tipo) e traz uma seleção para aquela luta, ela é usada. Aparece marcada "Completada com a foto N", com "desfazer".
  - **Um toque:** cada seleção de outro item para aquela luta vira um botão "Usar da foto N".
  - **À mão:** um seletor com todos os mercados daquela luta e a odd de agora.
- **A lista de seleções vira referência:** a que serviu para completar outra aposta fica fora do lote e sai junto quando o lote é feito. Ela também empresta ao cupom a odd impressa de cada seleção.
- **Conferência:** se todas as seleções têm odd no print e o cupom dá a odd da aposta, a tela mostra a multiplicação e diz se bate (tolerância de 0,6%, para o arredondamento da casa). É a prova de que a seleção completada é a do original.
- **Mudou em relação à proposta:** o item 2 era "juntar duas fotos numa aposta só", com um botão. Virou preenchimento automático, porque com cinco fotos escolher os pares à mão dá mais trabalho que o problema. O "desfazer" e o botão por item cobrem o caso em que o automático erra.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Só uma lista **sem valor e sem tipo** completa sozinha. Uma simples de outra foto com a mesma luta não é usada sem toque: pode ser outra aposta na mesma luta.
  - Se duas listas discordam sobre a luta, nada é preenchido sozinho.
  - Desfeito um preenchimento automático, ele não volta sozinho naquele item.
  - Uma lista em que o valor foi digitado passa a ser aposta e deixa de completar as outras sozinha.
- **O que continua valendo da D43:** o leitor não inventa seleção. Sem lista e sem escolha, o acumulador fica incompleto e avisado.

## D46. Mudar valor e tipo na própria lista; lote só com valor dito ou digitado (revê a D44)

- **Contexto (10/10/2026):** item 3 das melhorias. Para mudar o valor de uma das fotos era preciso levá-la ao cupom, o que desfazia o "de uma vez".
- **Decisão:** cada item da lista tem um campo com o valor (em dinheiro ou em unidades, conforme "Valor das apostas") e, com mais de uma seleção, a escolha entre múltipla e simples. Campo vazio volta ao que o original diz.
- **Revê a D44:** lá, entrava no lote toda aposta inteira com valor de pelo menos 1, inclusive o "1u" presumido de um original sem valor. Agora só entra no lote a que tem valor **dito pelo original ou digitado**. Motivo: com as cinco fotos reais, as duas listas de seleções (sem valor) virariam duas múltiplas de 1u apostadas junto, sem ninguém ter pedido. No cupom o "1u" presumido continua valendo, porque lá a pessoa vê e confirma.
- **Fotos numeradas:** "Foto 1", "Foto 2", na ordem em que foram lidas. O nome de arquivo do iPhone é um código, como as capturas mostraram, e "Completada com a foto 2" precisa de um nome que a pessoa reconheça. "Limpar" recomeça a contagem.
- **Interpretação (confirmar com o Lucas):** em "simples" com várias seleções, o valor do campo é o de cada aposta, não o total.

## D47. De quem é a aposta, e resultado por origem

- **Contexto (10/10/2026):** item 4 das melhorias. O Lucas copia apostas de canais; saber qual canal dá resultado é a razão de usar o simulador.
- **Decisão:** um campo opcional "De quem é" na tela de copiar, com as origens já usadas como sugestão. Vale para toda aposta que sai dali, pelo cupom ou pelo lote, e fica em `from` na aposta. A lista de apostas mostra "De X". A Carteira ganha uma tabela por origem (apostas, apostado, resultado, ROI, acerto), que aparece quando existe aposta encerrada com origem; as sem origem ficam numa linha "Sem origem".
- **Descartado:** tentar adivinhar a origem pelo texto ou pelo print (nenhum dos originais mandados diz de que canal veio) e cadastro de canais (uma lista de sugestões resolve para um usuário).
- **Interpretações (confirmar com o Lucas):** a origem é texto livre, com até 40 caracteres, e duas grafias são duas origens; o campo fica preenchido enquanto a tela não for limpa; uma aposta repetida pelo botão "Repetir aposta" não herda a origem; cashout entra no resultado e fica fora do acerto, como no resto da Carteira.
- **Consequência:** `from` é um campo novo na aposta. Aposta antiga não tem e cai em "Sem origem".

## D48. A odd do print fica guardada com a aposta

- **Contexto (10/10/2026):** item 5 das melhorias. A odd do original aparecia na tela de copiar e se perdia quando a aposta era feita. Sem ela não dá para saber se a aposta copiada saiu melhor ou pior que a de quem publicou.
- **Decisão:** a odd impressa de cada seleção vai em `printed` na perna e, quando o original dá uma odd para a aposta inteira, em `printed` na aposta. `Core.printedEdge(bet)` compara com a odd pega: usa a odd da aposta inteira se houver; senão a das seleções, multiplicadas quando são de lutas diferentes. A lista de apostas mostra "odd do print X, você pegou Y (±%)" e a Carteira a média e quantas saíram acima (`Core.edgeSummary`).
- **Cuidado:** entre a tela de copiar e o botão "Apostar" o cupom pode mudar. A odd da aposta inteira só é gravada se as seleções do cupom ainda são exatamente as do original, e o que veio do print (`slip.copy`) é apagado quando o cupom esvazia, quando uma aposta é repetida e quando o cupom é começado à mão.
- **O que a comparação não diz:** a diferença mistura a casa (o print é de outra casa; aqui a odd é a da ESPN, ou estimada) com o tempo entre a publicação e a cópia. Combinada na mesma luta sem odd da aposta inteira fica fora da conta, porque multiplicar as pernas não é o preço dela (D6).
- **Interpretação (confirmar com o Lucas):** a média da Carteira é simples, uma aposta um voto, sem pesar pelo valor apostado.

## D49. Aviso de aposta repetida ao copiar

- **Contexto (10/10/2026):** item 1 da segunda leva de melhorias. No mesmo dia o Lucas mandou as mesmas cinco fotos duas vezes; com o lote, a segunda vez gravaria tudo em dobro.
- **Decisão:** a tela de copiar avisa, e deixa fora do "apostar todas", a aposta que já está aberta com exatamente as mesmas seleções, feita do mesmo jeito (`Core.dupBets`), e a que repete um item anterior da lista. "Apostar mesmo assim" libera; "desfazer" volta atrás.
- **Onde não vale:** no cupom. Repetir uma aposta de propósito já existe ("Repetir aposta"), e ali a pessoa está olhando para o que vai apostar.
- **Interpretações (confirmar com o Lucas):**
  - Só aposta **aberta** conta. A encerrada (inclusive por cashout) pode ser copiada de novo sem aviso.
  - "A mesma" é o mesmo conjunto de seleções e o mesmo tipo. A mesma dupla com outro valor é a mesma aposta; uma tripla que contém a dupla, não.
  - Com um item só na tela não há lote: o aviso aparece e a aposta segue para o cupom.
- **Teste que mudou de propósito:** no `tests/e2e.py`, a lista de seleções que ganhava um valor virava a quarta aposta do lote. Ela é exatamente a aposta do acumulador que completou, então agora fica de fora com "Igual à foto 3" até o toque. O texto colado igual à primeira foto também: o total deixou de contar a mesma aposta duas vezes (R$ 730,00 virou R$ 480,00).

## D50. Odd mínima ao copiar

- **Contexto (10/10/2026):** item 2. Copiar um canal tarde demais é apostar numa odd pior que a publicada; hoje isso só aparece depois, na comparação com o print (D48).
- **Decisão:** uma configuração no cartão "Ao copiar apostas": desligada, 3%, 5% ou 10% (`S.copyDrop`). Com ela ligada, a aposta cuja odd de agora está mais que isso abaixo da odd do print fica fora do lote, com o quanto caiu, até "Apostar mesmo assim".
- **Como compara** (`Core.copyDrop`): a aposta inteira quando o original dá a odd dela (ou a de todas as seleções, cada uma de uma luta); senão, a seleção que mais caiu. Simples são comparadas uma a uma. Sem odd no print, não há comparação nem aviso.
- **Interpretações (confirmar com o Lucas):** começa **desligada**, para não mudar o comportamento sem ele escolher; os degraus são fixos em vez de um campo livre; vale só para o lote, não para o cupom.
- **O que a comparação não separa:** casa diferente e tempo passado (mesmo limite da D48). Um print de casa com odd melhor que a da ESPN vai sempre parecer "caiu".

## D51. Corrigir o que foi lido

- **Contexto (10/10/2026):** item 4. Dava para completar o que faltava (D45), não para consertar o que o leitor entendeu errado. Com várias fotos nem dava para ver o texto que saiu de cada uma.
- **Decisão:** cada seleção lida tem "trocar", que abre os mercados daquela luta e a opção de tirar a seleção. Cada foto tem "Ver o texto lido" e "Corrigir no campo de texto", que leva o texto para o campo e tira a foto da lista.
- **Interpretações (confirmar com o Lucas):**
  - A seleção trocada perde a odd do print: ela era da seleção lida. A odd da aposta inteira, se o original dá, continua.
  - Trocar é dentro da mesma luta. Trocar de luta é corrigir o texto.
  - A correção feita numa lista de seleções vale para o acumulador que ela completa.
  - Corrigir uma seleção desfaz o "apostar mesmo assim", porque a aposta passou a ser outra.

## D52. Odd lida com dois-pontos

- **Contexto (10/10/2026):** item 5. No print real da lista de seleções o leitor de imagem leu "1.13" como "1:13", e aquela seleção ficava sem odd do print.
- **Decisão:** um dígito, dois-pontos (ou ponto e vírgula) e dois ou três dígitos, **no fim da linha**, numa linha sem data e sem outra odd, vale como odd.
- **Risco aceito:** uma hora escrita assim ("9:30") no fim da linha da seleção viraria odd 9.30. Nos cupons vistos a hora vem como "(14:14)" ou com dois dígitos antes dos dois-pontos, e não passa. Quando o cupom dá a odd da aposta, a conferência da D45 denuncia a leitura errada.
- **Teste que mudou de propósito:** o caso da lista com "1:13" em `tests/unit.py` esperava a seleção sem odd; agora espera 1.13.
- **Conferido com o print real:** com a lista de seleções do Lucas, o segundo acumulador passou a mostrar "1.13 × 1.26 = 1.424, bate com o cupom" (ver `verificacao.md`).

## D53. Origens: botões, renomear e juntar, filtro e odd por origem

- **Contexto (10/10/2026):** itens 6 e 8. A origem é texto livre (D47), então duas grafias viram duas origens, e a lista de sugestões usava um recurso do navegador que nem foi visto no iPhone.
- **Decisão:**
  - Na tela de copiar, as origens já usadas viram **botões** abaixo do campo. Um toque escolhe, outro tira.
  - No cartão "Ao copiar apostas", **renomear** uma origem (`Core.renameOrigin`). Dar o nome de outra junta as duas.
  - Na aba Apostas, um **filtro por origem**, que aparece quando alguma aposta tem origem.
  - Na tabela por origem, a **odd contra o print** de cada origem, embaixo do nome.
- **Mudou em relação à proposta:** deixar o nome em branco tiraria a origem das apostas. Saiu: um toque em "Renomear" com o campo vazio apagaria a origem de todas sem aviso. Sem nome novo, nada muda.
- **Interpretação (confirmar com o Lucas):** a odd contra o print por origem conta todas as apostas copiadas daquela origem, abertas ou não, e não segue o período da Carteira (a comparação de odd não depende de a luta ter acabado).

## D54. Quanto já está em jogo na luta

- **Contexto (10/10/2026):** item 7. Copiando de vários canais, dá para empilhar apostas na mesma luta, ou apostar nos dois lados, sem perceber.
- **Decisão:** na tela de copiar e no cupom, uma linha por luta que já tem aposta aberta: "Você já tem R$ X em jogo em A x B, em N apostas abertas", e "Esta vai contra ela" quando a aposta nova e a que existe não podem ganhar juntas.
- **Como decide o "contra":** as seleções das duas naquela luta não têm desfecho em comum no `jointModel`, o mesmo modelo que bloqueia combinada impossível (D6). Pega lados opostos, e também pares como "vai até a decisão" contra "menos de 1.5 rounds".
- **Interpretações (confirmar com o Lucas):** é aviso e não bloqueia (apostar contra pode ser proteção); a múltipla conta com o valor inteiro, porque todo ele depende daquela luta também; quando a aposta é idêntica a uma aberta, quem fala é o aviso da D49.

## D55. Período na Carteira

- **Contexto (10/10/2026):** item 9. A Carteira só mostrava o acumulado de tudo.
- **Decisão:** três períodos para os números de ganhos e perdas: Tudo, 30 dias e Último evento. Saldo e depósitos não seguem o período.
- **Interpretações (confirmar com o Lucas):**
  - 30 dias conta pela data em que a aposta **fechou**.
  - "Último evento" é o evento da aposta que fechou por último; uma múltipla entre eventos conta se tem seleção nele. A proposta dizia "este evento"; ficou "último" porque o evento que está na tela de Lutas costuma ser o próximo, sem nada encerrado.
  - A escolha não fica guardada: o app abre em Tudo.

## D56. Resumo do que fechou desde a última vez

- **Contexto (10/10/2026):** item 10. As apostas fecham sozinhas quando o app reabre, e o que avisava era um aviso de 4 segundos.
- **Decisão:** uma faixa no topo de qualquer aba: "Desde a última vez: N apostas fecharam · resultado", com a quebra por origem quando alguma tem origem. Fica até o toque em "Ok" ou em "Ver" (que abre as encerradas).
- **Interpretações (confirmar com o Lucas):** cashout não entra, porque foi a própria pessoa que fez e viu; a faixa também aparece para o que fecha com o app aberto, e some só com o toque; "a última vez" é o último toque em Ok ou Ver, guardado em `S.seen`.
- **Consequência:** um estado salvo por versão antiga, sem `seen`, recebe o instante da carga, para não anunciar o histórico inteiro. Zerar e restaurar fazem o mesmo.

## D57. Retrospecto dos lutadores: o que dá, e o custo (não implementado)

- **Contexto (10/10/2026):** "tem como eu ter um retrospecto das últimas lutas dos atletas? e isso ficar cacheado? tipo últimas 3 lutas? quantas decisões, quantos TKO, quantas subs, em quanto tempo terminou as lutas?" e depois "qual o peso disso na performance?".
- **O que foi visto na ESPN em 10/10/2026**, pelo resumo de uma ferramenta de leitura de páginas, **sem amostra gravada**:
  - `CORE/../athletes/{id}/eventlog`: a lista de lutas do atleta, da mais recente para a mais antiga, cada uma com a referência do evento e da luta e um `played`.
  - A luta (`events/{ev}/competitions/{luta}`) traz `winner` em cada competidor; o método, o round e o tempo estão no `status` dela, no formato que o app já lê.
  - A chamada de estatísticas do atleta, que o app já faz para a média de quedas, também traz `koPercentage`, `tkoPercentage` e `decisionPercentage` (esses três estão na amostra gravada em `tests/fixtures/espn/athlete_statistics.json`).
- **Custo estimado:** 7 chamadas por lutador para 3 lutas (1 da lista, 2 por luta), 14 por luta do card e umas 170 para um card de 12 lutas. Por isso a proposta é carregar só ao abrir os mercados de uma luta. Luta passada não muda, então fica guardada de vez; uns 400 bytes por lutador. O nome do adversário custaria mais uma chamada por luta passada.
- **Não sabido:** o tamanho de cada resposta e se a ESPN limita rajada de chamadas.
- **Decisão:** nenhuma ainda. O Lucas disse que avisa quando for para implementar. Antes do código, a regra 2 do `CLAUDE.md`: gravar a resposta real e pôr o caso em `tests/contract.py`.

## D58. Lista de copiar em uma linha por item

- **Contexto (10/10/2026):** item 2 da terceira leva. Com cinco fotos, cada uma com seleções, valor, tipo, avisos e botões, a tela de copiar ficou com muitas telas de altura, e o botão de apostar todas ia para o fim.
- **Decisão:** numa lista de várias, cada item é uma linha: rótulo, situação, seleções e valor. O toque abre e fecha. Na primeira vez que aparece, o item que precisa de atenção vem aberto; o que está pronto, ou é só lista de referência, vem recolhido.
- **Interpretações (confirmar com o Lucas):**
  - Depois da primeira vez, só o toque muda. Um item aberto não se fecha sozinho quando deixa de ter aviso, para não sumir debaixo do dedo de quem acabou de tocar em "Apostar mesmo assim".
  - O valor fica inteiro na linha; quem encolhe com reticências são as seleções.
  - Com um item só não há linha: ele aparece inteiro, como antes.
- **Consequência:** uma aposta pronta entra no lote sem que as seleções dela tenham sido vistas por extenso. A linha mostra as seleções e o valor, e o total está acima do botão.

## D59. Suas apostas no card da luta

- **Contexto (10/10/2026):** item 3. Na tela de Lutas não dava para saber em quais lutas já havia aposta.
- **Decisão:** a luta com aposta aberta mostra "N apostas · R$ X" no cabeçalho do card, e o toque leva à aba Apostas.
- **Interpretações (confirmar com o Lucas):** o valor é o mesmo do aviso da D54, com a múltipla contando inteira em cada luta dela (a soma das marcas do card passa do total em jogo); só aposta aberta conta; o toque abre a aba Apostas inteira, sem filtrar por aquela luta.

## D60. Apostas abertas agrupadas por evento, na ordem das lutas

- **Contexto (10/10/2026):** item 4. As abertas vinham da mais recente para a mais antiga, e copiando de vários canais a lista vira uma pilha sem ordem de uso.
- **Decisão:** as abertas são agrupadas por evento, o que começa primeiro em cima. Dentro do evento, vem na frente a aposta cuja primeira luta acontece antes; entre lutas do mesmo horário, o lugar da luta no card decide. Cada grupo diz quantas apostas tem, quanto está em jogo e quanto paga se todas baterem. As encerradas não mudam.
- **O que se perde, sabido:** a aposta recém-feita deixa de aparecer no topo. Depois de apostar, a tela continua indo para a aba Apostas, mas a aposta nova pode estar mais abaixo.
- **Interpretações (confirmar com o Lucas):**
  - A ordem é pela **primeira** luta da aposta, mesmo que ela já tenha acabado e a múltipla siga aberta por outra.
  - Múltipla entre eventos vai num grupo "Vários eventos", posto pela data da primeira luta dela.
  - "Se todas baterem" é a soma dos retornos, que apostas uma contra a outra não conseguem pagar juntas. O número é um teto, não uma previsão.

## D61. Resultado em unidades por origem

- **Contexto (10/10/2026):** item 5. A tabela por origem mostrava dinheiro e ROI, e uma aposta grande decide os dois. Para comparar canais, a régua é a unidade.
- **Decisão:** embaixo do resultado em dinheiro de cada origem vai o resultado em unidades, somando `(payout − stake) / unit` com a unidade do dia de cada aposta, a mesma conta do total da Carteira (D24).
- **Limite:** aposta antiga, sem `unit`, fica fora da soma em unidades e dentro da soma em dinheiro, como já acontece no total.

## D62. Os casos do núcleo rodando sem navegador

- **Contexto (10/10/2026):** item 10, que estava nas ideias desde a D33. Na proposta eu disse que isso deixaria a verificação mais rápida. **Medi antes de fazer e não é verdade:** o `tests/unit.py` leva 1,3 s.
- **Decisão:** feito mesmo assim, pelo que ele de fato entrega. Os casos saíram de dentro do `tests/unit.py` para `tests/unit.cases.mjs`, e dois executores rodam os mesmos casos:
  - `tests/unit.py`, no navegador, contra a página gerada. Continua sendo o que testa o que vai para o ar e o que conta para a cobertura.
  - `tests/core.mjs`, no Node: constrói `src/core` sozinho com o mesmo Vite, arma `window`, `document`, `localStorage` e `fetch` para estourarem se forem tocados, e roda os casos. Leva 0,7 s e entra no `verify.sh`, rápido e completo.
- **O que se ganha:** a prova de que o núcleo roda fora da página, que até aqui era só uma busca de texto no `docs_check.py`. É o que a etapa 2 do `escala.md` vai precisar se o núcleo for para um servidor. E os casos do núcleo passam a poder rodar sem Playwright.
- **O que não se ganha:** tempo. A verificação ficou 0,7 s mais longa.
- **Descartado:** tirar o `unit.py` (a cobertura é medida no navegador, sobre a página publicada; sem ele as funções do núcleo apareceriam como nunca chamadas) e passar os casos para TypeScript (muitos passam dados tortos de propósito; seria reescrever 451 casos para agradar o compilador).
- **Exceção registrada:** o `core.mjs` é o único teste que não roda contra `dist/`.

## D63. Notificação quando a aposta é resolvida: o que dá, e o que exige (não implementado)

- **Contexto (10/10/2026):** "tem como mandar alguma notificação quando a aposta foi resolvida? Uma notificação tipo push? Se eu adicionar a página do Safari à minha tela inicial, é possível que chegue alguma notificação?"
- **Conferido em 10/10/2026:**
  - Desde o iOS 16.4, um app web adicionado à Tela de Início pode pedir permissão e receber Web Push; o pedido tem que vir de um toque. O que faz do site um app da Tela de Início é um manifest com `display` `standalone` ou `fullscreen`. Fonte: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
  - Na Vercel, o plano Hobby só roda tarefa agendada uma vez por dia, com precisão de uma hora; de minuto em minuto, só no Pro. Fonte: https://vercel.com/docs/cron-jobs/usage-and-pricing
- **O que isso quer dizer:** com o app fechado, nada no aparelho acorda a página. Alguém de fora tem que saber em quais lutas há aposta aberta, vigiar a ESPN e disparar o push. É um servidor, e sai do escopo da D11.
- **Caminho proposto ao Lucas, em dois passos:** (1) `manifest.json`, ícone e o botão de permissão, sem servidor, para ver no iPhone dele se a parte da Apple funciona; (2) um disparador mínimo, que recebe do app só a inscrição do push e os ids das lutas com aposta aberta, e manda "a luta acabou". O resultado em dinheiro continuaria calculado no app.
- **Não sabido:** onde rodar de graça com a frequência necessária, e se a ESPN responde a um servidor desses (ela recusa navegador automatizado).
- **Decisão:** nenhuma. Espera o Lucas.

## D64. Resolver a aposta mais cedo e sem anular por engano

- **Contexto (10/10/2026):** o pedido do item 13 da linha do tempo, na primeira noite em que o app roda com luta de verdade. O caminho de liquidação nunca foi visto ao vivo.
- **O que a revisão achou:**
  1. **A aposta de vencedor esperava o método.** A luta aparecia como encerrada, com o vencedor marcado no placar, e a aposta só fechava depois de o resultado oficial (método, round, tempo) ser lido, que é outra chamada e pode chegar depois.
  2. **Um nome de resultado desconhecido anulava na hora.** Se a ESPN publicasse o resultado com um nome que o leitor não classifica, toda aposta de método, round e total daquela luta era anulada imediatamente e sem volta. O `CLAUDE.md` dizia "depois de 1 dia"; o código só esperava um dia quando o resultado não vinha, não quando vinha com nome estranho.
  3. **Depois do fim da luta o app perguntava devagar.** Sem outra luta ao vivo, o intervalo caía para 30 s justamente enquanto uma aposta esperava o resultado.
- **Decisão:**
  1. Vencedor decide com a luta encerrada e o vencedor marcado no placar, sem esperar o método. Um no contest já lido continua anulando.
  2. Resultado com nome desconhecido não anula nada por 1 dia: é pedido de novo a cada sincronização e o nome aparece na aposta. Depois de 1 dia vale a regra antiga.
  3. Enquanto uma aposta aberta espera por uma luta que já acabou, o app pergunta a cada 8 s, por até 30 min.
  4. A aposta aberta diz o que está esperando: "Fulano venceu · método ainda não publicado", ou "esperando as quedas fecharem (até 2 min)".
  5. Voltar ao app sincroniza também quando a página é restaurada da memória ou a conexão volta.
- **Conferido na ESPN de verdade em 10/10/2026** (workflow `ESPN contract`, execução 38082833284, 160 lutas encerradas dos últimos 120 dias): os seis nomes de resultado vistos são todos classificados; toda luta com vencedor tinha o vencedor marcado no placar; todas tinham resultado. A varredura passou a fazer parte da conferência semanal.
- **O que continua igual, de propósito:**
  - Quedas esperam 2 min depois de a luta aparecer como encerrada, para a estatística parar de mexer. Uma múltipla com perna de quedas espera junto.
  - Uma perna já perdida com a luta em andamento (um "acaba no round 1" com a luta no round 3) só vira prejuízo quando a luta acaba. Aparece como "já perdeu", e o dinheiro só se mexe com a luta encerrada.
  - Nada acontece com o app fechado. Ao abrir, a primeira sincronização liquida o que ficou.
- **O que não se sabe:** quanto tempo a ESPN leva, depois do gongo, para marcar a luta como encerrada, marcar o vencedor e publicar o resultado. Esse atraso não é do app e só esta noite mostra. Se a ESPN marcar o vencedor junto com o resultado, o item 1 não ganha tempo nenhum; não perde nada.
- **Risco aceito no item 1:** a aposta de vencedor fecha com a marca do placar. Se a ESPN marcar o vencedor errado e corrigir depois, a aposta já fechou. O mesmo valia antes, com o resultado lido.
- **Teste que mudou de propósito:** o caso "luta encerrada, resultado não publicado" esperava a aposta de vencedor pendente; agora espera decidida quando há vencedor marcado e pendente quando não há.

## D65. Botão de colar na tela de copiar

- **Contexto (10/10/2026):** "falta um botão para eu colar o texto da minha área de transferência".
- **Decisão:** o botão "Colar" lê o texto da área de transferência, põe no campo e já lê a aposta, num toque só.
- **Interpretações (confirmar com o Lucas):** só texto; imagem continua entrando por "Escolher fotos" ou pelo gesto de colar. Colar já lê, sem precisar tocar em "Ler texto".
- **Fato de terceiro, não conferido no aparelho:** no Safari do iPhone, ler a área de transferência por um botão costuma abrir um balãozinho "Colar" do sistema para confirmar. Se o navegador recusar, a tela diz para colar no campo.

## D66. Stake sugerida em múltipla longa

- **Contexto (10/10/2026):** "quando for uma múltipla com mais de quatro operações envolvidas em uma única aposta, você já pode sugerir uma stake de 0.2 a 0.4 em unidades".
- **Decisão:** numa múltipla de cinco seleções ou mais, o cupom e a lista de copiar mostram os atalhos 0,2u, 0,3u e 0,4u e uma linha dizendo que é a faixa sugerida.
- **Interpretações (confirmar com o Lucas):**
  - "Mais de quatro" é cinco ou mais. A de quatro não recebe sugestão.
  - Contam as seleções, inclusive as combinadas na mesma luta: três lutas com duas combinadas são cinco seleções.
  - É sugestão, não preenchimento. Uma múltipla longa copiada de um print sem unidades continua entrando com 1u (D68), com os atalhos ao lado.
  - Vale para múltipla; cinco simples no mesmo cupom não recebem sugestão.

## D67. Setas de meia unidade no campo de unidades

- **Contexto (10/10/2026):** "na hora de colocar unidades, poderia ter um cursorzinho de meio, para cima e para baixo, porque fica mais fácil ir na setinha do que digitar".
- **Decisão:** o campo em unidades, no cupom e em cada item da lista de copiar, tem um botão de cada lado. Cada toque leva à meia unidade seguinte ou anterior.
- **Interpretações (confirmar com o Lucas):** de um valor quebrado, a seta vai para a meia unidade mais próxima naquela direção (de 0,3u sobe para 0,5u, não para 0,8u); abaixo de 0,5u a seta para baixo zera; em dinheiro não há setas.
- **Na lista de copiar,** zerar pela seta devolve o item ao valor do original, como apagar o campo (D46).

## D68. Ao copiar, a configuração é seguida à risca (revê a D42)

- **Contexto (10/10/2026):** "quando eu estou colocando a imagem e aparece lá 1750, ele está considerando o valor e não a unidade. Se é valor, copia exatamente o que o cara postou. Se não, copia em unidade. Se não especificar a quantidade de unidades, você considera uma unidade. Tem que seguir o que foi parametrizado: ou ele vai seguir a stake, ou ele vai seguir o valor."
- **O que a D42 fazia:** com a configuração em unidades, o print que só trazia dinheiro entrava com o mesmo dinheiro, mostrado em unidades. Era o caso que "se enrolava": a configuração dizia unidades e a aposta seguia o valor.
- **Decisão:**

  | Configuração | Print só com dinheiro | Print com unidades | Print com os dois | Print sem valor |
  |---|---|---|---|---|
  | Em R$ | o mesmo valor | essas unidades, na sua unidade | o dinheiro | 1u |
  | Em unidades | **1u** | essas unidades | as unidades | 1u |

- **O lote:** o 1u do print com dinheiro, em unidades, é regra dita pelo Lucas e conta como valor dito: a aposta entra no "apostar todas". O 1u do original que não diz valor nenhum (a lista de seleções) continua fora do lote (D46).
- **A tela diz de onde veio:** "1u, pela sua configuração: o print só traz R$ 1.750,00, que não é copiado".
- **Teste que mudou de propósito:** em unidades, o texto de R$ 250,00 era esperado com R$ 250,00 (2,5u); agora é esperado com 1u.

## D69. A stake e a hora de cada aposta à vista, e o consolidado em unidades

- **Contexto (10/10/2026):** "eu quero que em cada aposta fique claro quantas unidades eu estou colocando em jogo, a stake de cada oportunidade, a hora de cada oportunidade, para poder conferir o consolidado ali".
- **Decisão:**
  - Na lista de copiar, a linha de cada item traz a hora da primeira luta e a stake dos dois jeitos, na ordem da configuração; cada seleção, aberta, diz a hora da luta dela; o total do lote vem também em unidades.
  - Na aba Apostas, o total em jogo de cada evento vem também em unidades.
- **Interpretação que precisou ser feita (perguntada ao Lucas, sem resposta ainda):** "a hora de cada oportunidade" foi lida como a hora da **luta**, que o app conhece sempre. A hora em que o canal postou só existe em alguns prints e não é lida.
- **O que já existia:** na aba Apostas cada aposta já mostrava a stake em unidades, a hora de cada luta e a hora em que foi feita.

## D70. Unidades e ganho possível em toda tela que mostra dinheiro em jogo

- **Contexto (10/10/2026, 17:57):** "falta trazer a quantidade de unidades apostadas no evento, e de outras visualizações de unidades também, ganhos potenciais em reais e em unidades".
- **Decisão:**
  - Duas palavras, com sentido fixo no app inteiro: **retorno** é o que volta se a aposta bater (stake × odd); **ganho** é o retorno menos a stake.
  - Onde aparece dinheiro em jogo aparece também em unidades, e onde aparece o retorno possível aparece o ganho possível, em dinheiro e em unidades:
    - cada evento da aba Apostas abre com um quadro: em jogo (R$ e u), retorno, ganho (R$ e u); com apostas em mais de um evento, um quadro "Tudo em aberto" antes dos grupos;
    - cada aposta aberta ganha a linha "Ganho se bater"; a encerrada mostra o resultado também em unidades;
    - a marca no card da luta ("N apostas · R$ X") ganha as unidades, e o aviso de quanto já está em jogo numa luta também;
    - a Carteira diz, embaixo do saldo, o que está em jogo em unidades e o retorno e o ganho se todas baterem; as tabelas por mercado e por evento trazem o resultado em unidades;
    - o cupom ganha "Ganho possível"; a lista de copiar diz o ganho de cada item e o retorno e o ganho do lote;
    - a faixa "Desde a última vez" diz o resultado também em unidades.
  - Em aposta já feita, as unidades são as da unidade do dia dela, como na D61 e na D69: a unidade muda com a banca, e medir pela de hoje mudaria o tamanho de uma aposta antiga. No cupom e na lista de copiar vale a unidade de agora, que é a que a aposta vai guardar.
  - Num total, a aposta sem unidade guardada (anterior à D30) conta só em dinheiro, e o quadro diz de quantas são as unidades.
- **Interpretações que precisaram ser feitas:**
  - "Ganhos potenciais" foi lido como o **lucro** (retorno menos a stake), e o retorno continua ao lado. Em casa de apostas a expressão às vezes quer dizer o retorno inteiro; com os dois na tela, cada um com seu nome, não há como confundir.
  - O retorno não vem em unidades: seria um terceiro número em unidades em cada quadro, e o que se mede em unidades é a stake e o lucro.
  - "Se todas baterem" vale para o total de um evento e para o total em aberto, mesmo quando há apostas uma contra a outra, que não batem juntas (como na D60).
- **O que já existia:** as unidades em jogo por evento entraram no PR #17 (D69), entre parênteses numa linha de texto, 11 minutos antes do pedido. O app do aparelho só troca de versão com o toque em "Atualizar agora" (D37), então é possível que o pedido tenha sido feito olhando a versão anterior. Não foi confirmado.

## D71. Busca de luta pelo nome do lutador

- **Contexto (10/10/2026, 18:37):** "teria como pesquisar pelo nome dos lutadores, se eu quiser achar rápido".
- **Decisão:** um campo "Buscar" na tela de Lutas. Acha por um pedaço do nome de qualquer um dos dois lutadores, sem depender de acento ou caixa; com mais de uma palavra, todas têm que aparecer. A lista muda enquanto se digita.
- **Interpretações que precisaram ser feitas:**
  - A busca cobre **todos os eventos carregados**, não só o que está na tela: "achar rápido" inclui o lutador que luta na semana que vem. A luta achada em outro evento aparece com o nome do evento, que é um botão para abrir aquele card.
  - **Buscar não faz chamada à ESPN.** Procura no placar que o app já tem. As odds de outro evento só são pedidas quando o card dele é aberto, como já acontece ao trocar de evento no alto. Carregar as odds de cada evento a cada letra digitada custaria uma chamada por luta.
  - Procura por pedaço do nome, não por palavra inteira: "kess" acha Kessler. O custo é uma busca curta ("ar") achar muita coisa.
- **Cuidado de iPhone:** um botão tocado não tira o foco de um campo, e o app não repinta a tela com o foco num campo (para não derrubar o que se digita). Sem tratar isso, a odd tocada durante a busca não apareceria marcada. A lista debaixo do campo passou a ser repintada sozinha. Testado com um clique que não move o foco; **não visto no iPhone**.

## D72. Card principal e preliminares, com um toque para ver uma parte só

- **Contexto (10/10/2026, 18:37):** "teria como você separar em card preliminar e principal para ficar mais fácil navegar também".
- **O que já existia:** a lista já vinha com os títulos "Card principal", "Preliminares" e "Primeiras preliminares", em letra pequena, numa lista só.
- **Decisão:** botões acima da lista ("Tudo", "Principal", "Preliminares", "Primeiras"), cada um com o número de lutas, que mostram uma parte só. Os títulos continuam.
- **De onde vêm as partes:** das horas das lutas, como antes. A ESPN, nos campos que o app lê, não diz a que parte do card a luta pertence. A hora mais tardia é o card principal; com três horas ou mais, a mais cedo são as primeiras preliminares. A regra foi para o núcleo (`Core.cardSections`) e ganhou testes; **não mudou**.
- **Interpretação:** "separar" foi lido como poder ver uma parte por vez. O app abre em "Tudo" e a escolha não é guardada.
- **Não verificado:** se num card de verdade as lutas do card principal têm todas a mesma hora na ESPN. É a suposição que a tela já fazia.

## D73. Aposta com a luta em andamento fica de fora

- **Contexto (10/10/2026, 18:37):** "ficaria muito ruim habilitar a aposta durante a luta? Acho que sim, né? Deixa como tá, porque pode complicar muito e forçar muita chamada para a ESPN".
- **Decisão do Lucas:** fica como está. A aposta trava quando a luta começa.
- **O que pesa além das chamadas:** a ESPN não publica odd com a luta em andamento (é por isso que o cashout congela). Não haveria preço para cobrar; seria preciso estimar a odd ao vivo, e errar isso é dar dinheiro de graça ou tirar.

## Retrospecto dos lutadores, de novo (D57)

Em 10/10/2026, às 18:37, o Lucas perguntou: "as três últimas lutas, você conseguiu fazer aquele lance de quantas por finalização, quantas por KO, quantas por decisão? Eu não vi isso implementado". Respondido: não foi feito, porque ele tinha dito que avisaria. A pergunta foi devolvida a ele ("é pra fazer agora?"), sem presumir a resposta. O que falta antes do código continua sendo gravar a resposta real da ESPN (regra 2 do `CLAUDE.md`): desta máquina o terminal não alcança a ESPN, então a amostra teria que ser capturada por um workflow no GitHub ou por ele.

## D74. Onde está cada seleção de uma aposta, em palavras e em cor

- **Contexto (10/10/2026, 19:24 e 19:26, com o card rolando e uma captura do iPhone):** "a terminologia da aposta que, numa múltipla, já bateu, e da que foi perdida, não tá legal, tem que ficar bem mais claro" e "estou falando de UX e UI, principalmente UI. De resto, acho que está funcionando bem".
- **O que a captura mostrava:**
  - Uma múltipla aberta cuja primeira luta tinha acabado em **empate**. A seleção trazia só um círculo cinza pequeno com uma seta e a palavra "Empate". Nada dizia que ela estava anulada nem o que isso fazia com a múltipla. E a aposta continuava mostrando odd 3.44 e retorno de R$ 13.760,00, quando já pagava 1.68 e R$ 6.720,00.
  - Outra múltipla com a primeira luta em "AO VIVO · R1 3:11", que o Lucas já sabia perdida. O que a ESPN dizia naquele instante não dá para saber daqui; minutos depois ela dava a luta como encerrada, com o outro lutador vencedor.
- **Decisão:**
  - Cada seleção vira um bloco com a borda na cor do estado e uma etiqueta com o estado em palavras: Bateu, Perdeu, Anulada, Ao vivo, Vai começar, Aguardando, Não começou, Não contou.
  - A múltipla conta as seleções por estado embaixo do título.
  - Seleção anulada numa múltipla: o bloco explica ("Sai da múltipla: esta luta passa a valer odd 1.00."), a odd dela aparece riscada, e a odd, o retorno e o ganho da aposta passam a ser os que ela paga agora, com "era X" ao lado. Os totais do evento e da Carteira acompanham. **Isso corrige número errado na tela, não só aparência:** o que a aposta pagava de verdade já estava certo na liquidação.
  - Luta que a ESPN já dá como em andamento, mas sem round ("R0"), aparece como "vai começar".
- **Interpretações que precisaram ser feitas:** as palavras de cada estado; "Não contou" para a seleção de que a aposta não precisou; "Bateu" e "Perdeu" já com a luta rolando quando o resultado está decidido no papel (era "já bateu" numa linha pequena).
- **O que não muda:** quando a aposta fecha. Se a ESPN demora para dar a luta como encerrada, a seleção continua "Ao vivo" até lá.
- **Fatos da ESPN vistos de passagem, em 10/10/2026, pelo resumo de uma ferramenta de leitura de páginas, **sem amostra gravada**:** o empate vem como `result.name` "draw", sem vencedor marcado no placar (era um dos três nomes que nunca tinham aparecido); a luta prestes a começar vem como "STATUS_PRE_FIGHT" com `state` "in" e `period` 0; o card de verdade tinha sete lutas numa hora e cinco em outra, o que bate com a regra das partes do card (D72); e o relógio do placar de uma luta encerrada (3:11) somava 5:00 com o do `status` (1:49).

## D75. Gestão da banca no topo da Carteira

- **Contexto (10/10/2026, 19:36, com uma captura do iPhone):** "essas informações de gestão de banca podem ficar melhor para o usuário, dá para ficar melhor organizado também. Tá só um texto aí, não tem nenhuma cor, não tem formatação". A captura mostrava, embaixo do saldo, duas frases corridas: o que estava em jogo e o retorno e o ganho se todas batessem (o que a D70 tinha posto ali uma hora antes).
- **Decisão:** as frases viram o cartão "Gestão da banca": três números lado a lado (banca, em jogo, uma unidade) e dois quadros coloridos, um verde para "se todas baterem" e um vermelho para "se todas perderem", cada um dizendo para quanto a banca vai.
- **Interpretações que precisaram ser feitas:**
  - **O quadro "se todas perderem" é novo.** Ele não pediu; é a outra metade da mesma conta (o que está em jogo, dito como perda) e é o que faz daquilo gestão de banca: o pior e o melhor caso lado a lado.
  - O valor da unidade sobe para o topo. Continua também no cartão de configuração da unidade.
- **Junto, sem ele pedir:** nos quadros de três números, valores a partir de R$ 100.000,00 quebravam no meio do número em 393 px. A banca dele é dessa ordem (R$ 100.000,00 depositados). Os quadros passam a dois por linha quando um número é longo.

## Pendências em 10/10/2026

| Pendência | Quem resolve |
|---|---|
| Proteger a `main` exigindo PR e os checks do CI | Lucas |
| Confirmar a margem de 5% e as outras interpretações do cashout dinâmico (D27) | Lucas |
| Confirmar as interpretações da conversão de moeda (D28) | Lucas |
| Testar o copiar aposta no iPhone com prints reais, agora com várias fotos de uma vez e com o card de verdade (D43, D44) | Lucas |
| Confirmar as interpretações do leitor (várias seleções sem tipo dito viram múltipla; "simples" com várias vira várias simples) e do lote (D43, D44) | Lucas |
| Confirmar as interpretações de completar o acumulador, do lote só com valor dito ou digitado, da origem e da média da odd contra o print (D45 a D48) | Lucas |
| Mandar as cinco fotos de novo pelo iPhone depois deste PR: ver os acumuladores completados pela foto da lista, com o card de verdade (D45) | Lucas |
| Confirmar as interpretações da segunda leva: o que conta como aposta repetida, odd mínima desligada de início, o "contra" como aviso, "Último evento" e o resumo sem cashout (D49 a D56) | Lucas |
| Dizer se e quando implementar o retrospecto dos lutadores, e com quantas lutas (D57) | Lucas |
| Dizer se o retrospecto dos lutadores é para fazer agora (D57) | Lucas |
| Confirmar o quadro "se todas perderem" e a unidade no topo da Carteira (D75) | Lucas |
| Confirmar as palavras de cada estado da seleção, e "Bateu" e "Perdeu" já com a luta rolando quando está decidido no papel (D74) | Lucas |
| Gravar como amostra a resposta real de um empate e de uma luta em "STATUS_PRE_FIGHT" (D74) | Quem rodar `OL_SAMPLES=1 python3 tests/contract_live.py` de uma conexão comum |
| Confirmar: a busca em todos os eventos carregados e sem chamada à ESPN, e "separar o card" como ver uma parte por vez (D71, D72) | Lucas |
| Ver num card de verdade se as partes do card saem certas das horas das lutas (D72) | Lucas, no próximo card |
| Confirmar: "ganhos potenciais" como lucro (retorno menos a stake), o retorno sem unidades e as telas escolhidas (D70) | Lucas |
| Confirmar: "mais de quatro" como cinco ou mais, sugestão sem preencher sozinha, seta indo à meia unidade mais próxima, e a hora da aposta como a hora da luta (D66, D67, D69) | Lucas |
| Confirmar as interpretações da terceira leva: item pronto recolhido de início, a aposta nova fora do topo das abertas, a ordem pela primeira luta e a marca do card contando a múltipla inteira (D58 a D60) | Lucas |
| Confirmar as interpretações do valor em unidades (D30) e o sinal − tipográfico (D31) | Lucas |
| Confirmar o padrão Automático do tema (D38) | Lucas |
| Confirmar os tons dos três pares de canto, a cor quente no lutador de cima e os tons neutros de + e − (D40, D41) | Lucas |
| Ver como a ESPN escreve um peso casado feminino, para a cor do canto (D40) | Quem vir um no card |
| Abrir o app no iPhone depois deste PR: ver se abre sem internet (modo avião) e se o aviso de versão nova aparece no merge seguinte (D37) | Lucas |
| Testar num evento ao vivo de verdade: reparar quanto tempo passa entre o fim da luta e a aposta fechar, e se alguma aposta mostra "ainda não reconhecido pelo app" (D64) | Lucas, no card de 10/10/2026 |
| Instalar no iPhone e conferir ícone, tela cheia e persistência | Lucas |
| Conferir o hook de parada dentro do Claude Code | Lucas, na primeira sessão pelo CLI |
