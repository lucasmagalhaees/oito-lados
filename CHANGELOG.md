# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

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
