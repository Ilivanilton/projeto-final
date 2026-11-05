'use strict';

// Gera o hash bcrypt de uma senha para colocar em APP_PASSWORD_HASH no .env.
// Uso: node scripts/hash-password.js   (a senha é lida da entrada padrão, sem aparecer no histórico)
const bcrypt = require('bcryptjs');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const senha = input.replace(/\r?\n$/, '');
  if (senha.length < 12) {
    console.error('Use uma senha com pelo menos 12 caracteres.');
    process.exit(1);
  }
  console.log(bcrypt.hashSync(senha, 12));
});
