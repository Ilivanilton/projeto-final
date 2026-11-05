'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const MENSAGEM_GENERICA = 'Usuário ou senha inválidos.';

module.exports = function authRoutes(config) {
  const router = express.Router();

  // OWASP A07:2025 - Authentication Failures
  // Limita tentativas de login por IP (proteção contra força bruta).
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // janela de 15 minutos
    limit: config.loginMaxAttempts, // 5 tentativas
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).render('login', {
        erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.',
        usuario: '',
      });
    },
  });

  // OWASP A05:2025 - Injection
  // Validação no servidor: só aceita o formato esperado de entrada.
  const validarLogin = [
    body('usuario')
      .trim()
      .isLength({ min: 3, max: 32 })
      .matches(/^[a-zA-Z0-9._-]+$/),
    body('senha').isString().isLength({ min: 1, max: 128 }),
  ];

  router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/painel');
    return res.render('login', { erro: null, usuario: '' });
  });

  router.post('/login', loginLimiter, validarLogin, async (req, res, next) => {
    try {
      const usuario = String(req.body.usuario ?? '');
      const senha = String(req.body.senha ?? '');

      // Entrada fora do padrão é rejeitada antes de qualquer processamento.
      // O valor digitado é devolvido à tela, mas o EJS (<%= %>) o escapa:
      // um "<script>" aparece como texto e nunca é executado.
      if (!validationResult(req).isEmpty()) {
        return res.status(400).render('login', { erro: MENSAGEM_GENERICA, usuario });
      }

      // OWASP A07:2025 - a senha é comparada com um hash bcrypt (nunca em texto puro).
      const usuarioOk = usuario === config.appUser;
      const senhaOk = await bcrypt.compare(senha, config.passwordHash);

      // Mensagem genérica: não revela se o erro foi no usuário ou na senha.
      if (!usuarioOk || !senhaOk) {
        return res.status(401).render('login', { erro: MENSAGEM_GENERICA, usuario });
      }

      // Nova sessão após o login (evita fixação de sessão).
      return req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.user = usuario;
        req.session.loginAt = Date.now();
        return res.redirect('/painel');
      });
    } catch (err) {
      return next(err);
    }
  });

  // OWASP A01:2025 - logout destrói a sessão no servidor e apaga o cookie.
  router.post('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('sid');
      return res.redirect('/login');
    });
  });

  return router;
};
