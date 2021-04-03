
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");
const URL = require("url");
const HTTP = require("http");
const HTTPS = require("https");
const CRYPTO = require("crypto");
const TUNNEL = require("tunnel");
const Q = require("q");
const DEEPCOPY = require("deepcopy");
const MOMENT = require("moment");


var fetchQueue = {};

var UrlProxyCache = exports.UrlProxyCache = function(path, options) {
    this.path = path;
    this.options = DEEPCOPY(options);
    ASSERT(typeof options.ttl !== "undefined", "'options.ttl' required!");
    if (typeof this.options.verbose === "undefined") {
        this.options.verbose = false;
    }
}

function getProxyAgent(urlInfo) {
    function prepare(proxyUrl) {
        var proxyUrlInfo = URL.parse(proxyUrl);
        return [
            proxyUrlInfo,
            {
                proxy: {
                    host: proxyUrlInfo.hostname,
                    port: proxyUrlInfo.port,
                    rejectUnauthorized: false
                },
                rejectUnauthorized: false
            }
        ];
    }
    var agent;
    if (urlInfo.protocol === "https:") {
        // NOTE: If we need the global agent we need to create our own
        //       http://nodejs.org/api/https.html#https_https_request_options_callback
        //       and set `rejectUnauthorized: false`.
        agent = false;//HTTPS.globalAgent;
        var proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null;
        if (proxyUrl) {
            var info = prepare(proxyUrl);
            if (info[0].protocol === "https:") {
                agent = TUNNEL.httpsOverHttps(info[1]);
            } else {
                agent = TUNNEL.httpsOverHttp(info[1]);
            }
        }
    } else {
        // NOTE: If we need the global agent we need to create our own
        //       http://nodejs.org/api/https.html#https_https_request_options_callback
        //       and set `rejectUnauthorized: false`.
        agent = false;//HTTP.globalAgent;
        var proxyUrl = process.env.HTTP_PROXY || process.env.http_proxy || null;
        if (proxyUrl) {
            var info = prepare(proxyUrl);
            if (info[0].protocol === "https:") {
                agent = TUNNEL.httpOverHttps(info[1]);
            } else {
                agent = TUNNEL.httpOverHttp(info[1]);
            }
        }
    }
    return agent;
}

UrlProxyCache.prototype.get = function(url, options, callback) {
    var self = this;

    options = options || {};
    
    var verbose = self.options.verbose;
    if (typeof options.verbose !== "undefined") {
        verbose = options.verbose;
    }
    var debug = self.options.debug;
    if (typeof options.debug !== "undefined") {
        debug = options.debug;
    }

    var urlInfo = self.parseUrl(url, options);
    if (urlInfo.protocol === "file:") {
        if (FS.existsSync(urlInfo.pathname)) {
            return callback(null, {
                status: 200,
                body: FS.readFileSync(urlInfo.pathname).toString()
            });
        } else {
            return callback(null, {
                status: 404
            });
        }
    }

    return ensureParentPathExists(urlInfo.cachePath, options, function(err) {
        if (err) return callback(err);

        function fetch(callback) {

            function handleResponse(response, callback) {                
                if ((response.status === 301 || response.status === 302) && options.noredirect !== true) {
                    // Redirect.
                    return self.get(response.headers.location, options, callback);
                } else {
                    return callback(null, response);
                }
            }

            var metaPath = urlInfo.cachePath + "~~meta";
            var pathExists = false;
            
            function getPathMtime(metaPath, path, callback) {
                FS.exists(metaPath, function(exists) {
                    if (!exists) return callback(null, false);
                    FS.exists(path, function(exists) {
                        pathExists = exists;
                        FS.stat(metaPath, function(err, stats) {
                            if (err) return callback(err);
                            return callback(null, stats.mtime.getTime());
                        });
                    });
                });
            }
            
            return getPathMtime(metaPath, urlInfo.cachePath, function(err, mtime) {
                if (err) return callback(err);

                var ttl = self.options.ttl;
                // If `options.ttl === false` then defer to instance ttl.
                // If `typeof options.ttl === "undefined"` then defer to instance ttl.
                if (typeof options.ttl !== "undefined" && options.ttl !== false && (options.ttl >= -1 || (options.ttl >= Date.now()*-1 && options.ttl < -1))) {
                    ttl = options.ttl;
                }
                if ((""+Math.abs(ttl)).length === 10) {
                    ttl *= 1000;
                }
                function isCached() {
                    if (ttl >= -1) {
                        // If `ttl === -1` then force cache refresh.
                        // If `ttl === 0` then cache indefinite.
                        // If `ttl >= 1` then cache for ttl (milliseconds).     
                        if (mtime && ttl != -1 && (ttl === 0 || ((mtime + ttl) > new Date().getTime()))) {
                            return true;
                        }
                    } else
                    if (ttl < -1) {
                        if (mtime >= ttl*-1) {
                            return true;
                        }
                    }
                    return false;
                }
                if (isCached()) {

                    function loadCached(callback) {

                        function fail(err) {
                            if (verbose) console.log("err for url '" + url + "': " + err.stack);
                            if (!callback) {
                                console.error(err.stack);
                                return;
                            }
                            callback(err);
                            callback = null;
                        }
                        
                        return FS.readFile(metaPath, function(err, meta) {
                            if (err) return fail(err);
                            try {
                                meta = JSON.parse(meta);
                            } catch(err) {
                                return fail(err);
                            }
                            if (meta.status === 301 || meta.status === 302 || meta.status === 404) {
                                if (verbose) console.log("cached " + meta.status + " " + urlInfo.href + "(" + metaPath + ")");
                                callback(null, meta);
                                callback = null;
                                return;
                            }
                            // If original request was 200 but path no longer exists.
                            if (!pathExists || meta.status === 304) {
                                if (meta.status === 304) {
                                    // TODO: So `meta.status` should never be 304 now? If this is verified we can remove the `meta.status === 304` check.
                                    console.log("TEMPORARY: Re-fetching as meta cache format has changed.");
                                }
                                var opts = DEEPCOPY(options);
                                opts.ttl = -1;
                                var callbacks = fetchQueue[urlInfo.cachePath];
                                delete fetchQueue[urlInfo.cachePath];
                                return self.get(url, opts, function(err) {
                                    if (err) return callback(err);
                                    if (!fetchQueue[urlInfo.cachePath]) {
                                        fetchQueue[urlInfo.cachePath] = [];
                                    }
                                    fetchQueue[urlInfo.cachePath] = fetchQueue[urlInfo.cachePath].concat(callbacks);
                                    return callback.apply(null, arguments);
                                });
                            }
                            meta.status = 304;
                            if (options.loadBody === false) {
                                if (verbose) console.log("cached " + meta.status + " " + urlInfo.href + "(" + metaPath + ")");
                                callback(null, meta);
                                callback = null;
                                return;
                            }
                            return FS.readFile(urlInfo.cachePath, function(err, data) {
                                if (err) {
                                    fail(err);
                                    return;
                                }
                                meta.body = data;
                                if (verbose) console.log("cached " + meta.status + " " + urlInfo.href + "(" + metaPath + ")");
                                callback(null, meta);
                                callback = null;
                                return;
                            });
                        });
                    }
                    
                    return loadCached(function(err, response) {
                        if (err) return callback(err);
                        return handleResponse(response, callback);
                    });
                }
                else {

                    var time = new Date().getTime();
                    var tmpPath = urlInfo.cachePath + "~" + time;
                    var metaTmpPath = metaPath + "~" + time;
                    var meta = {};
                    
                    function writeMeta(callback) {
                        meta.cachePath = urlInfo.cachePath;
                        meta.etag = (meta.headers && meta.headers.etag) || null;
                        meta.expires = (meta.headers && meta.headers.expires && MOMENT(new Date(meta.headers.expires)).unix()) || null;
                        FS.writeFile(metaTmpPath, JSON.stringify(meta), function(err) {
                            if (err) {
                                callback(err);
                                return;
                            }
                            if (options.chown) {
                                FS.chownSync(metaTmpPath, options.chown.user, options.chown.group);
                            }
                            FS.rename(metaTmpPath, metaPath, function(err) {
                                if (err) {
                                    callback(err);
                                    return;
                                }
                                callback(null);
                            })
                        });
                    }

                    function makeRequest(callback) {

                        var existingMeta = false;

                        function returnExisting(callback) {
                            if (options.loadBody === false) {
                                if (verbose) console.log("emit " + existingMeta.status + " " + urlInfo.href);
                                return callback(null, existingMeta);
                            }
                            return FS.readFile(urlInfo.cachePath, function(err, data) {
                                if (err) return callback(err);
                                existingMeta.body = data;
                                if (verbose) console.log("emit " + existingMeta.status + " " + urlInfo.href);
                                return callback(null, existingMeta);
                            });
                        }

                        function fail(err) {
                            if (verbose) console.log("err for url '" + url + "': " + err.stack);
                            if (!callback) {
                                if (err && err !== true) console.error(err.stack);
                                return;
                            }
                            if (options.useExistingOnError) {
                                if (existingMeta) {
                                    return returnExisting(callback);
                                }
                            }
                            callback(err);
                            callback = null;
                        }
                        
                        function checkExisting(callback) {

                            // If we have meta data & file exists we send a HEAD request first to see if
                            // anything has changed.

                            return FS.exists(metaPath, function(exists) {
                                if (!exists) return callback(null);
                                
                                return FS.readFile(metaPath, function(err, data) {
                                    if (err) return fail(err);

                                    existingMeta = JSON.parse(data);

                                    if (options.nohead) {
                                        return callback(null);
                                    }

                                    if (ttl === -1)  {
                                        return callback(null);
                                    }
                              
                                    if (existingMeta.headers.etag) {
                                        // We have an Etag so we just send a 'If-None-Match' header below.
                                        return callback(null);
                                    }

                                    var args = {
                                        host: urlInfo.hostname,
                                        port: urlInfo.port || ((urlInfo.protocol==="https:")?443:80),
                                        path: urlInfo.path,
                                        agent: getProxyAgent(urlInfo),
                                        method: "HEAD",
                                        rejectUnauthorized: false,
                                        headers: options.headers || {}
                                    };

                                    function handleResult(res) {

                                        ASSERT(typeof res === "object");
                                        ASSERT(typeof res.statusCode === "number");
                                        ASSERT(typeof res.headers === "object");

                                        if (verbose) console.log("head " + res.statusCode + " " + urlInfo.href);
                                        if (res.statusCode === 301 || res.statusCode === 302) {
                                            existingMeta.status = res.statusCode;
                                            return callback(null, existingMeta);
                                        } else
                                        if (res.statusCode === 200) {
                                            var same = true;
                                            if (typeof res.headers["content-length"] !== "undefined" && res.headers["content-length"] !== existingMeta.headers["content-length"]) {
                                                same = false;
                                            }
                                            if (typeof res.headers["content-disposition"] !== "undefined" && res.headers["content-disposition"] !== existingMeta.headers["content-disposition"]) {
                                                same = false;
                                            }
                                            if (typeof res.headers["etag"] !== "undefined" && res.headers["etag"] !== existingMeta.headers["etag"]) {
                                                same = false;
                                            }
                                            // TODO: Check some other fields like 'Etag'?
                                            if (same) {
                                                existingMeta.status = 304;

                                                var time = new Date();
                                                FS.utimesSync(metaPath, time, time);
                                                if (verbose) console.log("touched " + metaPath);

                                                return returnExisting(callback);
                                            }
                                        }
                                        return callback(null);
                                    }

                                    if (typeof options.responder === "function") {

                                        if (verbose) console.log("responder HEAD " + urlInfo.href);
        
                                        options.responder(args, function(err, result) {
                                            if (err) return fail(err);
                                            try {
                                                return handleResult(result);
                                            } catch(err) {
                                                return fail(err);
                                            }
                                        });

                                    } else {

                                        if (verbose) console.log("http HEAD " + urlInfo.href);
                                        if (debug) console.log("HEAD request options", args);
                                        var request = ((urlInfo.protocol==="https:")?HTTPS:HTTP).request(args, handleResult);
                                        request.on("error", function(err) {
                                            // May not want to fail here but try again or make GET request?
                                            return fail(err);
                                        });
                                        request.end();
                                    }
                                });
                            });
                        }

                        return checkExisting(function(err, foundExisting) {
                            if (err) return fail(err);
                            if (foundExisting) {
//console.log("found existing!!!!", foundExisting);
                                return callback(null, foundExisting);
                            }

                            var writeStream = FS.createWriteStream(tmpPath);
                            writeStream.on("error", fail);
                            writeStream.on("close", function() {
                                if (callback) {
                                    // Success.
                                    writeMeta(function(err) {
                                        if (err) return fail(err);
                                        if (options.chown) {
                                            FS.chownSync(tmpPath, options.chown.user, options.chown.group);
                                        }
                                        FS.rename(tmpPath, urlInfo.cachePath, function(err) {
                                            if (err) return fail(err);
                                            if (options.loadBody === false) {
                                                callback(null, meta);
                                                callback = null;
                                                return;
                                            }
                                            FS.readFile(urlInfo.cachePath, function(err, data) {
                                                if (err) return fail(err);
                                                meta.body = data;
                                                callback(null, meta);
                                                callback = null;
                                            });
                                        });
                                    });
                                } else {
                                    // We had an error.
                                    FS.unlink(tmpPath, function(err) {
                                        if (err) console.error(err.stack);
                                    });
                                }
                            });

                            var headers = options.headers || {};
                            headers['user-agent'] = headers['user-agent'] || "Nodejs/url-proxy-cache";
                            if (existingMeta && existingMeta.headers.etag && ttl != -1) {
                                headers["If-None-Match"] = existingMeta.headers.etag;
                            }

                            if (debug) console.log("headers", headers);

                            var args = {
                                host: urlInfo.hostname,
                                port: urlInfo.port || ((urlInfo.protocol==="https:")?443:80),
                                path: urlInfo.path,
                                agent: getProxyAgent(urlInfo),
                                method: "GET",
                                headers: headers,
                                rejectUnauthorized: false
                            };

                            function handleResult(res) {
                                ASSERT(typeof res === "object");
                                ASSERT(typeof res.statusCode === "number");
                                ASSERT(typeof res.headers === "object");
                                ASSERT(typeof res.on === "function");

                                if (verbose) console.log("get " + res.statusCode + " " + urlInfo.href);

                                if (debug) console.log("res.headers", res.headers);

                                if (existingMeta && res.statusCode === 304) {

                                    existingMeta.status = 304;
                                    
                                    var time = new Date();
                                    FS.utimesSync(metaPath, time, time);
                                    if (verbose) console.log("touched " + metaPath);

                                    if (options.loadBody === false) {
                                        if (verbose) console.log("emit " + existingMeta.status + " " + urlInfo.href);
                                        callback(null, existingMeta);
                                        callback = null;
                                        writeStream.end();
                                        return;
                                    }
                                    return FS.readFile(urlInfo.cachePath, function(err, data) {
                                        if (err) return fail(err);
                                        existingMeta.body = data;
                                        if (verbose) console.log("emit " + existingMeta.status + " " + urlInfo.href);
                                        callback(null, existingMeta);
                                        callback = null;
                                        writeStream.end();
                                        return;
                                    });
                                }

                                meta.status = res.statusCode;
                                meta.headers = res.headers;
                                
                                if (res.statusCode !== 200) {
                                    return writeMeta(function(err) {
                                        if (err) return fail(err);
                                        if (verbose) console.log("emit " + meta.status + " " + urlInfo.href);
                                        callback(null, meta);
                                        callback = null;
                                        writeStream.end();
                                        return;
                                    });
                                }
                                var lastTime = Date.now();
                                var downloadedSize = 0;
                                function reportDownloadProgress(chunk) {
                                    downloadedSize += chunk.length;
                                    if (Date.now() - lastTime > 5000) {
                                        process.stdout.write(downloadedSize + " / " + meta.headers['content-length'] + " (" + Math.floor(downloadedSize/meta.headers['content-length'] * 100) + "%)\n");
                                        lastTime = Date.now();
                                    }
                                }
                                res.on("data", function(chunk) {
                                    // TODO: Nicer download progress.
                                    if (verbose) reportDownloadProgress(chunk);
                                    writeStream.write(chunk, "binary");
                                });
                                res.on("end", function() {
                                    writeStream.end();
                                });
                            }

                            if (typeof options.responder === "function") {

                                if (verbose) console.log("responder GET " + urlInfo.href);

                                options.responder(args, function(err, result) {
                                    if (err) return fail(err);
                                    try {
                                        return handleResult(result);
                                    } catch(err) {
                                        return fail(err);
                                    }
                                });

                            } else {
                                if (verbose) console.log("http GET " + urlInfo.href);
                                if (debug) console.log("GET request options", args);

                                var request = ((urlInfo.protocol==="https:")?HTTPS:HTTP).request(args, handleResult);
                                request.on("error", fail);
                                request.end();
                            }
                        });
                    }

                    return makeRequest(function(err, response) {
                        if (err) return callback(err);
                        return handleResponse(response, callback);
                    });
                }
            });
        }

        if (fetchQueue[urlInfo.cachePath]) {
            if (Array.isArray(fetchQueue[urlInfo.cachePath])) {
                // Not fetched yet.
                fetchQueue[urlInfo.cachePath].push(callback);
            } else {
                // Already fetched.
                return callback(null, fetchQueue[urlInfo.cachePath]);
            }
        } else {
            fetchQueue[urlInfo.cachePath] = [
                callback
            ];
            return fetch(function(err, info) {
                var callbacks = fetchQueue[urlInfo.cachePath] || [];
                delete fetchQueue[urlInfo.cachePath];
                if (err) {
                    callbacks.forEach(function(callback) {
                        return callback(err);
                    });
                    return;
                }
                callbacks.forEach(function(callback) {
                    return callback(null, info);
                });
                return;
            });
        }
    });
}

UrlProxyCache.prototype.parseUrl = function(url, options) {
    options = options || {};
    var urlInfo = URL.parse(url);
    urlInfo.cachePath = options.cachePath || PATH.join(this.path, urlInfo.protocol.replace(/:$/, ""), urlInfo.hostname, urlInfo.path).replace(/\/$/, "+");

    // If the path is too long we hash the last past segment to shorten it.
    if (urlInfo.cachePath.length > 500) {
        var path = urlInfo.cachePath.split("/");
        var hash = CRYPTO.createHash("sha1");
        hash.update(path[path.length-1]);
        path[path.length-1] = hash.digest("hex");
        urlInfo.cachePath = path.join("/");
    }

    return urlInfo;
}


var lastRemovedPath = false;
function ensureParentPathExists(path, options, callback) {
    return FS.exists(PATH.dirname(path), function(exists) {
        if (exists) return callback(null);
        try {
            // TODO: Make async.
            var parts = path.split("/");
            for (var i=2 ; i<parts.length ; i++) {
                if (!FS.existsSync(parts.slice(0, i).join("/"))) {
                    FS.mkdirSync(parts.slice(0, i).join("/"));
                    if (options.chown) {
                        FS.chownSync(parts.slice(0, i).join("/"), options.chown.user, options.chown.group);
                    }
                }
            }
//            FS.mkdirsSync(PATH.dirname(path));
            lastRemovedPath = false;
            return callback(null);
        } catch(err) {
            if (err.code === "ENOTDIR") {
                // We encountered a file along the path hierarchy that needs to be removed before we can create the rest of the dirs.
                // This may happen if a more general URL is requested and then a sub-path subsequently.
                // We assume that the most specific path is the valid one and remove the file in the parent path.
                // TODO: Find a better way to get the path to remove than taking it from the error message.
                var parentPath = path;
                while(true) {
                    if (!FS.existsSync(parentPath)) {
                        if (parentPath === PATH.dirname(parentPath)) {
                            lastRemovedPath = false;
                            return callback(err);
                        }
                        parentPath = PATH.dirname(parentPath);
                    } else
                    if (!FS.statSync(parentPath).isDirectory()) {
                        lastRemovedPath = parentPath;
                        console.log("WARN: Removing file at '" + lastRemovedPath + "' as directory is expected!");                
                        FS.unlinkSync(lastRemovedPath);
                        break;
                    }
                }
                return ensureParentPathExists(path, options, callback);
            }
            lastRemovedPath = false;
            return callback(err);
        }
    });
}


