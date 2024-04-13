import isElectron from "is-electron";

const cacheNames = [
    "thumbs",
    "face-crops",
    // Desktop app only
    "files",
] as const;

/**
 * Namespaces into which our caches data is divided
 *
 * Note that namespaces are just arbitrary (but predefined) strings to split the
 * cached data into "folders", so to speak.
 * */
export type CacheName = (typeof cacheNames)[number];

/**
 * A namespaced cache.
 *
 * This cache is suitable for storing large amounts of data (entire files).
 *
 * To obtain a cache for a given namespace, use {@link openCache}. To clear all
 * cached data (e.g. during logout), use {@link clearCaches}.
 *
 * [Note: Caching files]
 *
 * The underlying implementation of the cache is different depending on the
 * runtime environment.
 *
 * * The preferred implementation, and the one that is used when we're running
 *   in a browser, is to use the standard [Web
 *   Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache).
 *
 * * However when running under Electron (when this code runs as part of our
 *   desktop app), a custom OPFS based cache is used instead. This is because
 *   Electron currently doesn't support using standard Web Cache API for data
 *   served by a custom protocol handler (See this
 *   [issue](https://github.com/electron/electron/issues/35033), and the
 *   underlying restriction that comes from
 *   [Chromium](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/modules/cache_storage/cache.cc;l=83-87?q=%22Request%20scheme%20%27%22&ss=chromium))
 *
 * [OPFS](https://web.dev/articles/origin-private-file-system) stands for Origin
 * Private File System. It is a recent API that allows a web site to store
 * reasonably large amounts of data. One option (that may still become possible
 * in the future) was to always use OPFS for caching instead of this dual
 * implementation, however currently [Safari does not support writing to OPFS
 * outside of web
 * workers](https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/)
 * ([the WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=231706)), so it's
 * not trivial to use this as a full on replacement of the Web Cache in the
 * browser. So for now we go with this split implementation.
 *
 * See also: [Note: Increased disk cache for the desktop app].
 */
export interface EnteCache {
    /**
     * Get the data corresponding to {@link key} (if found) from the cache.
     */
    get: (key: string) => Promise<Uint8Array | undefined>;
    match: (key: string) => Promise<Response | undefined>;
    /**
     * Add the given {@link key}-value ({@link data}) pair to the cache.
     */
    put: (key: string, data: Response) => Promise<void>;
    /**
     * Delete the data corresponding to the given {@link key}.
     *
     * The returned promise resolves to `true` if a cache entry was found,
     * otherwise it resolves to `false`.
     * */
    delete: (key: string) => Promise<boolean>;
}

/**
 * Return the {@link EnteCache} corresponding to the given {@link name}.
 *
 * @param name One of the arbitrary but predefined namespaces of type
 * {@link CacheName} which group related data and allow us to use the same key
 * across namespaces.
 */
export const openCache = async (name: CacheName): Promise<EnteCache> =>
    isElectron() ? openOPFSCacheWeb(name) : openWebCache(name);

/**
 * [Note: ArrayBuffer vs Blob vs Uint8Array]
 *
 * ArrayBuffers are in memory, while blobs are unreified, and can directly point
 * to on disk objects too.
 *
 * If we are just passing data around without necessarily needing to manipulate
 * it, and we already have a blob, it's best to just pass that blob. Further,
 * blobs also retains the file's encoding information , and are thus a layer
 * above array buffers which are just raw byte sequences.
 *
 * ArrayBuffers are not directly manipulatable, which is where some sort of a
 * typed array or a data view comes into the picture. The typed `Uint8Array` is
 * a common way.
 *
 * To convert from ArrayBuffer to Uint8Array,
 *
 *     new Uint8Array(arrayBuffer)
 *
 * Blobs are immutable, but a usual scenario is storing an entire file in a
 * blob, and when the need comes to display it, we can obtain a URL for it using
 *
 *     URL.createObjectURL(blob)
 *
 * Refs:
 * - https://github.com/yigitunallar/arraybuffer-vs-blob
 * - https://stackoverflow.com/questions/11821096/what-is-the-difference-between-an-arraybuffer-and-a-blob
 */

/** An implementation of {@link EnteCache} using Web Cache APIs */
const openWebCache = async (name: CacheName) => {
    const cache = await caches.open(name);
    return {
        get: async (key: string) => {
            // return cache.match(key);
            const _ = await cache.match(key);
            return undefined;
        },
        match: (key: string) => {
            return cache.match(key);
        },
        put: (key: string, data: Response) => {
            return cache.put(key, data);
        },
        delete: (key: string) => {
            return cache.delete(key);
        },
    };
};

/** An implementation of {@link EnteCache} using OPFS */
const openOPFSCacheWeb = async (name: CacheName) => {
    // While all major browsers support OPFS now, their implementations still
    // have various quirks. However, we don't need to handle all possible cases
    // and can just instead use the APIs and guarantees Chromium provides since
    // this code will only run in our Electron app (which'll use Chromium as the
    // renderer).
    //
    // So for our purpose, these can serve as the doc for what's available:
    // https://web.dev/articles/origin-private-file-system
    const cache = await caches.open(name);

    const root = await navigator.storage.getDirectory();
    const _caches = await root.getDirectoryHandle("cache", { create: true });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _cache = await _caches.getDirectoryHandle(name, { create: true });

    return {
        get: async (key: string) => {
            const _ = await cache.match(key);
            return undefined;
        },
        match: (key: string) => {
            // try {
            //     const fileHandle = _cache.getFileHandle(key);
            //     const file = await fileHandle.getFile();
            // } catch (e) {
            //     if (e instanceof DOMException && e.name == "NotFoundError")
            //         return undefined;
            //     throw e;
            // }
            return cache.match(key);
        },
        put: async (key: string, data: Response) => {
            // const fileHandle = await _cache.getFileHandle(key, { create: true })
            // await fileHandle.write(data);
            // await fileHandle.close();
            await cache.put(key, data);
        },
        delete: (key: string) => {
            // try {
            //     await _cache.removeEntry(key);
            //     return true;
            // } catch (e) {
            //     if (e instanceof DOMException && e.name == "NotFoundError")
            //         return false;
            //     throw e;
            // }
            return cache.delete(key);
        },
    };
};

export async function cached(
    cacheName: CacheName,
    id: string,
    get: () => Promise<Blob>,
): Promise<Blob> {
    const cache = await openCache(cacheName);
    const cacheResponse = await cache.match(id);

    let result: Blob;
    if (cacheResponse) {
        result = await cacheResponse.blob();
    } else {
        result = await get();

        try {
            await cache.put(id, new Response(result));
        } catch (e) {
            // TODO: handle storage full exception.
            console.error("Error while storing file to cache: ", id);
        }
    }

    return result;
}

/**
 * Delete all cached data.
 *
 * Meant for use during logout, to reset the state of the user's account.
 */
export const clearCaches = async () =>
    isElectron() ? clearOPFSCaches() : clearWebCaches();

export const clearWebCaches = async () => {
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
};

export const clearOPFSCaches = async () => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry("cache", { recursive: true });
};
