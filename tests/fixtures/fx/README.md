# Amostra real do serviço de câmbio

Resposta real do Frankfurter, capturada em **09/10/2026**. Serve de contrato: `tests/contract.py` passa a amostra por `Core.normFx` e confere o resultado.

| Arquivo | Chamada |
|---|---|
| `latest_brl.json` | `https://api.frankfurter.dev/v1/latest?base=BRL&symbols=USD,EUR` |

Como foi capturada: pelo workflow `ESPN contract` no GitHub Actions (execução 38001453842), que chama o serviço com a origem de produção e imprime a resposta numa anotação. O que está gravado é a resposta **depois de lida como JSON e escrita de novo**, não os bytes originais: detalhes de formatação (por exemplo `1.0` contra `1`) podem diferir do que o serviço mandou.

Regras:

- Só entra aqui o que veio do serviço de verdade. A cotação usada nos testes de interface é inventada e fica em `tests/mock_espn.py`, com números redondos e data antiga para não passar por cotação real.
- Campo novo que o app passar a ler tem que aparecer numa amostra antes.
