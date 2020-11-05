/* global localStorage, */
/**
 * @author Kuitos
 * @homepage https://github.com/kuitos/
 * @since 2017-10-12
 */

import { AxiosAdapter, AxiosPromise } from 'axios';
import localForage from 'localforage';
import LRUCache from 'lru-cache';

import buildSortedURL from './utils/buildSortedURL';
import isCacheLike from './utils/isCacheLike';

declare module 'axios' {
  interface AxiosRequestConfig {
    forceUpdate?: boolean;
    cache?: boolean | ICacheLike<any>;
  }
}

const FIVE_MINUTES = 1000 * 60 * 5;
const CAPACITY = 100;

export interface ICacheLike<T> {
  get(key: string): T | undefined;

  set(key: string, value: T, maxAge?: number): boolean;

  del(key: string): void;
}

export type Options = {
  enabledByDefault?: boolean,
  cacheFlag?: string,
  defaultCache?: ICacheLike<AxiosPromise>,
};

export default function cacheAdapterEnhancer(adapter: AxiosAdapter, options: Options = {}): AxiosAdapter {

  const {
    enabledByDefault = true,
    cacheFlag = 'cache',
  } = options;

  return async config => {

    const { url, method, params, paramsSerializer, forceUpdate } = config;
    const useCache = ((config as any)[cacheFlag] !== void 0 && (config as any)[cacheFlag] !== null)
      ? (config as any)[cacheFlag]
      : enabledByDefault;

    if (method === 'get' && useCache) {

      // build the index according to the url and params
      const index = buildSortedURL(url, params, paramsSerializer);

      const item = await localForage.getItem(index);

      let responsePromise: Promise<any>;

      if (!item || forceUpdate) {
        responsePromise = adapter(config)
          .then(response => {
            const dataToSerialize = { data: response.data, status: response.status, request: null };
            localForage.setItem(index, dataToSerialize);
            return response;
          }).catch(reason => {
            localForage.removeItem(index);
            throw reason;
          });
        // put the promise for the non-transformed response into cache as a placeholder
      } else {
        responsePromise = Promise.resolve(item);
      }
      /* istanbul ignore next */
      if (process.env.LOGGER_LEVEL === 'info') {
        // eslint-disable-next-line no-console
        console.info(`[axios-extensions] request cached by cache adapter --> url: ${index}`);
      }

      return responsePromise;
    }

    return adapter(config);
  };
}
