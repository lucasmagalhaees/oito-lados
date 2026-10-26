# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [0.29.0] - 2026-10-26

### Adicionado
- Faixa do dia do card na tela de Lutas: quando começa, a hora do card principal e o que está em jogo nele (D107).
- Estrela nas lutas e filtro "★ Favoritas" no card (D107).
- Resumo do último card no alto da aba Apostas, quando ele fecha (D107).
- Quadro "★ Suas favoritas" com quanto falta para cada luta com estrela (D108).

## [0.27.2] - 2026-10-25

### Alterado
- O service worker termina de guardar fontes e leitor de imagem antes de parar. Mínimo de cobertura sobe para 97% das funções.

## [0.27.0] - 2026-10-21

### Alterado
- O cupom não pergunta mais se é simples ou múltipla: uma seleção é simples, duas ou mais são múltipla (ou combinada, se forem da mesma luta). Uma múltipla que não fecha fica bloqueada com o motivo, em vez de virar apostas simples.

## [0.26.2] - 2026-10-18

### Adicionado
- Teste de mutação do núcleo (`npm run mutation`, com o Stryker): planta um erro pequeno de cada vez em `src/core` e vê se algum caso de `tests/unit.cases.mjs` falha. A pontuação passou de 75,8% para 91,2%, com 182 checagens novas nos casos do núcleo (599 para 781). Nenhum erro de regra foi achado; o produto não muda.

## [0.26.1] - 2026-10-17

### Corrigido
- Um dado estragado ou de versão antiga (aposta sem seleção, depósito vazio, cache de outro formato, backup ou linha do servidor estragados) não derruba mais o app: o que não dá para mostrar fica de fora e o resto aparece.
- O aviso que aparece no alto não engole mais o toque no que está embaixo dele.
- O foco do teclado não volta mais para o começo da página a cada toque; abrir o cupom ou a tela de copiar leva o foco para ela.
- "Escolher fotos" e "Restaurar de um arquivo" funcionam pelo teclado.
- Contraste: as dicas dos campos e o `≈` da odd estimada passam de 4,5:1 nos dois temas.
- Os botões pequenos soltos na tela (`×`, "Atualizar", o chip de apostas da luta, "trocar", "desfazer") recebem uma área de toque de 44 px, sem mudar o desenho.
- O saldo no alto é lido com o valor pelo leitor de tela, o cupom diz qual tipo de aposta está ligado e a tela de copiar diz o nome dela.
- O ROI saía +53,9% num lugar e +53,8% em outro para as mesmas apostas, e uma perda de 5,45% saía −5,4%: agora sai igual em todo lugar, e a perda arredonda como o ganho.

## [0.26.0] - 2026-10-17

### Adicionado
- As últimas lutas de cada lutador, lidas da ESPN num aparelho, ficam também no servidor, e o outro aparelho da mesma pessoa as pega de lá, sem refazer as chamadas à ESPN.

### Alterado
- O que está guardado das últimas lutas no aparelho passa pela mesma conferência do que vem do servidor; o que não for uma lista válida é descartado.

## [0.25.0] - 2026-10-17

### Adicionado
- Sincronizar aparelhos: a mesma banca e as mesmas apostas no iPhone e no computador, entrando com e-mail e senha (nenhum e-mail é mandado). O aparelho continua guardando tudo, e o app funciona igual sem o servidor.
- Uma rotina diária no cron da Vercel, para o banco do plano grátis não pausar.

## [0.24.1] - 2026-10-11

### Alterado
- Os três seletores do sistema que sobravam (o tipster a renomear, na Carteira, e os mercados de uma luta na tela de copiar aposta) viraram botões do app, com as cores do tema.

## [0.24.0] - 2026-10-11

### Adicionado
- O cartão "Uso da ESPN" mostra também as últimas 24 horas, hora a hora, e o arquivo exportado leva as horas.

### Alterado
- O resultado de uma luta só é pedido à ESPN onde é usado: num card que está na tela, ou para fechar uma aposta.
- Quando a ESPN não responde, a espera até a próxima tentativa dobra a cada falha, até 5 min, e a tela diz em quanto tempo é a nova tentativa.

## [0.23.0] - 2026-10-11

### Adicionado
- Cartão "Uso da ESPN" na Carteira: as chamadas que o app faz à ESPN, contadas neste aparelho por tipo (quantas, quantas falharam, tempo e tamanho), de hoje e dos últimos 7 dias, com exportar em arquivo, copiar como texto e zerar.

## [0.22.1] - 2026-10-11

### Corrigido
- O card encerrado não aparece mais no alto da tela de Lutas: sai assim que a ESPN o marca como encerrado, e ficam os três próximos.

## [0.22.0] - 2026-10-11

### Alterado
- Quando um card acaba, os três seguintes já aparecem no alto da tela de Lutas (antes, dois). O placar passa a ser lido 30 dias à frente.

## [0.21.2] - 2026-10-11

### Corrigido
- No computador, o botão de país que não cabia na fileira ficava cortado e fora de alcance. Com mouse, as fileiras de países e de eventos passam a quebrar em linhas; no celular continuam rolando para o lado.

## [0.21.1] - 2026-10-11

### Alterado
- O filtro por país olha só o card escolhido no alto, e continua ligado ao trocar de card.

### Corrigido
- As bandeiras não apareciam no navegador do computador: o Windows não tem emoji de bandeira. Onde o sistema não tem, o app busca uma fonte só de bandeiras; o iPhone continua com as dele.
- A lista de países aparecia branca no tema escuro. Os países passaram a ser botões do app, com as cores do tema, no lugar do seletor do sistema.

## [0.21.0] - 2026-10-11

### Adicionado
- Filtro por país na tela de Lutas: o atalho "Brasileiros" e uma lista com todo país que tem lutador nos eventos carregados, pelo nome em português.

## [0.20.0] - 2026-10-11

### Adicionado
- Bandeira do país de cada lutador, antes do nome, no card da luta e no quadro das últimas lutas.
- A luta que acabou em submission diz qual foi ("Rear Naked Choke"), no resultado e nas últimas lutas, com o nome que a ESPN dá.
- A conferência semanal da ESPN lista os países dos placares, avisa de nome sem bandeira e lista os nomes de submission.

### Alterado
- "Finalização" passou a ser "Submission" em toda a interface. Apostas já feitas continuam com o texto de quando foram feitas.

## [0.19.0] - 2026-10-11

### Adicionado
- Extrato em unidades na Carteira, sempre à vista: unidades, cartel (ganhas e perdidas) e ROI dos últimos 7, 15 e 30 dias, do geral e de cada evento, com tudo, as apostas próprias e as de tipster lado a lado.
- Períodos de 7 e de 15 dias nos números da Carteira.
- "Você × tipster" frente a frente: dois quadros com unidades, cartel, ROI e dinheiro, e o da frente marcado.

### Alterado
- O resultado em unidades do período ficou maior e com cor.

### Removido
- A tabela por evento que ficava entre os números do período. Os eventos estão no extrato em unidades.

## [0.18.0] - 2026-10-11

### Adicionado
- Backup em arquivo: "Salvar backup em arquivo" abre a folha de compartilhamento do aparelho (ou baixa o arquivo), e "Restaurar de um arquivo" mostra o que o arquivo traz antes de substituir qualquer coisa.

### Alterado
- As últimas lutas de todo mundo do card da semana são buscadas sozinhas, em segundo plano, e guardadas por uma semana. Antes eram buscadas ao abrir os mercados de cada luta.
- A aposta de tipster sem nome aparece só como "Tipster".
- O backup por texto continua, em botões menores ("Copiar como texto", "Colar um texto").

## [0.17.0] - 2026-10-10

### Adicionado
- Últimas 3 lutas de cada lutador nos detalhes da luta: vitória ou derrota, como acabou, round e tempo. Buscadas na ESPN só ao abrir os mercados da luta, e guardadas no aparelho.
- `scripts/capture_espn.py` e a entrada `capture` no workflow `ESPN contract`, para gravar amostras reais da ESPN de onde ela não é alcançada.

## [0.16.0] - 2026-10-10

### Adicionado
- O botão "Colar" aceita imagem: o print que foi copiado e não está na galeria vai direto para o leitor.
- Toda aposta que entra pelo "Copiar aposta" é marcada como do tipster, e a que é montada no card como própria. Cada aposta mostra a etiqueta, e a aba Apostas filtra por "Minhas" e "Tipster".
- Tabela "Você × tipster" na Carteira, com uma frase dizendo quem está na frente pelo retorno sobre o apostado.
- Dar nome, depois, às apostas de tipster que ficaram sem.

### Alterado
- "Ao vivo" passa a ser azul. Era um vermelho quase igual ao de aposta perdida.
- Repetir uma aposta de tipster continua sendo do tipster. Antes a repetição perdia a origem.
- A tabela "por origem" deu lugar à "Você × tipster"; a linha "Sem origem" virou "Minhas".

## [0.15.0] - 2026-10-10

### Alterado
- Cada seleção de uma aposta diz onde está, em palavras e em cor: bateu, perdeu, anulada, ao vivo, vai começar, aguardando, não começou ou não contou. A múltipla conta as seleções por estado embaixo do título.
- Luta que a ESPN dá como em andamento, mas ainda sem round, aparece como "vai começar" em vez de "R0".
- O topo da Carteira virou o cartão "Gestão da banca": banca, em jogo e valor da unidade lado a lado, e dois quadros coloridos dizendo para onde a banca vai se as apostas abertas baterem todas ou perderem todas.
- Quadros de três números passam a dois por linha quando um valor é longo, em vez de quebrar o número no meio.

### Corrigido
- Múltipla aberta com uma seleção anulada (por empate, por exemplo) continuava mostrando a odd e o retorno originais. Agora mostra o que ela paga sem aquela luta, com "era X" ao lado, e os totais do evento e da Carteira acompanham. O valor pago na liquidação já estava certo.

## [0.14.0] - 2026-10-10

### Adicionado
- Busca na tela de Lutas: acha a luta por um pedaço do nome do lutador, em todos os eventos carregados, sem depender de acento ou caixa. Não faz chamada à ESPN.
- Botões para ver uma parte do card só: principal, preliminares ou primeiras preliminares.

## [0.13.0] - 2026-10-10

### Adicionado
- Ganho possível (retorno menos a stake), em dinheiro e em unidades: em cada aposta aberta, no quadro de cada evento, no total em aberto, na Carteira, no cupom e na lista de copiar (por item e no lote).
- Quadro "Tudo em aberto" na aba Apostas quando há apostas em mais de um evento.
- Unidades na marca do card da luta, no aviso de quanto já está em jogo numa luta, no resultado de cada aposta encerrada, nas tabelas por mercado e por evento e na faixa "Desde a última vez".

### Alterado
- O total de cada evento na aba Apostas deixou de ser uma linha de texto e virou um quadro com em jogo, retorno e ganho.

## [0.12.0] - 2026-10-10

### Adicionado
- Botão "Colar" na tela de copiar: puxa o texto da área de transferência e já lê.
- Numa múltipla de cinco seleções ou mais, atalhos de 0,2u, 0,3u e 0,4u como stake sugerida, no cupom e na lista de copiar.
- Setas de meia unidade no campo de unidades, no cupom e na lista de copiar.
- Cada aposta lida mostra a hora da luta e a stake em unidades e em dinheiro; o total do lote e o de cada evento na aba Apostas vêm também em unidades.

### Alterado
- Ao copiar com a configuração em unidades, o print que não diz unidades entra com 1u. Antes entrava com o dinheiro do print, mostrado em unidades.

## [0.11.0] - 2026-10-10

### Alterado
- A aposta de vencedor fecha assim que a luta aparece como encerrada com o vencedor marcado, sem esperar o método ser publicado.
- Enquanto uma aposta espera por uma luta que já acabou, o app consulta a ESPN a cada 8 s (antes, 15 s ou 30 s).
- A aposta aberta diz o que está esperando: o método, ou as quedas fecharem.
- Voltar ao app também sincroniza quando a página é restaurada da memória ou a conexão volta.

### Corrigido
- Um resultado publicado com um nome que o app não conhece anulava na hora as apostas de método, round e total daquela luta. Agora fica pendente por um dia, com o nome à vista.

### Adicionado
- `tests/settle.py`: a liquidação pela interface com a ESPN simulada segurando respostas.
- A conferência ao vivo da ESPN varre os nomes de resultado de até 160 lutas encerradas.

## [0.10.0] - 2026-10-10

### Adicionado
- Na lista de copiar, cada item é uma linha com a situação, as seleções e o valor, e abre ao toque. O que precisa de atenção já vem aberto.
- No card da luta, quantas apostas abertas você tem nela e quanto está em jogo.
- Resultado em unidades por origem, na tabela da Carteira.
- `tests/core.mjs`: os casos do núcleo rodando no Node, sem navegador, contra o núcleo construído sozinho.

### Alterado
- As apostas abertas aparecem agrupadas por evento, na ordem das lutas, com o total em jogo e o que o evento paga se todas baterem. Antes vinham da mais recente para a mais antiga.
- Os casos do núcleo saíram de dentro do `tests/unit.py` para `tests/unit.cases.mjs`.

## [0.9.0] - 2026-10-10

### Adicionado
- Aviso de aposta repetida ao copiar: a que já está aberta e a que aparece duas vezes na lista ficam fora do "apostar todas" até o toque em "Apostar mesmo assim".
- Odd mínima ao copiar (desligada, 3%, 5% ou 10%): a aposta cuja odd caiu mais que o limite em relação ao print fica fora do lote, com o quanto caiu.
- Corrigir o que foi lido: trocar ou tirar uma seleção, ver o texto que saiu de cada foto e levá-lo ao campo de texto.
- Quanto já está em jogo na luta, na tela de copiar e no cupom, e o aviso de que a aposta nova vai contra uma que já existe.
- Origens já usadas como botões na tela de copiar, renomear ou juntar origens na Carteira, filtro por origem na aba Apostas e a odd contra o print de cada origem.
- Período na Carteira: tudo, 30 dias ou último evento.
- Faixa "Desde a última vez", com as apostas que fecharam sozinhas, o resultado e a quebra por origem.

### Alterado
- O leitor aceita a odd que o leitor de imagem leu com dois-pontos ("1:13"), no fim da linha.
- A lista de fotos recomeça a contagem ("Foto 1") quando fica sem foto.
- Uma lista de seleções com valor digitado, igual ao acumulador que ela completou, deixou de entrar no lote como aposta a mais.

## [0.8.0] - 2026-10-10

### Adicionado
- Copiar aposta completa o cupom de acumulador que só mostra a primeira seleção: sozinho, quando a foto da lista de seleções vem junto ("Completada com a foto N", com desfazer); com um toque, a partir de outro item da lista; ou à mão, num seletor com os mercados da luta.
- Conferência das odds do acumulador completado: mostra a multiplicação das seleções e diz se bate com a odd do cupom.
- Valor e tipo (simples ou múltipla) de cada aposta podem ser mudados na própria lista, antes de apostar todas.
- Campo "De quem é" na tela de copiar. A origem fica na aposta, aparece na lista de apostas, e a Carteira mostra o resultado por origem.
- A odd do print fica guardada com a aposta. A lista de apostas mostra "odd do print X, você pegou Y", e a Carteira a diferença média.

### Alterado
- As fotos da lista aparecem como "Foto 1", "Foto 2", no lugar do nome de arquivo do celular.
- "Apostar as N de uma vez" só inclui aposta com valor dito no original ou digitado. Antes, uma lista de seleções sem valor entrava com 1u.
- A lista de seleções que serviu para completar outra aposta fica fora do lote e sai da lista junto com ele.

## [0.7.0] - 2026-10-10

### Adicionado
- Copiar aposta aceita várias fotos de uma vez. Cada foto vira uma aposta numa lista, e "Apostar as N de uma vez" faz todas as que estão inteiras, depois de conferir placar e odds.
- Botão "Limpar" na tela de copiar.
- O leitor entende simples e múltipla pelas palavras do original (dupla, tripla, quádrupla, quíntupla, múltipla, acumulador, "Eventos: N") e avisa quando faltam seleções.
- Formatos novos: múltipla por lutador ("Fulano + Beltrano - Para vencer a luta"), cupom "1X2: V1: A - B", nomes em linhas separadas, total "Acima de (1.5)", valor "1756 BRL" e odd com três casas.
- A odd única de uma múltipla aparece como odd da aposta inteira, ao lado do que as seleções pagam agora.

### Alterado
- Um lutador de cada luta no mesmo texto deixou de ser erro e virou múltipla. Ambíguo é só o nome que serve a dois lutadores do card.
- Fechar a tela de copiar não apaga mais o texto nem a lista.

## [0.6.0] - 2026-10-10

### Adicionado
- Atalhos de 10.000, 100.000 e 1.000.000 no cartão de depósito.
- Três pares de cor para os cantos (vermelho e azul, rosa e verde, laranja e roxo), escolhidos separadamente para lutas masculinas e femininas.
- Ao copiar um original que traz unidades e dinheiro, a tela diz qual dos dois ficou de fora.

### Alterado
- + e − deixaram o azul-petróleo e o violeta: agora são neutros, com barra lateral e seta.
- Copiar print não tem mais configuração própria. "Valor das apostas" decide: em R$ entra o mesmo valor, em unidades a mesma stake. Original com os dois segue a configuração (antes as unidades ganhavam sempre).

### Removido
- O cartão "Ao copiar um print" e o campo "1u do print". O app não ajusta mais a aposta de outra pessoa à sua banca.

## [0.5.0] - 2026-10-10

### Adicionado
- O app fica guardado no aparelho por um service worker: abre na hora e também sem internet, com os últimos dados que carregou.
- Aviso "Saiu uma versão nova do app." com o botão "Atualizar agora", e um cartão "Versão do app" na Carteira com "Procurar versão nova".
- Tema automático, claro ou escuro, escolhido nas configurações.
- Legenda com o nome e a cor de cada canto, presa na tela enquanto os mercados de uma luta rolam.
- Cores e setas próprias para + e − no total de rounds e de quedas.
- `tests/pwa.py`: abrir sem conexão e trocar de versão, testados com a página servida por um servidor local.

### Alterado
- Dinheiro ou unidades deixou de ser uma chave no cupom e virou configuração na Carteira, valendo para todas as apostas.
- A Carteira ganhou o título "Configurações" acima dos cartões de ajuste.
- Publicar não troca mais na hora o app de quem já abriu: o aparelho avisa e espera o toque.

## [0.4.0] - 2026-10-09

### Alterado
- O código passou do `index.html` para TypeScript em módulos (`src/core/` e `src/app/`), com build pelo Vite. Nenhuma mudança no produto: o que é publicado continua sendo um arquivo só.
- O `verify.sh` e o CI conferem os tipos e fazem o build antes dos testes, e os testes abrem a página gerada.
- A checagem de produção passou a ler o commit carimbado na página, em vez de comparar o arquivo.

## [0.3.1] - 2026-10-09

### Adicionado
- Atalhos de valor no cupom para +10.000, +100.000 e +1.000.000.
- Valor da aposta digitado em unidades da banca, com uma chave no cupom que fica salva.
- Cor do canto do lutador nas opções de método, vencedor e round e quedas por lutador, e nas seleções do cupom e das apostas.
- Checagem automática de que a produção serve o `index.html` da `main` depois de cada merge.

### Alterado
- Mais e menos de uma linha aparecem como + e −.
- Copiar print em dinheiro tem só duas opções: mesmo valor ou mesma stake. O modo "fixo" saiu.

### Corrigido
- Merges em sequência deixaram a produção na versão de um PR antigo. O próximo merge republica a versão certa, e a checagem nova acusa se voltar a acontecer.

## [0.3.0] - 2026-10-09

### Adicionado
- Cashout dinâmico: com parte da múltipla já batida e o resto por começar, o app oferece um valor para encerrar, calculado pelas odds de agora.
- Conversão de moeda: passar a banca para outra moeda converte tudo pela cotação do dia, guardada no aparelho por 12 h. Dá para converter junto com um depósito ou sem depositar.
- Configuração do valor ao copiar um print que traz dinheiro: mesmo valor, convertido em unidades ou um número fixo de unidades.

### Alterado
- O cashout não acaba mais quando a primeira luta de uma múltipla termina. Sem nenhuma luta decidida, continua devolvendo o valor integral.
- A moeda passou a ser escolhida no cartão de depósito. O cartão "Moeda da simulação", que trocava só o símbolo, saiu.

## [0.2.0] - 2026-10-09

### Adicionado
- Cashout: devolve o valor integral da aposta enquanto nenhuma luta dela começou; congela com luta em andamento.
- Repetir aposta com um toque.
- Máscara de milhares nos campos de valor.
- Moeda da simulação: real, dólar ou euro.
- Gestão de unidade: porcentagem da banca, atalhos em unidades no cupom e resultado em unidades.
- Copiar aposta a partir de um print (lido no aparelho por OCR) ou de um texto colado.
- Cobertura de código medida pelo navegador e cobrada no `verify.sh`.

### Corrigido
- "1.000" digitado num campo de valor era lido como 1.

### Alterado
- Taxa de acerto conta só apostas ganhas e perdidas; anuladas e encerradas por cashout ficam de fora.
- Conferência da API real da ESPN: chamadas feitas fora do navegador, com identificação própria; falhas e avisos viram anotações no GitHub Actions; máquina sem acesso à ESPN dá resultado inconclusivo.

## [0.1.0] - 2026-10-09

### Adicionado
- Card do UFC e odds reais lidos da API pública da ESPN, sem backend.
- Saldo fictício com depósitos ilimitados.
- Mercados de vencedor, método, decisão, total de rounds, round de término, vencedor e round, e quedas.
- Aposta simples, múltipla entre lutas e combinada na mesma luta com preço por probabilidade conjunta.
- Acompanhamento ao vivo e liquidação automática com o resultado oficial.
- Painel de ganhos e perdas com gráfico e quebra por mercado e por evento.
- Backup e restauração dos dados por texto.
- Testes unitários do núcleo e teste ponta a ponta com a ESPN simulada, no GitHub Actions.
- Teste de contrato contra respostas reais gravadas da ESPN e conferência semanal da API real.
- Harness contra alucinação de IA: comando único de verificação, documentação conferida contra o código, hook de parada do Claude Code e registro de verificação.
- Fluxo por branch e PR, com deploy no merge.
- Registro de decisões e caminho de escala documentados.

### Corrigido
- Deploy na Vercel: o projeto é fixado como site estático, para não ser tratado como app Python.
