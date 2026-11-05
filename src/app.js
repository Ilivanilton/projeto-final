'use strict';

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const painelRoutes = require('./routes/painel');

/**
 * Cria a aplicação Express.
 * As credenciais NUNCA ficam no código: vêm de variáveis de ambiente (.env no servidor).
 */
function createApp(options = {}) {
  const config = {
    appUser: options.appUser ?? process.env.APP_USER,
    passwordHash: options.passwordHash ?? process.env.APP_PASSWORD_HASH,
    sessionSecret: options.sessionSecret ?? process.env.SESSION_SECRET,
    isProduction: (options.env ?? process.env.NODE_ENV) === 'production',
    loginMaxAttempts: options.loginMaxAttempts ?? 5,
  };

  if (!config.appUser || !config.passwordHash || !config.sessionSecret) {
    throw new Error('Configuração ausente: defina APP_USER, APP_PASSWORD_HASH e SESSION_SECRET no .env');
  }

  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.disable('x-powered-by');
  // A aplicação roda atrás do Nginx (proxy reverso), que termina o HTTPS.
  app.set('trust proxy', 1);

  // Cabeçalhos de segurança (CSP, X-Frame-Options, nosniff, etc.)
  app.use(helmet());

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  app.use(
    session({
      name: 'sid',
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 15 * 60 * 1000 }),
      cookie: {
        httpOnly: true, // JavaScript do navegador não lê o cookie
        secure: config.isProduction, // só trafega via HTTPS em produção
        sameSite: 'strict', // não é enviado por outros sites
        maxAge: 30 * 60 * 1000, // sessão expira em 30 minutos
      },
    })
  );

  app.get('/', (req, res) => res.redirect(req.session.user ? '/painel' : '/login'));
  app.use(authRoutes(config));
  app.use(painelRoutes());

  app.use((req, res) => {
    res.status(404).render('erro', { titulo: 'Página não encontrada', mensagem: 'O endereço acessado não existe.' });
  });

  // Erro genérico: nunca mostra stack trace ao usuário.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('erro', { titulo: 'Erro interno', mensagem: 'Ocorreu um erro. Tente novamente mais tarde.' });
  });

  return app;
}

module.exports = { createApp };
