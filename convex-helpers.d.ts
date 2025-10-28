declare module "convex-helpers" {
    export function asyncMap<T, U>(
      arr: T[],
      callback: (item: T) => Promise<U>
    ): Promise<U[]>;
  }
  