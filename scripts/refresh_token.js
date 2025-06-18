// esse é um exemplo de script que atualizaria o token OAuth quando a API retornar o erro 401 

const axios = require('axios'); 

// pega as credenciais do n8n
const currentCreds = await $credentials.getCredentialData('kommo-oauth');

// prepara o request de atualização
const params = new URLSearchParams();
params.append('client_id', currentCreds.clientId);
params.append('client_secret', currentCreds.clientSecret);
params.append('grant_type', 'refresh_token');
params.append('refresh_token', currentCreds.refreshToken);

try {
  // executa a atualização (o link utilizado é exemplo, não está funcional)
  const response = await axios.post('https://kommo.com/oauth2/access_token', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  // atualiza as credenciais no n8n
  await $credentials.updateCredentialData('kommo-oauth', {
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
    expiresIn: Date.now() + (response.data.expires_in * 1000)
  });

  // retorna o novo token
  return {
    access_token: response.data.access_token,
    expires_in: response.data.expires_in
  };

} catch (error) {
  // mensagem de erro - envio por e-mail
  await $send.email({
    to: "jeasalvianodev@gmail.com",
    subject: "KOMMO OAUTH FAILURE",
    body: `Atualização do token falhou: ${error.message}`
  });
  
  throw new Error(`atualização do OAuth falhou: ${error.response?.data?.error || error.message}`);
}