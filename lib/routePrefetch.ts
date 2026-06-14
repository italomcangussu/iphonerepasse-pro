type RouteLoader = () => Promise<unknown>;

const primaryRouteLoaders = new Map<string, RouteLoader>();
const prefetchedRoutes = new Set<string>();

export const registerPrimaryRouteLoaders = (loaders: Record<string, RouteLoader>): void => {
  Object.entries(loaders).forEach(([path, loader]) => {
    primaryRouteLoaders.set(path, loader);
  });
};

export const prefetchPrimaryRoute = (path: string): void => {
  const loader = primaryRouteLoaders.get(path);
  if (!loader || prefetchedRoutes.has(path)) return;

  prefetchedRoutes.add(path);
  void loader().catch(() => {
    prefetchedRoutes.delete(path);
  });
};
