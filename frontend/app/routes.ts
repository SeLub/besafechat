import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/index.tsx'),
  route('auth', 'routes/auth.tsx'),
  route('design-preview', 'routes/design-preview.tsx'),
  route('s3test', 'routes/s3test.tsx'),
] satisfies RouteConfig;
