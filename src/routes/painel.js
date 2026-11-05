'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');

module.exports = function painelRoutes() {
  const router = express.Router();

  // OWASP A01:2025 - a rota só é acessível após autenticação (requireAuth).
  router.get('/painel', requireAuth, (req, res) => {
    res.render('painel', {
      usuario: req.session.user,
      loginEm: new Date(req.session.loginAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    });
  });

  return router;
};
