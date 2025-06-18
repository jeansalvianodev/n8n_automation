# 1 Arquitetura do workflow no n8n

# Gatilhos:

- Webhook configurado para eventos como `lead_updated` ou `payment_received`.
- Cron (fallback) rodando a cada 30 minutos para buscar leads com filtros (`scoring >= 80`).

# fluxo em ASCII:

```
[Webhook] 
   ↓
[Function (Validação)] 
   ↓
[Kommo: GET /leads] 
   ↓
[IF (scoring ≥ 80?)] 
   ├── Sim ──▶ [Kommo: PATCH /leads/{id}] 
   │             ↓
   │        [Log Success]
   │
   └── Não/Erro ─▶ [Error Trigger] 
                      ↓
                [Slack Alert] 
                      ↓
     [Dead Letter Queue (Google Sheets)]
```

# 2 Autenticação

Método: API-key (`header Authorization: Bearer <API_KEY>`).

Armazenamento: Credencial criptografada no n8n.

Para renovação do OAuth usaria uma function node com um Refresh Token.
exemplo de function em js:

```javascript
if (response.statusCode === 401) {  
  await refreshToken();  
  return $node.execute(); // Repete a chamada  
}
```

# 3 API Kommo

Endpoints:

- Listar leads: `GET /api/v4/leads?filter[scoring][gte]=80`
- Atualizar lead: `PATCH /api/v4/leads/{id}`

```json
{
  "status_id": 456,
  "updated_at": "{{$timestamp}}"
}
```

# Paginação:

Loop com `page=N` até `_links.next` ser null.

# Rate Limit:

Se `statusCode === 429`, usar Wait Node com delay exponencial.

# 4 Mapeamento de Dados

# Campo Origem (Webhook) # Campo Destino (Kommo)      #
# lead.id                # PATCH /leads/{id}          #
# lead.scoring           # Filtro (IF Node)           #

# 5 Tratamento de Erros

- Retry: 3 tentativas com backoff (2s, 4s, 8s).
- Dead Letter Queue: Google Sheets com colunas: `lead_id`, `erro`, `timestamp`.
- Notificação: Mensagem no Slack:

```plaintext
[ERRO] Falha ao mover lead ${lead_id}: ${error.message}
```

# 6 Segurança

- PII: Sanitizar logs: `console.log("Lead ID: " + lead.id)` (nunca nome/email).
- Credenciais: Usar variáveis de ambiente (`{{$env.API_KEY}}`).

# 7 Observabilidade

# faria um log em json, exemplo:

```json
{
  "timestamp": "2024-05-20T12:00:00Z",
  "lead_id": 123,
  "status": "success",
  "execution_time_ms": 450
}
```

# 8 Testes

Sandbox:

eu optaria por criar uma pipeline chamada "Teste Automação" com estágios:

- 10: Leads Fria
- 20: Leads Quente

# 9 Extensibilidade

function reutilizável em js:

```javascript
function moveEntity(entityType, id, newStatus) {
  const baseUrl = "/api/v4/";
  return {
    url: baseUrl + entityType + "/" + id,
    body: { status_id: newStatus }
  };
}
// Uso: moveEntity("leads", 123, 456);
```

---

# B Exemplo de Workflow n8n

um pequeno exemplo em json:

```json
{
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "id": "1",
      "webhookPath": "kommo-events"
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "id": "2",
      "url": "https://kommo.com/api/v4/leads/{{$node[\"Webhook\"].json[\"lead_id\"]}}",
      "authentication": "apiKey",
      "headers": {
        "Authorization": "Bearer {{$env.KOMMO_API_KEY}}"
      }
    }
  ]
}
```

---

# C Plano de Segurança

# Medida       # Descrição                                                                 #
# Credenciais  # Armazenadas no n8n com criptografia AES-256.                              #
# Logs         # Masking de campos sensíveis (email, CPF) via Function Node.               #
# LGPD         # Dados pessoais só trafegam em HTTPS; retenção máxima de 30 dias em logs.  #

---

# D checklist de testes

# Caso              # Entrada                        # Saída Esperada                             # cURL                                                                                              #
# Lead scoring=90   # `{lead_id: 1, scoring: 90}`    # Lead movido para estágio "Quente"          # `curl -X PATCH -H "Authorization: Bearer XXX" https://kommo.com/api/v4/leads/1 -d '{"status_id":456}'` #
# Lead não existe   # `{lead_id: 999}`               # HTTP 404 + Slack alert                     # `curl -X GET -H "Authorization: Bearer XXX" https://kommo.com/api/v4/leads/999`                        #
# API-key inválida  # Header Authorization: Bearer INVALID # HTTP 401 + Error Trigger             #                                                                                                        #
