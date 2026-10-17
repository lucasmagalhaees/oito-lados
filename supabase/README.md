# Servidor (Supabase)

O banco e o login da sincronização entre aparelhos (D98, D99 em `docs/decisoes.md`). O app funciona sem ele. O endereço e a chave publicável do projeto ficam em `src/core/cloud.ts` (`CLOUD_URL`, `CLOUD_KEY`); vazios, o cartão "Sincronizar aparelhos" não aparece e nada é chamado.

- `schema.sql`: a tabela `states` (uma linha por pessoa, com o estado inteiro do app), as regras de quem lê e escreve o quê, e a função `keepalive` que a rotina diária chama. Rodar de novo não muda nada.
- `tests/schema_check.sh` roda o `schema.sql` num Postgres local, imitando o que ele usa do Supabase, e confere as regras. Imitação não é o Supabase: o que foi conferido no projeto de verdade está em `docs/verificacao.md`.

## Montar o projeto (uma vez)

Passos para o Lucas. Os nomes de tela do Supabase são de 17/10/2026, lidos na documentação, e podem ter mudado.

1. Criar um projeto no plano Free, de preferência na região de São Paulo. **A senha do banco fica só com você**: o app não usa.
2. **SQL Editor:** colar o conteúdo de `schema.sql` e rodar.
3. **Authentication → Email Templates:** nos modelos "Magic Link" e "Confirm signup", pôr o código no corpo do e-mail, por exemplo `Seu código do Oito Lados: {{ .Token }}`. Sem o `{{ .Token }}` o e-mail chega com um link, e o app pede o código.
4. **Project Settings → API Keys:** copiar a **publishable key** (começa com `sb_publishable_`) e o endereço do projeto (`https://<id>.supabase.co`). Os dois são públicos por natureza (vão na página) e é só isso que precisa ser mandado. **A secret key (`sb_secret_`) não sai do Supabase**: não mande, não cole em lugar nenhum.
5. **Vercel → Settings → Environment Variables:** criar `CRON_SECRET` com um texto aleatório de pelo menos 16 caracteres, em Production. É o que só o cron da Vercel conhece; sem ele a rotina diária não roda.

O endereço e a chave já estão em `src/core/cloud.ts` desde 17/10/2026 (D99).
