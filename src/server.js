'use strict';

require('dotenv').config({ quiet: true });
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
// Escuta apenas em localhost: o acesso externo passa obrigatoriamente pelo Nginx (HTTPS).
const HOST = process.env.HOST || '127.0.0.1';

createApp().listen(PORT, HOST, () => {
  console.log(`Aplicação rodando em http://${HOST}:${PORT}`);
});
