import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { createRepo, type Db, type Repo } from '../db/index';
import { verifySessionToken, type SessionPayload } from '../domain/auth';
import { registerAuthRoutes } from './routes/auth';
import { registerTaskRoutes } from './routes/tasks';
import { registerMetricsRoutes } from './routes/metrics';

declare module 'fastify' {
  interface FastifyInstance {
    repo: Repo;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: SessionPayload;
  }
}

export function buildServer(db: Db): FastifyInstance {
  const app = Fastify({ logger: false });

  app.decorate('repo', createRepo(db));
  app.decorateRequest('user', undefined);

  // Treat an empty JSON body as absent so bodyless requests carrying a stale
  // `Content-Type: application/json` header don't fail with FST_ERR_CTP_EMPTY_JSON_BODY.
  app.addContentTypeParser<string>(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      if (body === '' || body == null) {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(body));
      } catch (err) {
        (err as Error & { statusCode?: number }).statusCode = 400;
        done(err as Error, undefined);
      }
    },
  );

  app.decorate('authenticate', async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const header = request.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      await reply.code(401).send({ error: 'missing or invalid authorization header' });
      return;
    }
    const payload = verifySessionToken(header.slice('Bearer '.length));
    if (!payload) {
      await reply.code(401).send({ error: 'invalid session token' });
      return;
    }
    request.user = payload;
  });

  app.register(registerAuthRoutes, { prefix: '/api/auth' });
  app.register(registerTaskRoutes, { prefix: '/api/tasks' });
  app.register(registerMetricsRoutes, { prefix: '/api/metrics' });

  return app;
}
