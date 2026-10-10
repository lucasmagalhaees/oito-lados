# Escala: decisões e caminho

Este documento guarda o que foi decidido sobre escala e o que fazer quando chegar a hora. Nada daqui está implementado.

## Decisão atual (09/10/2026)

**MVP para um usuário.** Um arquivo estático, sem backend, dados no `localStorage` de um aparelho. A ordem combinada é: começar simples, validar hipóteses usando de verdade, e só escalar se alguma delas pedir.

Por que isso basta agora:
- Um usuário, um iPhone. Não há o que sincronizar nem com quem competir.
- Não existe dinheiro real, então saldo editável no aparelho não é fraude contra ninguém.
- Custo zero de infraestrutura e nenhum serviço para manter no ar.

## Hipóteses a validar antes de investir

São sugestões de o que observar nas primeiras semanas de uso.

| Hipótese | Como saber |
|---|---|
| A API da ESPN aguenta um evento ao vivo: o status muda rápido e resultado e quedas aparecem logo depois da luta | Usar num sábado de card e anotar atrasos, erros e apostas que demoraram a fechar |
| As odds estimadas (quedas, round exato, combinadas) são plausíveis | Comparar algumas com as de uma casa de verdade no mesmo card |
| O `localStorage` do app na Tela de Início do iPhone não some sozinho | Ficar duas ou três semanas sem abrir e ver se o histórico continua lá |
| O app é usado toda semana | Olhar o próprio histórico de apostas depois de um mês |
| Faz falta ter outra pessoa (ranking, comparar bancas) | Só escalar para multiusuário se isso for pedido de verdade |

## E se mais de uma pessoa abrir o link hoje?

Funciona, cada uma no seu mundo: banca e apostas ficam no aparelho de cada pessoa e ninguém vê nada de ninguém. Não existe conta (trocar de aparelho começa do zero, salvo o backup por texto), nem ranking, nem proteção contra alterar o próprio saldo. Cada aparelho consulta a ESPN direto: com poucos amigos não muda nada; com muita gente multiplica as chamadas a uma API que não é oficial.

## Quanto custa um backend (conferido em 09/10/2026; reconferir antes de decidir)

No tamanho de "eu e algumas dezenas de amigos", dá para ficar em US$ 0:

| Item | Plano grátis | Quando passa a custar |
|---|---|---|
| Vercel Hobby | 1 milhão de chamadas de função e 4 h de CPU por mês; estourou, o recurso para até virar o mês, sem cobrança | Uso comercial (anúncio, assinatura) ou cron mais de 1 vez por dia: Pro, US$ 20/mês com US$ 20 de crédito de uso |
| Banco e login (Supabase) | 500 MB, 50 mil usuários ativos, 2 projetos; o projeto pausa depois de 1 semana sem uso | Pro a partir de US$ 25/mês |
| Banco (Neon) | 1 GB por projeto; desliga quando ocioso e religa na chamada seguinte | Paga por uso no plano seguinte |

A Vercel não tem mais banco próprio: os bancos entram por integração (Neon, Supabase e outros). Os números do Supabase e do Neon foram lidos por um resumo das páginas, não pela página crua.

Fontes: https://vercel.com/docs/plans/hobby · https://vercel.com/docs/plans/pro-plan · https://vercel.com/docs/cron-jobs/usage-and-pricing · https://vercel.com/docs/limits/fair-use-guidelines · https://supabase.com/pricing · https://neon.com/docs/introduction/plans

O custo que pesa não é esse: é manter login, banco e liquidação no servidor funcionando em noite de evento.

## Gatilhos: o que cada sintoma pede

| Sintoma | Etapa |
|---|---|
| Mexer no `index.html` ficou lento ou arriscado; duas pessoas no código | Etapa 1 |
| Quero ver o mesmo saldo no iPhone e no computador; perdi dados | Etapa 2 |
| Quero amigos usando, ranking, ligas | Etapa 3 |
| A ESPN mudou o formato ou começou a bloquear | Trocar a fonte de dados (ver abaixo) |

## Etapa 1: estruturar o código (sem mudar o produto)

Continua estático e sem backend. Só muda a organização.

- Vite + TypeScript. Saída continua sendo arquivos estáticos.
- Módulos: `core/odds`, `core/pricing`, `core/settlement`, `espn/` (cliente e normalizadores), `store/` (estado e persistência), `ui/` (telas e cupom).
- Tipos para `Fight`, `Odds`, `Result`, `Bet`, `Leg` e para as chaves de seleção.
- Os casos de `tests/unit.py` viram testes do `core` em Vitest, rodando sem navegador. O e2e com Playwright fica.
- PWA de verdade: `manifest.json`, ícone em arquivo, service worker.

O que já ajuda: `Core` é puro (sem DOM, rede ou armazenamento), todo acesso à ESPN passa pelos normalizadores, e o estado salvo tem campo de versão (`v: 1`).

Esforço: pequeno. É mover código, não reescrever.

## Etapa 2: sincronizar entre aparelhos (um usuário)

Backend mínimo, só para guardar o estado.

- Login simples (link mágico por e-mail ou OAuth) e uma tabela com o estado do usuário, ou as tabelas da etapa 3 já no formato final.
- O navegador continua consultando a ESPN e liquidando. O servidor só persiste.
- Conflito entre aparelhos: o histórico é uma lista de depósitos e apostas com `id`, então dá para unir por `id` em vez de sobrescrever.

O que já ajuda: o saldo é derivado do histórico (não existe campo de saldo para divergir) e cada aposta tem `id` próprio.

## Etapa 3: multiusuário

Aqui a arquitetura muda. O navegador deixa de ser a fonte da verdade.

Por que o desenho atual não serve:
- O cliente decide o preço e a liquidação. Com ranking, qualquer um altera o próprio resultado.
- Cada aparelho consulta a ESPN direto. Com muitos usuários isso multiplica as chamadas a uma API que não é oficial.
- Não existe identidade.

Componentes:

```
ESPN (ou fonte contratada)
        │
   coletor (agendado: card e odds a cada poucos minutos; 15 s com luta ao vivo)
        │
   banco ── API ── navegador
        │
   liquidador (roda quando uma luta encerra)
```

- **Coletor:** um processo só consulta a fonte e grava card, odds, status, resultado e quedas. Os clientes leem do nosso banco.
- **API:** autenticação, carteira, aceitar aposta, listar apostas, ranking. Ao aceitar uma aposta, o servidor recalcula o preço com `core/pricing` e recusa se a luta já começou ou se a odd mudou.
- **Liquidador:** aplica `core/settlement` no servidor e grava o resultado de cada aposta.
- **Tempo real:** o cliente pode seguir consultando a API a cada 15 s; SSE ou WebSocket só se isso pesar.

Modelo de dados (rascunho):

| Tabela | Campos principais |
|---|---|
| `users` | id, nome, criado_em |
| `ledger` | id, user_id, tipo (depósito, aposta, pagamento, estorno), valor, bet_id, criado_em |
| `events`, `fights` | ids da fonte, nomes, data, rounds, estado, vencedor |
| `odds_snapshots` | fight_id, linhas, coletado_em |
| `results` | fight_id, método, round, tempo, quedas |
| `bets` | id, user_id, tipo, stake, odd, status, payout, criado_em, liquidado_em |
| `bet_legs` | bet_id, fight_id, chave da seleção, odd, origem (real ou estimada), resultado |

O saldo continua derivado: soma do `ledger`. As chaves de seleção (`ml:a`, `tot:o:2.5` etc.) e as regras de liquidação valem como estão.

Duas pilhas possíveis, ambas servem:
- **Menos operação:** Next.js com rotas de API, Postgres gerenciado e tarefas agendadas, tudo na Vercel. O `core` em TypeScript roda igual no cliente e no servidor.
- **Mais controle:** API em Spring Boot com Postgres na AWS, coletor e liquidador como tarefas agendadas. Exige portar o `core` para Java ou Kotlin, ou mantê-lo como serviço à parte.

Decisões que ficam para essa hora: como evitar abuso de depósito ilimitado no ranking (por exemplo, ranking por ROI ou banca inicial fixa por temporada), se há ligas privadas, e política de dados pessoais.

## Fonte de dados

A API da ESPN é pública, mas não é oficial nem documentada. Serve para um usuário; não é base para um produto com usuários de verdade.

Alternativas pagas que apareceram na pesquisa e ainda **não foram avaliadas**: The Odds API, OddsPapi e SportsGameOdds. Pontos a checar em cada uma: cobertura de mercados de MMA além do vencedor, se entrega resultado e estatísticas da luta, latência ao vivo, limites e preço.

Trocar de fonte significa reescrever só os normalizadores (`norm*`). O formato interno de luta, odds e resultado não muda.

## Pontos jurídicos a verificar com advogado antes de abrir ao público

Não é orientação jurídica, só a lista do que perguntar.

- Apostas de quota fixa são reguladas no Brasil (Lei 14.790/2023). Um simulador gratuito, sem prêmio e sem dinheiro real, é outra coisa, mas prêmios, assinatura ou qualquer forma de sacar valor mudam o enquadramento.
- Uso de nomes de lutadores, eventos e marcas (UFC, casas de apostas).
- Termos de uso da fonte de dados.
- LGPD, a partir do momento em que houver cadastro.
