
const FSWALKER = require("./fswalker");


exports.for = function (API) {


    function indexDirectory (path) {
        var walker = new FSWALKER.Walker(path);
        var opts = {};
        opts.returnIgnoredFiles = false;
        opts.includeDependencies = false;
        opts.respectDistignore = true;
        opts.respectNestedIgnore = true;
        opts.excludeMtime = true;            
        return API.Q.nbind(walker.walk, walker)(opts).then(function (fileinfo) {
            return {
                paths: fileinfo[0],
                summary: fileinfo[1],
                hash: API.CRYPTO.createHash("md5").update(JSON.stringify(fileinfo[0])).digest("hex")
            };
        });
    }

	var exports = {};

	exports.resolve = function (resolver, config, previousResolvedConfig) {
		return resolver({}).then(function (resolvedConfig) {

            return indexDirectory(resolvedConfig.path).then(function (info) {

                resolvedConfig.paths = info.paths;
                resolvedConfig.summary = info.summary;
                resolvedConfig.hash = info.hash;

            }).then(function () {

                resolvedConfig.hashFile = API.PATH.join(API.getTargetPath(), ".pinf.source.hash");

                return resolvedConfig;
            });
		});
	}

	exports.turn = function (resolvedConfig) {
        return API.Q.denodeify(API.FS.outputFile)(resolvedConfig.hashFile, resolvedConfig.hash);
	}


    var previousPaths = {};

	exports.spin = function (resolvedConfig) {

        function triggerIndex () {

            // TODO: Collect all changes and fire earliest plugins.

            var changed = false;

            function hasAnyFileChanged (previous, actual) {
                if (!previous) {
                    return API.Q.resolve(false);
                }
                // TODO: What is the fastest way to compare these?
                if (JSON.stringify(previous) !== JSON.stringify(actual)) {
                    // Something has changed!
                    return API.Q.resolve(true);
                }
                return API.Q.resolve(false);
            }

            function checkFiles (paths) {
                var deferred = Q.defer();
                var count = 0;
                var info = {};
                for (var path in paths) {
                    count++;
                    API.FS.stat(path, function (err, stat) {
                        if (err) return deferred.reject(err);
                        info[path] = {
                            size: stat.size
                        };
                        count--;
                        if (count === 0) {
                            return deferred.resolve(info);
                        }
                    });
                }
                return deferred.promise;
            }

            return API.POLICIFY_getUsedPaths().then(function (paths) {

                // TODO: Be much smarter about how to proactively check some files and others less often.
                var all = [];
                for (var configId in paths) {
                    if (changed) break;
                    all.push(checkFiles(paths[configId]).then(function (paths) {
                        return hasAnyFileChanged(previousPaths[configId], paths).then(function (_changed) {
                            if (_changed) {
                                changed = configId;
                            }
                            previousPaths[configId] = paths;
                        });
                    }));
                }
                return API.Q.all(all);

            }).then(function () {
                if (changed) return;
                return indexDirectory(API.programDescriptor.getBootPackagePath()).then(function (info) {
                    return hasAnyFileChanged(previousPaths[API.getRootPath()], info.paths).then(function (_changed) {
                        if (_changed) {
                            changed = API.getNodeId();
                        }
                        previousPaths[API.getRootPath()] = info.paths;
                    });
                });
            }).then(function () {
                return changed;
            });
        }

        if (resolvedConfig.watch) {

            var currentFiles = JSON.stringify(resolvedConfig.paths);

            setInterval(function () {
                return triggerIndex().then(function (changed) {
                    if (!changed) return;

                    API.emit("request:turn", changed);

                }).fail(function (err) {
                    console.error("Error indexing", err.stack);
                });
            }, 1000);
        }
	}

	return exports;
}

