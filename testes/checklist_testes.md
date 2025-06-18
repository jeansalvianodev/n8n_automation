# Checklist de testes

esse é um arquivo de testes para integração com Kommo. Coloquei bastante comandos úteis pra validar tudo manualmente. Atualizado conforme testes foram feitos.

# casos de testes principais
|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
| ID  | cenário                     | entrada                                              | retorno esperado                                                      | como            |
|||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||
| CT1 | Lead com scoring ≥ 80       | `{"lead_id": 1001, "scoring": 85}`                    | Lead deve ser movido para o estágio "Quente" (ID: 456)                 | Enviar webhook manual ou atualizar lead direto no Kommo                                         |
| CT2 | Lead com scoring < 80       | `{"lead_id": 1002, "scoring": 60}`                    | Lead continua no estágio atual                                        | Verificar logs e confirmar status: `"status": "ignored"`                                       |
| CT3 | Token válido                | Header: `Authorization: Bearer {{token}}`             | HTTP 200 + dados do lead retornados corretamente                      | Testar via n8n ou cURL (ver exemplo abaixo)                                                     |
| CT4 | Token expirado (401)        | Usar token vencido no header                          | Deve retornar 401, renovar token e repetir chamada                    | Forçar token inválido e observar se flow lida com isso                                          |
| CT5 | Lead não encontrado (404)   | `{"lead_id": 99999}`                                  | HTTP 404 + log ou notificação no Slack                                | Testar com um ID qualquer que não existe                                                        |
| CT6 | Rate limit excedido (429)   | Enviar +50 chamadas seguidas em 1 min                 | HTTP 429 + sistema deve esperar 5s e tentar de novo                   | Usei Postman com runner e delay pequeno – às vezes não bate o limite                            |
| CT7 | Payload inválido            | `{"lead": "abc"}` (faltando `lead_id`)                | Erro tratado: `"Payload inválido: falta lead_id"`                     | Simular envio manual com JSON malformado                                                        |

# testes de segurança
|-------------------------------------------------------------------------------------------------------------------------|
| ID  | cenário                    | entrada                            | retorno esperado                                |
|-----|-----------------------------|-------------------------------------|-----------------------------------------------|
| ST1 | API-key inválida           | Token errado no header Authorization | HTTP 401 + log sem dados sensíveis            |
| ST2 | Sem autenticação           | Chamada sem Authorization           | HTTP 403 (acesso negado)                      |
| ST3 | Logs com dados sensíveis   | Lead com email ou CPF               | Logs só mostram `lead_id`, nada sensível      |

 esse log mascara os dados sensíveis corretamente, mas conferir sempre se algum campo novo escapa da anonimização

---

# comandos úteis pra testar manualmente

```bash
# atualiza o estágio do lead manualmente
curl -X PATCH \
  -H "Authorization: Bearer $KOMMO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status_id":456}' \
  "https://kommo.com/api/v4/leads/1001"

# simula um webhook local via ngrok ou qualquer túnel
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"lead_id":1001,"scoring":85}' \
  "http://seu-endereco-ngrok.ngrok.io/webhook/kommo"
