'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { createApp } = require('../src/app');

const USUARIO = 'aluno';
const SENHA = 'senha-de-teste-123';

function novaApp(extra = {}) {
  return createApp({
    appUser: USUARIO,
    passwordHash: bcrypt.hashSync(SENHA, 4),
    sessionSecret: 'segredo-apenas-para-testes',
    env: 'test',
    ...extra,
  });
}

describe('A01 - Controle de acesso', () => {
  test('painel sem login redireciona para /login', async () => {
    const res = await request(novaApp()).get('/painel');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/login');
  });

  test('login válido dá acesso ao painel e logout encerra a sessão', async () => {
    const agent = request.agent(novaApp());
    const login = await agent.post('/login').type('form').send({ usuario: USUARIO, senha: SENHA });
    assert.equal(login.status, 302);
    assert.equal(login.headers.location, '/painel');

    const painel = await agent.get('/painel');
    assert.equal(painel.status, 200);
    assert.match(painel.text, /Painel interno/);
    assert.equal(painel.headers['cache-control'], 'no-store');

    const logout = await agent.post('/logout');
    assert.equal(logout.status, 302);

    const depois = await agent.get('/painel');
    assert.equal(depois.status, 302);
    assert.equal(depois.headers.location, '/login');
  });
});

describe('A05 - Injection', () => {
  test('entrada com HTML/script é rejeitada e exibida escapada', async () => {
    const res = await request(novaApp())
      .post('/login')
      .type('form')
      .send({ usuario: '<script>alert(1)</script>', senha: 'x' });
    assert.equal(res.status, 400);
    assert.ok(!res.text.includes('<script>alert(1)</script>'));
    assert.ok(res.text.includes('&lt;script&gt;'));
  });

  test('tentativa de injeção no usuário não autentica', async () => {
    const res = await request(novaApp())
      .post('/login')
      .type('form')
      .send({ usuario: "' OR '1'='1", senha: "' OR '1'='1" });
    assert.equal(res.status, 400);
  });
});

describe('A07 - Falhas de autenticação', () => {
  test('senha errada retorna mensagem genérica', async () => {
    const res = await request(novaApp()).post('/login').type('form').send({ usuario: USUARIO, senha: 'errada' });
    assert.equal(res.status, 401);
    assert.match(res.text, /Usuário ou senha inválidos/);
  });

  test('bloqueia após 5 tentativas (força bruta)', async () => {
    const app = novaApp();
    for (let i = 0; i < 5; i += 1) {
      const r = await request(app).post('/login').type('form').send({ usuario: USUARIO, senha: 'errada' });
      assert.equal(r.status, 401);
    }
    const bloqueado = await request(app).post('/login').type('form').send({ usuario: USUARIO, senha: SENHA });
    assert.equal(bloqueado.status, 429);
  });

  test('cookie de sessão é HttpOnly e SameSite=Strict', async () => {
    const res = await request(novaApp()).post('/login').type('form').send({ usuario: USUARIO, senha: SENHA });
    const cookie = res.headers['set-cookie'].join(';');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
  });
});

describe('Configuração', () => {
  test('não expõe X-Powered-By e envia cabeçalhos de segurança', async () => {
    const res = await request(novaApp()).get('/login');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.ok(res.headers['content-security-policy']);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });
});
