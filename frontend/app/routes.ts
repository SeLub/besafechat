import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/index.tsx'),
  route('auth', 'routes/auth.tsx'),
  route('avatartest', 'routes/avatartest.tsx'),
  route('mediatest', 'routes/mediatest.tsx'),
  route('phase5test', 'routes/phase5test.tsx'),
] satisfies RouteConfig;
