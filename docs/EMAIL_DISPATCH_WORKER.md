# Worker de campanhas de e-mail

O endpoint `GET /api/prospecting/email/worker` processa campanhas com status `scheduled`, `queued` ou `sending` sem depender do navegador.

## Variáveis obrigatórias

```env
APP_URL=https://seu-dominio.com
RESEND_API_KEY=re_xxx
CRON_SECRET=uma-sequencia-aleatoria-com-32-ou-mais-caracteres
```

O agendador deve enviar o cabeçalho:

```text
Authorization: Bearer <CRON_SECRET>
```

## Vercel Pro

Adicione ao `vercel.json` para executar uma vez por minuto:

```json
"crons": [
  {
    "path": "/api/prospecting/email/worker",
    "schedule": "* * * * *"
  }
]
```

Quando `CRON_SECRET` está configurado no projeto, o Vercel envia o cabeçalho `Authorization` automaticamente.

## Vercel Hobby

O cron nativo do plano Hobby só pode executar uma vez por dia. Para campanhas contínuas, use um agendador externo que faça a requisição autenticada a cada poucos minutos, ou mantenha o processamento cooperativo da tela aberto.

## Segurança e concorrência

- O segredo precisa ter pelo menos 16 caracteres.
- A comparação é feita em tempo constante.
- Uma trava consultiva do PostgreSQL impede dois workers simultâneos.
- Cada destinatário tem chave de idempotência estável no Resend.
- O worker processa no máximo três campanhas por rodada e quatro destinatários por campanha.
- Os limites por minuto e por dia configurados na campanha continuam valendo.
