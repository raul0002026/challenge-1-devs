import type { FastifyInstance } from 'fastify';
import { createSessionToken, hashPassword, verifyPassword } from '../../domain/auth';
import type { PublicUser, User } from '../../domain/types';

interface AuthBody {
  email?: unknown;
  password?: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: AuthBody }>('/register', async (request, reply) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';

    if (!EMAIL_RE.test(email) || password.length < MIN_PASSWORD_LENGTH) {
      return reply.code(400).send({
        error: `a valid email and a password of at least ${MIN_PASSWORD_LENGTH} characters are required`,
      });
    }
    if (app.repo.getUserByEmail(email)) {
      return reply.code(409).send({ error: 'email already registered' });
    }

    const user = app.repo.createUser(email, hashPassword(password));
    const token = createSessionToken({ userId: user.id, email: user.email });
    return reply.code(201).send({ token, user: toPublicUser(user) });
  });

  app.post<{ Body: AuthBody }>('/login', async (request, reply) => {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const password = typeof request.body?.password === 'string' ? request.body.password : '';

    if (!email || !password) {
      return reply.code(400).send({ error: 'email and password are required' });
    }

    const user = app.repo.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: 'invalid credentials' });
    }

    const token = createSessionToken({ userId: user.id, email: user.email });
    return reply.send({ token, user: toPublicUser(user) });
  });
}
