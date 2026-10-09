# Amostras reais da API da ESPN

Respostas reais capturadas em **09/10/2026**, reduzidas aos campos que o app lê. Servem de contrato: `tests/contract.py` passa cada uma pelos normalizadores e confere o resultado.

| Arquivo | Chamada | Luta |
|---|---|---|
| `scoreboard_pre.json` | `SITE/scoreboard?dates=...` | evento 600061541, luta 401916276 (agendada) |
| `scoreboard_post.json` | `SITE/scoreboard?dates=...` | evento 600061182, luta 401912278 (encerrada) |
| `odds.json` | `CORE/events/600061541/competitions/401916276/odds` | mesma luta agendada |
| `propbets.json` | o `propBets.$ref` da resposta de odds | mesma luta agendada |
| `status_decision.json` | `CORE/events/600061182/competitions/401912278/status` | decisão unânime, 5 rounds |
| `status_ko.json` | `CORE/events/600061182/competitions/401907089/status` | KO/TKO no R3 aos 3:26 |
| `competitor_statistics.json` | `.../competitions/401912278/competitors/4054605/statistics` | estatísticas de uma lutadora na luta |
| `athlete_statistics.json` | `.../athletes/4025699/statistics` | médias de carreira |

Regras:

- Só entra aqui o que veio da API de verdade. Nada de completar campo "que deve existir".
- Campo que o app passar a ler tem que aparecer numa amostra antes. Se não aparece, capturar uma amostra nova.
- Estas amostras têm nomes reais porque são dados reais. O fixture inventado (`tests/mock_espn.py`) usa só nomes fictícios.
- Em `status_ko.json` falta o `clock` numérico de propósito: ele não foi capturado. O app lê o tempo de `displayClock`.
