import { describe, expect, it } from '@jest/globals';

import { authErrorMessage, checkDisplayName, checkPassword, isValidEmail, normalizeEmail } from './authForm';

describe('e-mail', () => {
  it('normaliza espaços e maiúsculas', () => {
    expect(normalizeEmail('  Vinicius@Email.COM ')).toBe('vinicius@email.com');
  });

  it.each(['a@b.com', ' x.y+poker@dominio.com.br '])('"%s" é válido', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'sem-arroba.com', 'a@b', 'a @b.com', 'a@b.c'])('"%s" é inválido', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('nome e senha', () => {
  it('nome obrigatório e até 40 caracteres', () => {
    expect(checkDisplayName('   ')).not.toBeNull();
    expect(checkDisplayName('Vinicius')).toBeNull();
    expect(checkDisplayName('x'.repeat(41))).not.toBeNull();
  });

  it('senha com pelo menos 6 caracteres', () => {
    expect(checkPassword('12345')).not.toBeNull();
    expect(checkPassword('123456')).toBeNull();
  });
});

describe('authErrorMessage', () => {
  it('traduz pelo código', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('E-mail ou senha incorretos.');
    expect(authErrorMessage({ code: 'user_already_exists' })).toContain('Já existe');
  });

  it('traduz pela mensagem quando não há código', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.');
    expect(authErrorMessage({ message: 'Database error saving new user' })).toContain('18+');
    expect(authErrorMessage({ message: 'Network request failed' })).toContain('conexão');
  });

  it('tem mensagem padrão', () => {
    expect(authErrorMessage(null)).toBe('Algo deu errado. Tente de novo.');
    expect(authErrorMessage({ code: 'algo_novo', message: 'xyz' })).toBe('Algo deu errado. Tente de novo.');
  });
});
