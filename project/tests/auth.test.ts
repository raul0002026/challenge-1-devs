import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from '../src/domain/auth';

describe('hasheo de contraseñas', () => {
  it('verifica la ida y vuelta de una contraseña correcta', () => {
    const stored = hashPassword('demo1234');
    expect(verifyPassword('demo1234', stored)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', () => {
    const stored = hashPassword('demo1234');
    expect(verifyPassword('wrong-password', stored)).toBe(false);
  });

  it('usa un salt aleatorio, por lo que la misma contraseña se hashea distinto', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rechaza un valor almacenado con formato inválido', () => {
    expect(verifyPassword('demo1234', 'not-a-valid-hash')).toBe(false);
    expect(verifyPassword('demo1234', '')).toBe(false);
  });
});

describe('tokens de sesión', () => {
  const secret = 'unit-test-secret';

  it('crea y verifica un token válido', () => {
    const token = createSessionToken({ userId: 42, email: 'a@b.com' }, secret);
    expect(verifySessionToken(token, secret)).toEqual({ userId: 42, email: 'a@b.com' });
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = createSessionToken({ userId: 42, email: 'a@b.com' }, secret);
    expect(verifySessionToken(token, 'other-secret')).toBeNull();
  });

  it('rechaza una firma alterada', () => {
    const token = createSessionToken({ userId: 42, email: 'a@b.com' }, secret);
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(verifySessionToken(tampered, secret)).toBeNull();
  });

  it('rechaza un token con estructura inválida', () => {
    expect(verifySessionToken('not-a-token', secret)).toBeNull();
    expect(verifySessionToken('a.b.c', secret)).toBeNull();
  });
});
