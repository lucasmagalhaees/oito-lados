# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

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
