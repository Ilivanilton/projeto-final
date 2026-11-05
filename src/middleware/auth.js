'use strict';

/**
 * OWASP A01:2025 - Broken Access Control
 * Bloqueia o acesso a rotas internas para quem não está autenticado.
 * Sem sessão válida => redireciona para a tela de login.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    // Impede que o navegador guarde páginas internas em cache
    // (botão "voltar" após o logout não mostra o conteúdo).
    res.set('Cache-Control', 'no-store');
    return next();
  }
  return res.redirect('/login');
}

module.exports = { requireAuth };
