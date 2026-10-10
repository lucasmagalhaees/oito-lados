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

## D30. Valor da aposta em dinheiro ou em unidades, e atalhos altos

- **Contexto:** dois pedidos seguidos: "nas opções de aposta precisa ter 10000 e 100000 e 1000000" e "na hora de apostar quero a opção em unidades da banca".
- **Decisão:** uma segunda linha de atalhos no cupom (+10.000, +100.000, +1.000.000), somando como os que já existiam. E uma chave "Em R$ / Em unidades" que troca o campo de valor por um campo em unidades; a escolha fica salva.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Os atalhos de 0,5u a 3u já existiam; entendi o pedido como poder **digitar** qualquer quantidade de unidades.
  - Em unidades, os atalhos de dinheiro saem da tela e ficam só os de unidade e o "Tudo".
  - Os atalhos altos são do cupom. Os do depósito continuam em 100, 500, 1.000 e 5.000.
- **Descartado:** trocar o padrão para unidades sem ele pedir.

## D31. Mais e menos como + e −, e cor de canto nas opções

- **Contexto:** "em vez de usar a linguagem menos use − e em vez de mais use +; e quando tiver rounds + vencedor (seja round exato ou mais/menos) precisa ter cores e diferenciação dos lutadores, encontre uma forma bacana de fazer isso".
- **Decisão:** total de rounds e de quedas passam a "+2.5" e "−2.5", com uma legenda curta no título do mercado. Toda opção que pertence a um lutador (método por lutador, vencedor e round, acerta queda) ganha barra e fundo leve na cor do canto dele, o cabeçalho da coluna ganha um traço da cor, e no cupom e nas apostas a seleção leva um quadradinho da cor.
- **Interpretações que precisaram ser feitas (confirmar com o Lucas):**
  - Usei o sinal de menos tipográfico (−), que tem a largura do +. O leitor de texto aceita também o hífen.
  - Não existe um mercado único de "vencedor e mais/menos rounds". Essa aposta é feita combinando as duas seleções da mesma luta no cupom, e ali a seleção do lutador aparece com a cor dele. Não criei mercado novo.
- **Consequência:** apostas antigas guardam o texto da época ("Mais de 2.5 rounds").

## D32. Produção servindo versão antiga depois de merges em sequência

- **O que aconteceu (09/10/2026):** os PRs #4, #5, #6 e #7 foram mesclados em menos de um minuto. A Vercel criou um deploy de produção para cada merge. O do #4 (o mais antigo) terminou às 00:00:28 UTC, dois minutos depois do #7 (23:58:39), e o endereço de produção ficou com ele. O Lucas procurou o copiar aposta e a unidade e não achou.
- **Como foi confirmado:** aberto https://oito-lados.vercel.app no navegador do computador do Lucas, o arquivo servido tinha 90.037 bytes e o mesmo sha256 do `index.html` do merge do #4 (`f76c9fdf…`). O da `main` tinha 127.845 bytes.
- **Por que nada acusou:** o CI confere o código, não o que está no ar. Os quatro deploys aparecem como sucesso.
- **Decisão:** um workflow novo (`Produção`) compara, depois de cada push na `main`, o que a produção serve com o `index.html` do commit, e continua olhando por 5 minutos depois de bater. Em PR só informa.
- **Descartado:** carimbo de versão dentro do `index.html` (exigiria etapa de build, contra a D10) e promover deploy pela API da Vercel (exigiria guardar um token).
- **Regra de uso:** mesclar um PR por vez e esperar o deploy; quando um PR contém os anteriores, mesclar só ele.
- **O que não se sabe:** se a Vercel sempre aponta a produção para o último deploy a terminar, ou se foi circunstância. Fato de terceiro, visto uma vez.

## Pendências em 09/10/2026

| Pendência | Quem resolve |
|---|---|
| Proteger a `main` exigindo PR e os checks do CI | Lucas |
| Confirmar a margem de 5% e as outras interpretações do cashout dinâmico (D27) | Lucas |
| Confirmar as interpretações da conversão de moeda (D28) | Lucas |
| Testar o copiar aposta no iPhone com prints reais | Lucas |
| Confirmar as interpretações do valor em unidades (D30) e de + / − e cores (D31) | Lucas |
| Ver o workflow `Produção` rodar no primeiro merge depois dele, e se o runner do GitHub alcança a produção | Quem fizer o próximo merge |
| Testar num evento ao vivo de verdade | Lucas, no próximo card |
| Instalar no iPhone e conferir ícone, tela cheia e persistência | Lucas |
| Conferir o hook de parada dentro do Claude Code | Lucas, na primeira sessão pelo CLI |
