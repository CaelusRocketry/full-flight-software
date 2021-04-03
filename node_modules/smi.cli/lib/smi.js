
require("require.async")(require);

const ASSERT = require("assert");
const PATH = require("path");
const MFS = require("mfs");
const FS = new MFS.FileFS({
    lineinfo: true	
});
const URL = require("url");
const QUERYSTRING = require("querystring");
const WAITFOR = require("waitfor");
//const REQUEST = require("request");
const EXEC = require("child_process").exec;
const COLORS = require("colors");
const CRYPTO = require("crypto");
const DEEPCOPY = require("deepcopy");
const DEEPMERGE = require("deepmerge");
const SPAWN = require("child_process").spawn;
const DEEPEQUAL = require("deepequal");
const ASYNC = require("async");
const MOMENT = require("moment");
const GLOB = require("glob");
const TOUCH = require("touch");
const DNS = require("dns");
const SMI_CACHE = require("smi.cache");

const PL_PACKAGE = require("org.pinf.lib/lib/package");


COLORS.setTheme({
    error: 'red'
});



var SMI_HOME = process.env.SMI_HOME ||
			  (process.env.HOME && PATH.join(process.env.HOME, ".smi")) ||
			  PATH.join(process.cwd(), ".smi");

var cacheBasePath = null;
var cache = null;

exports.setHome = function (path) {
	SMI_HOME = path;
	if (!FS.existsSync(SMI_HOME)) {
		FS.mkdirsSync(SMI_HOME);
	}
	cacheBasePath = PATH.join(SMI_HOME, "cache");
	if (!FS.existsSync(cacheBasePath)) {
		FS.mkdirsSync(cacheBasePath);
	}
	cache = new SMI_CACHE.UrlProxyCache(cacheBasePath, {
		ttl: 0    // Indefinite by default.
	});
}
exports.setHome(SMI_HOME);


var throttle_waiting = [];
var throttle_running = 0;
function throttle(callback, runner) {
	throttle_waiting.push([callback, runner]);
	if (throttle_waiting.length === 1) {
		(function iterate() {
			if (throttle_waiting.length === 0) return;
			if (throttle_running > 5) {
				//console.log("Waiting before starting additional code path.");
				return;
			}
			throttle_running += 1;
			var task = throttle_waiting.shift();
			return task[1](function() {
				throttle_running -= 1;
				iterate();
				return callback.apply(null, Array.prototype.slice.call(arguments, 0));
			});
		})();
	}
}



function packagesDirectoryForDescriptor(descriptor) {
	var packagesDirectory = "_packages";
	if (
		descriptor &&
		descriptor.config &&
		descriptor.config["smi.cli"] &&
		descriptor.config["smi.cli"].packagesDirectory
	) {
		packagesDirectory = descriptor.config["smi.cli"].packagesDirectory;
	}
	// NOTE: This is proper. We relativize path just before use.
	if (/^\//.test(packagesDirectory)) {
		return PATH.relative(PATH.dirname(descriptor._path), packagesDirectory);
	}
	return packagesDirectory;
}


function binDirectoryForDescriptor(descriptor) {
	var binDirectory = "_packages/.bin";
	if (
		descriptor &&
		descriptor.config &&
		descriptor.config["smi.cli"] &&
		descriptor.config["smi.cli"].binDirectory
	) {
		binDirectory = descriptor.config["smi.cli"].binDirectory;
	}
	return binDirectory;
}


function requestForDescriptor(descriptor, requestOptions, callback, referenceCallback) {
	if (typeof requestOptions === "string") {
		requestOptions = {
			url: requestOptions
		};
	}
	function returnRequest(callback) {

		var cachePath = requestOptions.cachePath || null;
		delete requestOptions.cachePath

		return cache.get(requestOptions.url, {
			loadBody: false,
			headers: requestOptions.headers,
			ttl: requestOptions.ttl || undefined,
			verbose: requestOptions.verbose || false,
			debug: requestOptions.debug || false,
			useExistingOnError: true
		}, function(err, response) {
			if (err) return callback(err);
			if (cachePath) {
				if (!FS.existsSync(PATH.dirname(cachePath))) {
					FS.mkdirsSync(PATH.dirname(cachePath));
				}
				try { FS.unlinkSync(cachePath); } catch(err) {}
				FS.symlinkSync(response.cachePath, cachePath);
				if (requestOptions.linkMeta !== false) {
					try { FS.unlinkSync(cachePath + "~~meta"); } catch(err) {}
					FS.symlinkSync(response.cachePath + "~~meta", cachePath + "~~meta");
				}
			}
			return callback(null, response);
		});
/*
		var req = REQUEST(requestOptions, callback);
		if (referenceCallback) {
			return referenceCallback(req);
		}
*/
	}
	function lookupHostname(hostname, callback) {
		return DNS.resolve4(hostname, function(err, info) {
			if (err) {
                console.error("Warning: Error looking up hostname '" + hostname + "':", err.stack);
                return callback(null, []);
            }
            return callback(null, info);
        });
	}
	if (
		descriptor &&
		descriptor.config &&
		descriptor.config["smi.cli"] &&
		descriptor.config["smi.cli"].proxy
	) {
		var urlParts = URL.parse(requestOptions.url);
		var proxyParts = URL.parse(descriptor.config["smi.cli"].proxy);
		if (urlParts.host === proxyParts.host) {
			return returnRequest(callback);
		}
		// If the DNS hostname resolves we try and load via the proxy.
		return lookupHostname("a.domain.that.will.never.resolve.so.we.can.determine.default.ip.com", function(err, defaultInfo) {
			if (err) return callback(err);
			return lookupHostname(proxyParts.hostname, function(err, info) {
				if (err) return callback(err);
				if (
					info && info.length === 1 &&
					(
						!defaultInfo ||
						(
							defaultInfo.length === 1 &&
							info[0] !== defaultInfo[0]
						)
					)
				) {
					requestOptions.url = 
						proxyParts.protocol + "//" +
						proxyParts.host + "/" +
						requestOptions.url.replace(/^([^:]+):\/\//, "$1/");

					return returnRequest(callback);
				}
				return returnRequest(callback);
			});
		});
	}
	return returnRequest(callback);
}


function onlyBestAspects(aspects, requestedAspectOnly) {
	var best = {};
	for (var name1 in aspects) {
		// Ignore all mappings that start with '@' as these are template commands.
		if (/^@/.test(name1)) {
			continue;
		}
		if (requestedAspectOnly && name1 !== requestedAspectOnly) {
			continue;
		}
		var m1 = name1.match(/^([^\[]+)(:?\[([^\]]+)\])?$/);
		if (m1) {
			// NOTE: Matches are mutually exclusive.
			if (!best[m1[1]]) {
				// We pick the first aspect with matching query.
				for (var name2 in aspects) {
					var m2 = name2.match(/^([^\[]+)\[([^\]]+)\]$/);
					if (m2 && m2[1] === m1[1]) {
						var qs = QUERYSTRING.parse(m2[2]);
						var ok = true;
						for (var key in qs) {
							// TODO: Test against a constructed object instead of `process` directly.
							//       There is other criteria we likely want to check.
							if (process[key] !== qs[key]) {
								ok = false;
							}
						}
						if (ok) {
							best[m1[1]] = aspects[name2];
							break;
						}
					}
				}
				// If no aspects with matching query found we return the default if there is one.
				if (!best[m1[1]] && aspects[m1[1]]) {
					best[m1[1]] = aspects[m1[1]];
				}
			}
		} else {
			if (installOptions.verbose) {
				console.error("Warning: ignoring aspect '" + name1 + "' due to malformed syntax!");
			}
		}
	}
	return best;
}



/**
 * Read a package descriptor and overlay descriptors.
 * Looks for `package.json`, then `package.1.json` and so on until not found.
 * Descriptors will get merged on top of each other using rules declared in descriptor.
 * For now, higher layers get merged on top of lower ones.
 * TODO: Replace with with `pinf.descriptor`.
 */
exports.readDescriptor = function(path, options, callback) {
	if (options.verbose) {
		console.log("[smi] readDescriptor() - path:", path);
	}
/*	
	if (exports.readDescriptor._cache[path]) {
		if (options.verbose) {
			console.log("[smi] readDescriptor() return from cache:", exports.readDescriptor._cache[path]);
		}
		return callback(null, exports.readDescriptor._cache[path]);
	}
*/

	return PL_PACKAGE.fromFile(path, {}, function (err, _descriptor) {
		if (err) return callback(err);

		if (!_descriptor) return callback(null, null);
		var descriptor = Object.create({
			_path: path,
			_raw: DEEPCOPY(_descriptor._data)
		});
		for (var name in _descriptor._data) {
			descriptor[name] = _descriptor._data[name];
		}
		if (options.resolve) {
			return exports.resolveDescriptor(descriptor, options, function (err, descriptor) {
				if (err) return callback(err);
//				exports.readDescriptor._cache[path] = descriptor;
				return callback(null, descriptor);
			});
		}
//		exports.readDescriptor._cache[path] = descriptor;
		return callback(null, descriptor);
	});
}
//exports.readDescriptor._cache = {};


exports.resolveDescriptor = function(descriptor, options, done) {
	if (!descriptor) {
		return done(null, null);
	}
	if (options.verbose) {
		console.log("[smi] resolveDescriptor() - descriptor:", descriptor);
	}
	var basePath = options.basePath;
	var previousSummary = options.previousSummary;
	var descriptorPath = descriptor._path;
	var repeatEnsureAfterInstall = descriptor._repeatEnsureAfterInstall || false;
	var _descriptor = DEEPCOPY(descriptor);
	var descriptor = Object.create({
		_path: descriptorPath,
		_repeatEnsureAfterInstall: repeatEnsureAfterInstall
	});
	for (var name in _descriptor) {
		descriptor[name] = _descriptor[name];
	}


	function mountRelativeLocations () {
		if (!options.mountRelativeLocationsTo) {
			return;
		}
		// TODO: Do this much more elegantly based on schema.
		var packages = JSON.stringify(descriptor.packages);
		packages = packages.replace(/("location":\s*")\.(\/)/, "$1" + options.mountRelativeLocationsTo + "$2");
		descriptor.packages = JSON.parse(packages);
	}

	mountRelativeLocations();

/*
	function resolveVariables () {
		var configString = JSON.stringify(descriptor);
		configString = configString.replace(/\{\{__FILENAME__\}\}/g, descriptorPath);
		configString = configString.replace(/\{\{__DIRNAME__\}\}/g, PATH.dirname(descriptorPath));
		descriptor = JSON.parse(configString);
	}

	resolveVariables();
*/
/*
	// TODO: Use commmon implementation from 'org.pinf.genesis.lib'.
	function resolveTranslocations (callback) {
		if (!descriptor.mappings) return callback(null);

		function resolveEnvironmentVariables (str) {
			var vars = {};
	        var re = /\{\{env\.([^\}]+)\}\}/g;
	        var m = null;
	        while (m = re.exec(str)) {
	        	if (typeof process.env[m[1]] !== "undefined") {
					str = str.replace(new RegExp(ESCAPE_REGEXP_COMPONENT(m[0]), "g"), process.env[m[1]]);
				}
	        }
	        return str;
		}

		// TODO: Make this more generic.
		var uri = descriptor.mappings['@translocate'] || null;
		if (!uri) return callback(null);
		var optional = /^!/.test(uri);
		if (optional) uri = uri.substring(1);
		uri = resolveEnvironmentVariables(uri);
		if (!/\//.test(uri)) {
			return callback(new Error("Translocation uri '" + uri + "' not supported."));
		}
		return FS.exists(uri, function (exists) {
			if (!exists) {
				if (optional) {
					return callback(null);
				}
				return callback(new Error("Translocation uri '" + uri + "' not found! To ignore missing file use '@translocate: !<path>'"));
			}
			return exports.readDescriptor(uri, options, function (err, _descriptor) {
				if (err) return callback(err);
				// This is always optional. i.e. we fail silently if nothing is found.
				if (_descriptor.mappings) {
					// NOTE: The external descriptor always overrides our values!
					// TODO: Make this positional based on line in file.
					descriptor.mappings = DEEPMERGE(descriptor.mappings, _descriptor.mappings);
				}
				return callback(null);
			});
		});
	}

	return resolveTranslocations(function (err) {
		if (err) return done(err);
*/
		function expandDynamicAspects () {
			var packages = descriptor.packages;
			descriptor.packages = {};
			for (var alias in packages) {
				if (/\$aspect/.test(alias)) {
					if (!packages[alias].aspects) {
						throw new Error("'aspects' property must be set for '" + alias + "' as it contains an '$aspect' variable");
					}
					for (var aspect in packages[alias].aspects) {
						descriptor.packages[alias.replace(/\$aspect/g, aspect)] = packages[alias].aspects[aspect];
					}
				} else {
					descriptor.packages[alias] = packages[alias];
				}
			}
		}

		expandDynamicAspects();


		var callback = function(err, descriptor) {
			if (err) return done(err);
			var _desc = Object.create({
				_path: descriptorPath,
				// NOTE: This is a hack until we have a better resolution + installation flow where we can
				//       resolve and install incrementally.
				_repeatEnsureAfterInstall: repeatEnsureAfterInstall
			});
			for (var name in descriptor) {
				if (descriptor.hasOwnProperty(name)) {
					_desc[name] = descriptor[name];
				}
			}
			return done(null, _desc);
		}

		function resolveLocators(descriptor, type, locators, mergeHandler, callback) {
			if (options.verbose) {
				console.log("[smi] resolveLocators() - locators:", locators);
			}
			var waitfor = WAITFOR.serial(function(err) {
				if (err) return callback(err);
				return callback(null, descriptor);
			});

			var protoBasename = PATH.basename(descriptorPath).replace(/\.json$/, "");

			function read(path, callback) {
				return exports.readDescriptor(path, options, function(err, _descriptor) {
					if (err) return callback(err);
					mergeHandler(descriptor, _descriptor);
					return callback(null, path);
				});
			}
			if (!locators || typeof locators.forEach !== "function") {
				console.log("resolveLocators()");
				console.log("descriptor", descriptor);
				console.log("type", type);
				console.log("locators", locators);
				return callback(new Error("No 'locators'!"));
			}
			locators.forEach(function(locator, i) {
				return waitfor(function(done) {
					var callback = function(err, path) {
						if (err) return done(err);
						if (path) {
							if (!options.silent) {
								process.stdout.write(("[smi] use DESCRIPTOR".bold + " " + path).cyan + "\n");
							}
						}
						return done(null, descriptor);
					}
					locator = locator.replace(/(\/)\*(\.proto\.json)$/, "$1" + protoBasename + "$2");

					// TODO: Do this generically for all declared environment variables.
					if (locator === "{{env.PIO_PROFILE_PATH}}") {
						if (!process.env.PIO_PROFILE_PATH) {
							if (!options.ignoreMissingExtends) {
								if (options.verbose) {
									console.log("Warning: 'PIO_PROFILE_PATH' environment variable not set even though it is used in config!");
								}
							}
							return callback(null);
						} else {
							locator = ("" + process.env.PIO_PROFILE_PATH).replace(/\\\s/g, " ");
						}
					}

					if (/^\./.test(locator)) {
						var path = PATH.join(descriptorPath, "..", locator);
						return FS.exists(path, function(exists) {
							if (!exists) {
								return callback(new Error("Extends path '" + path + "' does not exist!"));
							}
							return read(path, callback);
						});
					} else
					if (/^\//.test(locator)) {
						var path = locator;
						return FS.exists(path, function(exists) {
							if (!exists) {
								if (options.ignoreMissingExtends) {
									if (options.debug) {
										console.log("Ignore: Extends path '" + path + "' does not exist! Due to 'options.ignoreMissingExtends'");
									}
									return callback(null);
								}
								return callback(new Error("Extends path '" + path + "' does not exist!"));
							}
							return read(path, callback);
						});
					} else {
						var hash = CRYPTO.createHash("sha1");
					    hash.update(locator);
						var extendsPath = descriptorPath + "~" + type + "~" + hash.digest("hex").substring(0, 7);
						if (options.debug) console.log("extendsPath", extendsPath);
						// TODO: Issue GET with etag after cache expiry?
						return FS.exists(extendsPath, function(exists) {
							if (options.debug) console.log("extendsPath exists", extendsPath, exists);
							if (exists) {
								return read(extendsPath, callback);
							}
							try {
								// Remove symlink if it points nowhere.
								FS.unlinkSync(extendsPath);
							} catch(err) {}
							function checkIfPackageSymlink(callback) {
								var locatorParts = locator.split("/");
								if (!descriptor.mappings || !descriptor.mappings[locatorParts[0]]) {
									if (options.debug) console.log("no mapping for alias", locatorParts[0]);
									return callback(null, false);
								}
								var packagePath = PATH.join(basePath, packagesDirectoryForDescriptor(descriptor), locatorParts[0]);
								if (previousSummary && previousSummary[locatorParts[0]]) {
									packagePath = PATH.join(basePath, previousSummary[locatorParts[0]].installedPath);
								}
								return FS.exists(packagePath, function(exists) {
									if (options.debug) console.log("packagePath exists", packagePath, exists);
									if (!exists) {
										// NOTE: We assume we have a fully resolved locator here.
										// TODO: Layer the resolving and installation steps better so we can run the whole
										//       process repeatedly until everything is resolved and installed. To do this
										//       we need to keep track of which aspects have been resolved.
										repeatEnsureAfterInstall = locatorParts[0];
										return callback(null, null);
									}
									var path = PATH.join(packagePath, locatorParts.slice(1).join("/"));
									return FS.exists(path, function(exists) {
										if (options.debug) console.log("path exists", path, exists);
										if (!exists) {
											return callback(new Error("Resolved " + type + " locator '" + locator + "' not found at '" + path + "'!"));
										}
										if (options.verbose) {
											console.log(("Linking (resolveDescriptor) '" + path + "' to '" + extendsPath + "'.").magenta);
										}
										return FS.symlink(PATH.relative(PATH.dirname(extendsPath), path), extendsPath, function(err) {
											if (err) return callback(err);
											return callback(null, extendsPath);
										});
									});
								});
							}

							return checkIfPackageSymlink(function(err, symlinked) {
								if (err) return callback(err);
								if (symlinked === null) return callback(null);
								if (symlinked) {
									return read(extendsPath, callback);
								}
								if (options.debug) console.log("locator", locator);
								var urlParts = URL.parse(locator);
								if (options.debug) console.log("urlParts", urlParts);
								if (!urlParts.hostname) {
									return callback(new Error("Locator '" + locator + "' could not be fetched as it is not a URL. Make sure the alias '" + urlParts[0] + "' is mapped to a URL using the 'mappings' property!"));
								}
								if (!options.silent) {
									process.stdout.write(("[smi] get DESCRIPTOR".bold + " " + urlParts.hostname + " // " + PATH.basename(urlParts.pathname)).cyan + "\n");
								}
								if (options.debug) {
									console.log(("Downloading '" + locator + "' to '" + extendsPath + "'.").magenta);
								}
				                return requestForDescriptor(descriptor, {
				                    url: locator,
				                    ttl: 15 * 1000,	// Don't re-check for 15 seconds.
				                    verbose: true || options.verbose,
				                    debug: options.debug,
				                    cachePath: extendsPath
				                }, function(err, response, body) {
				                    if (err) return callback(err);
				                    if (response.statusCode !== 200 && response.status !== 304) {
				                    	return callback(new Error("Did not get statue 200 nor 304 when downloading '" + locator + "'!"));
				                    }
	/*
				                    try {
				                        JSON.parse(body);
				                    } catch(err) {
				                    	console.error("body", body);
				                        console.error("Error parsing JSON!");
				                        return callback(err);
				                    }
	*/
	//			                    return FS.outputFile(extendsPath, body, function(err) {
	//			                    	if (err) return callback(err);
										return read(extendsPath, callback);
	//			                    });
				                });
			                });
						});
					}
				});
			});
			return waitfor();
		}

		// TODO: Deprecate 'descriptor.config["smi.cli"].descriptorPath' and use 'extends' instead.
		if (
			descriptor &&
			descriptor.config &&
			descriptor.config["smi.cli"] &&
			descriptor.config["smi.cli"].descriptorPath
		) {
			if (descriptorPath === PATH.join(descriptorPath, "..", descriptor.config["smi.cli"].descriptorPath)) {
				return callback(null, descriptor);
			}
			return exports.readDescriptor(PATH.join(descriptorPath, "..", descriptor.config["smi.cli"].descriptorPath), options, function(err, _descriptor) {
				if (err) return callback(err);
				delete descriptor.config["smi.cli"].descriptorPath;
				for (var name in _descriptor) {
					if (typeof _descriptor[name] === "object") {
						descriptor[name] = DEEPMERGE(descriptor[name] || {}, _descriptor[name]);
					} else {
						descriptor[name] = DEEPCOPY(_descriptor[name]);
					}
				}
				return callback(null, descriptor);
			});
		} else {

			return callback(null, descriptor);


/*
			var waitfor = WAITFOR.serial(function(err) {
				if (err) return callback(err);
				return callback(null, descriptor);
			});

			var extendsInfo = null;
			if (descriptor) {
				extendsInfo = descriptor.extends || descriptor["@extends"];
			}
			if (extendsInfo) {
				waitfor(function(done) {
					var locators = extendsInfo;
					if (!Array.isArray(locators)) {
						locators = [];
						for (var name in extendsInfo) {
							locators.push(extendsInfo[name]);
						}
					}
					locators.reverse();
					delete descriptor.extends;
					delete descriptor["@extends"];
					return resolveLocators(descriptor, "extends", locators, function(ourDescriptor, externalDescriptor) {
						for (var name in externalDescriptor) {
							if (externalDescriptor.hasOwnProperty(name)) {
								if (ourDescriptor[name]) {
									ourDescriptor[name] = DEEPMERGE(externalDescriptor[name], ourDescriptor[name]);
								} else {
									ourDescriptor[name] = externalDescriptor[name];
								}
							}
						}
					}, done);
				});
			}
			if (
				descriptor &&
				descriptor.overrides &&
				Array.isArray(descriptor.overrides)
			) {
				console.error("DEPRECATED: Rename 'overrides' to 'overlays' in '" + descriptorPath + "'!");
				descriptor.overlays = descriptor.overrides;
			}
			if (
				descriptor &&
				descriptor.overlays &&
				Array.isArray(descriptor.overlays)
			) {
				waitfor(function(done) {
					var locators = descriptor.overlays;
					delete descriptor.overlays;
					return resolveLocators(descriptor, "overlays", locators, function(ourDescriptor, externalDescriptor) {
						for (var name in externalDescriptor) {
							if (externalDescriptor.hasOwnProperty(name)) {

	//console.log("merge ", externalDescriptor, "on top of", ourDescriptor);

								if (ourDescriptor[name]) {
									ourDescriptor[name] = DEEPMERGE(ourDescriptor[name], externalDescriptor[name]);
								} else {
									ourDescriptor[name] = externalDescriptor[name];
								}
							}
						}
					}, done);
				});
			}
			return waitfor();
*/
		}
//	});		
}

exports.locateUpstreamPackages = function(snapshotDescriptor, options, callback) {
	if (typeof options === "function" && typeof callback === "undefined") {
		callback = options;
		options = null;
	}
	options = options || {};
	if (options.debug) {
		console.log("[smi] locateUpstreamPackages()");
	}
	if (!snapshotDescriptor._path) {
		return callback(new Error("'snapshotDescriptor._path' not set!"));
	}
	var waitfor = WAITFOR[options.debug ? "serial":"parallel"](function(err) {
		if (err) return callback(err);
		return callback(null, packages);
	});
	var packages = {};
	function locatePackage(groupId, locator, callback) {
		var basePath = options.basePath || PATH.dirname(snapshotDescriptor._path);
		function _abspath() {
			if (/^\//.test(arguments[0])) {
				return PATH.join.apply(null, Array.prototype.slice.apply(arguments));
			}
			return PATH.join.apply(null, [basePath].concat(Array.prototype.slice.apply(arguments)));
		}

		if (typeof locator === "string") {
			locator = {
				location: locator
			};
		}

		// Resolve locator based on path of declaring descriptor.
		// TODO: This should already be resolved before we get here.
		if (!/^\//.test(locator.location)) {
			locator.location = PATH.join(PATH.dirname(snapshotDescriptor._path), locator.location);
			locator.location = PATH.relative(basePath, locator.location);
		}

		return GLOB(locator.location, {
			cwd: basePath
		}, function (err, paths) {
			if (err) return callback(err);
			var waitfor = WAITFOR[options.debug ? "serial":"parallel"](callback);
			paths.forEach(function(path) {
				var id = groupId + "/" + PATH.basename(path);
				if (!packages[_abspath(path)]) {
					return waitfor(function(callback) {

						return exports.readDescriptor(PATH.join(path, "package.json"), {
								basePath: basePath,
								previousSummary: options.previousSummary,
								resolve: true
							}, function(err, descriptor) {
							if (err) return callback(err);

							// TODO: Control this via pluggable meta data derived from package descriptor.

							var aspects = {};

							if (locator.aspect) {

								aspects[locator.aspect] = path;

							} else {

								if (
									descriptor &&
									descriptor.config &&
									descriptor.config["pio.service"] &&
									descriptor.config["pio.service"].aspects
								) {
									aspects = DEEPCOPY(descriptor.config["pio.service"].aspects);
								}

								var aspectDirectories = {
									scripts: "scripts",
									source: "source"
								};
								if (
									descriptor &&
									descriptor.config &&
									descriptor.config["pio.deploy.converter"]
								) {
									if (descriptor.config["pio.deploy.converter"].name === "nodejs-lib") {
										aspectDirectories.scripts = null;
										aspectDirectories.source = ".";
									} else
									if (descriptor.config["pio.deploy.converter"].name === "nodejs-server") {
										aspectDirectories.scripts = "scripts.pio";
										aspectDirectories.source = ".";
									} else
									if (descriptor.config["pio.deploy.converter"].name === "scripts-only") {
										aspectDirectories.scripts = ".";
										aspectDirectories.source = ".";
									} else {
										aspectDirectories.scripts = "scripts";
										aspectDirectories.source = "source";
									}
									if (descriptor.config["pio.deploy.converter"].scriptsPath) {
										aspectDirectories.scripts = descriptor.config["pio.deploy.converter"].scriptsPath;
									}
									if (descriptor.config["pio.deploy.converter"].sourcePath) {
										aspectDirectories.source = descriptor.config["pio.deploy.converter"].sourcePath;
									}
								}
								function completeAspect(name, changes) {
									if (!aspects[name]) {
										aspects[name] = {}
									}
									function applyChanges(aspect) {
										for (var key in changes) {
											aspect[key] = (typeof aspect[key] !== "undefined") ? aspect[key] : changes[key];
										}
									}
									applyChanges(aspects[name]);
									for (var _name in aspects) {
										var m = _name.match(/^([^\[]+)\[/);
										if (m && m[1] === name) {
											applyChanges(aspects[_name]);
										}
									}
								}
								for (var aspect in aspectDirectories) {
									if (aspectDirectories[aspect]) {	// guard against `null` which should not be recorded.
										completeAspect(aspect, {
											basePath: PATH.join(path, aspectDirectories[aspect])
										});
									}
								}
							}

							var packageInfo = {
								basePath: path,
								aspects: aspects,
								aspect: locator.aspect || null
							};

							if (!packages[_abspath(path)]) {
								packages[_abspath(path)] = packageInfo;
							}
							// TODO: Also record package at realpath of `_abspath(id)`.
							if (!packages[id]) {
								packages[id] = packageInfo;
							}
							var idParts = id.split("/");
							if (!packages[idParts[idParts.length-1]]) {
								packages[idParts[idParts.length-1]] = packageInfo;
							}

							// Match packages we are still extracting.
							// TODO: This should ideally not be needed.
							var m = idParts[idParts.length-1].match(/^([^\/]+?)-[a-zA-Z0-9]{7}(~extracted)?$/);
							if (m) {
								if (!packages[idParts.slice(0, idParts.length-1).concat(m[1]).join("/")]) {
									packages[idParts.slice(0, idParts.length-1).concat(m[1]).join("/")] = packageInfo;
								}
								if (!packages[m[1]]) {
									packages[m[1]] = packageInfo;
								}
							}

							return callback(null);
						});
					});
				}
			});
			return waitfor();
		});
	}
	// TODO: Make these configurable based on schema for `snapshotDescriptor`.
	[
		"upstream"
	].forEach(function(property) {
		if (!snapshotDescriptor[property]) return;		
		if (snapshotDescriptor[property].packages) {
			for (var id in snapshotDescriptor[property].packages) {
				if (Array.isArray(snapshotDescriptor[property].packages[id])) {
					snapshotDescriptor[property].packages[id].forEach(function(locator) {
						waitfor(id, locator, locatePackage);
					});
				} else {
					waitfor(id, snapshotDescriptor[property].packages[id], locatePackage);
				}
			}
		}
	});
	return waitfor();
}

function debugFS () {
	if (debugFS.debugging) return;
	debugFS.debugging = true;
	FS.on("used-path", function(path, method, meta) {
		console.log(("FS." + method).yellow.bold, path, ((meta)?("(" + meta.file + " @ " + meta.line + ")"):""));
	});
}

exports.install = function (basePath, snapshotDescriptor, installOptions, callback) {
	if (installOptions.debug) {
		debugFS();
	}

	if (installOptions.verbose) {
		console.log("[smi] version: " + FS.readJsonSync(PATH.join(__dirname, "../package.json")).version + "; codebase: " + PATH.join(__dirname));
	}

	if (typeof installOptions === "function" && typeof callback === "undefined") {
		callback = installOptions;
		installOptions = null;
	}
	installOptions = installOptions || {};

	ASSERT.equal(typeof basePath, "string");

	var previousSummary = null;

	function ensureDescriptor(callback) {
		if (typeof snapshotDescriptor === "object") {
			return exports.resolveDescriptor(snapshotDescriptor, {
				basePath: basePath,
				previousSummary: previousSummary,
				verbose: installOptions.verbose || false,
				debug: installOptions.debug || false,
				silent: installOptions.silent || false
			}, callback);
		}
		return exports.readDescriptor(snapshotDescriptor, {
			basePath: basePath,
			previousSummary: previousSummary,
			resolve: true,
			verbose: installOptions.verbose || false,
			debug: installOptions.debug || false,
			silent: installOptions.silent || false
		}, callback);
	}

	function _abspath() {
		if (/^\//.test(arguments[0])) {
			try {
				return PATH.join.apply(null, Array.prototype.slice.apply(arguments));
			} catch(err) {
				console.log("args", Array.prototype.slice.apply(arguments));
				throw err;
			}
		}
		try {
			return PATH.join.apply(null, [basePath].concat(Array.prototype.slice.apply(arguments)));
		} catch(err) {
			console.log("args", [basePath].concat(Array.prototype.slice.apply(arguments)));
			throw err;
		}
	}

	function prepare(callback) {

		if (installOptions.debug) {
			console.log("[smi] prepare()");
		}

		return ensureDescriptor(function(err, snapshotDescriptor) {
			if (err) return callback(err);

			ASSERT.equal(typeof snapshotDescriptor, "object");
			ASSERT.equal(typeof snapshotDescriptor._path, "string");

			var catalogs = {};
			var summary = {};
			var packages = {};

			var packagesDirectory = packagesDirectoryForDescriptor(snapshotDescriptor);

			function ensure(callback) {

				if (installOptions.verbose) {
					console.log("[smi] ensure".cyan);
				}

				function ensureCatalogs(callback) {

					if (installOptions.debug) {
						console.log("[smi] ensureCatalogs()");
					}

					return exports.locateUpstreamPackages(snapshotDescriptor, {
						basePath: basePath,
						previousSummary: previousSummary,
						verbose: installOptions.verbose || false,
						debug: installOptions.debug || false,
						silent: installOptions.silent || false						
					}, function(err, _packages) {
						if (err) return callback(err);
						packages = _packages;

						var waitfor = WAITFOR[installOptions.debug ? "serial":"parallel"](function (err) {
							if (err) return callback(err);
							if (!installOptions.silent) {
								for (var alias in catalogs) {
									process.stdout.write(("[smi] use CATALOG".bold + " " + alias + " <- " + catalogs[alias].uuid + " @ " + catalogs[alias].revision).cyan + "\n");
								}
							}
							return callback(null);
						});
						// TODO: Make these configurable based on schema for `snapshotDescriptor`.
						[
							"upstream"
						].forEach(function(property) {
							if (!snapshotDescriptor[property]) return;
							if (snapshotDescriptor[property].catalogs) {
								for (var id in snapshotDescriptor[property].catalogs) {
									waitfor(id, snapshotDescriptor[property].catalogs[id], ensureUpstreamCatalog);
								}
							}
						});
						return waitfor();
					});
				}

				function ensurePackages(callback) {
					var pluginsById = {};
					var packages = [];
					// TODO: Make these configurable based on schema for `snapshotDescriptor`.
					[
						"mappings"
					].forEach(function(property) {
						if (!snapshotDescriptor[property]) return;
						var mappings = onlyBestAspects(snapshotDescriptor[property]);
						for (var id in mappings) {
							var locator = mappings[id];
							if (typeof locator === "string") {
								locator = {
									"location": locator
								};
							}
							pluginsById[id] = {
								provides: [ id ],
								consumes: mappings[id].depends || [],
								id: id,
								locator: locator,
							};
							packages.push(JSON.parse(JSON.stringify(pluginsById[id])));
						}
					});
// TODO: Run these in parallel once we have higher resolution into the depends hierarchy.
//       Once all dependent packages are ensured we can proceed ensuring packages in parallel.
//					var waitfor = WAITFOR[installOptions.debug ? "serial":"parallel"](callback);
					var waitfor = WAITFOR.serial(callback);
					var orderedPackages = orderPackages(packages, true);

					if (installOptions.dryrun === "deps") {

				        function showChildHierarchy (pkgId, pkg, level) {
				            if (!level) level = 0;
				            if (!pkg) {
				                console.log("Package '" + pkgId + "' not found!");
				                return;
				            }
				            var prefix = [];
				            for (var i=0 ; i<level ; i++) {
				                prefix.push("  ");
				            }
				            console.log(prefix.join("") + pkg.id);

				            if (!pkg.consumes) return;
				            pkg.consumes.forEach(function (pkgId) {
				                return showChildHierarchy(pkgId, pluginsById[pkgId], level + 1);
				            });
				        }
				        console.log("Service hierarchy:");
						orderedPackages.forEach(function(_package, i) {
				            showChildHierarchy(_package.id, pluginsById[_package.id]);
				        });

						return callback();						
					}

					if (installOptions.verbose) {
						console.log("[smi] Installing packages based on '" + snapshotDescriptor._path + "': " + JSON.stringify(orderedPackages.map(function(pkg) {
							return pkg.id;
						}), null, 4));
					}

					orderedPackages.forEach(function(_package, i) {
						waitfor(_package.id, _package.locator, ensurePackage);
					});
					return waitfor();
				}

				return ASYNC.series([
					ensureCatalogs,
					ensurePackages
				], callback);
			}

			function ensureUpstreamCatalog(id, locator, callback) {

				return throttle(callback, function(callback) {

					var targetPath = null;
					// `./dependencies/smi`
					if (/^\./.test(id)) {
						targetPath = PATH.join(basePath, id);
					} else {
						// TODO: Make default directory configurable.
						targetPath = PATH.join(basePath, "./" + packagesDirectory + "/" + id + ".catalog.json");
					}

					if (typeof locator === "string") {
						locator = {
							uri: locator
						};
					}

					if (installOptions.verbose) {
						console.log(("Ensure upstream catalog: " + id).cyan);
					}

					function ensure(callback, verify) {

						function download(meta, callback) {
			                if (/^\./.test(locator.uri)) {
			                	function etagForPath(path, callback) {
				                	return FS.readFile(path, function(err, data) {
				                		if (err) return callback(err);
										var etag = CRYPTO.createHash("md5");
									    etag.update(data);
									    return callback(null, etag.digest("hex"));
					                });
			                	}
			                	var fromPath = PATH.join(snapshotDescriptor._path, "..", locator.uri);
			                	return etagForPath(fromPath, function(err, etag) {
			                		if (err) return callback(err);
				                	if (meta && meta.etag && meta.etag === etag) {
				                		if (installOptions.verbose) {
					                		console.log(("Catalog '" + id + "' not changed based on etag!").yellow);
					                	}
				                		return FS.readJson(targetPath, function (err, data) {
				                			if (err) return callback(err);
				                			return callback(null, data, fromPath);
				                		});
				                	}
					                if (verify) {
					                    return callback(new Error("No catalog descriptor found at '" + targetPath + "' after download!"));
					                }
					                if (installOptions.debug) {
						                console.log(("Copy catalog for upstream alias '" + id + "' from '" + locator.uri + "'").magenta);
						            }
					                return FS.copy(fromPath, targetPath, function(err) {
					                	if (err) return callback(err);
					                	return etagForPath(targetPath, function(err, etag) {
					                		if (err) return callback(err);
						                	return FS.outputFile(targetPath + "~~meta", JSON.stringify({
						                		etag: etag
						                	}, null, 4), function(err) {
						                		if (err) return catalog(err);
							                	return ensure(callback, true);
						                	});
					                	});
					                });
			                	});
			                } else
			                if (/^https?:\/\//.test(locator.uri)) {

			                	// TODO: Check if expired and only then send request with etag unless force is set to true.
			                	var force = false;
			                	/*
			                	if (!force && meta && meta.mtime && meta.mtime >= (Date.now()-15*1000)) {
			                		if (!verify) {
			                			if (installOptions.verbose) {
					                		console.log(("Catalog '" + id + "' not changed based on mtime less than 15 sec old!").yellow);
					                	}
				                	}
			                		return FS.readJson(targetPath, callback);
			                	}
			                	*/
								if (!installOptions.silent) {
									var urlParts = URL.parse(locator.uri);
									process.stdout.write(("[smi] get CATALOG".bold + " " + urlParts.hostname + " // " + PATH.basename(urlParts.pathname)).cyan + "\n");
								}
			                	if (installOptions.verbose) {
					                console.log(("Download catalog for upstream alias '" + id + "' from '" + locator.uri + "'").magenta);
					            }
								var headers = locator.headers || {};
								headers["etag"] = headers["etag"] || (meta && meta.etag) || "";
								headers["User-Agent"] = headers["User-Agent"] || "smi";
				                return requestForDescriptor(snapshotDescriptor, {
				                    url: locator.uri,
				                    headers: headers,
				                    ttl: 15 * 1000,	// Don't re-check for 15 seconds.
				                    cachePath: targetPath,
				                    verbose: installOptions.verbose,
				                    debug: installOptions.debug
				                }, function(err, response) {
				                    if (err) return callback(err);
				                    /*
				                    if (response.statusCode === 304) {
				                		console.log(("Catalog '" + id + "' not changed based on etag!").yellow);
				                		return TOUCH(targetPath + "~meta", function(err) {
				                			if (err) return callback(err);
					                		return FS.readJson(targetPath, callback);
				                		});
				                    }
				                    */
				                    /*
				                	return FS.outputFile(targetPath + "~meta", JSON.stringify({
				                		etag: response.headers.etag || null,
				                		expires: (response.headers.expires && MOMENT(response.headers.expires).unix()) || null,
				                	}, null, 4), function(err) {
				                		if (err) return catalog(err);
					                	return ensure(callback, true);
				                	});
									*/
									return FS.readJson(targetPath, function (err, data) {
			                			if (err) return callback(err);
			                			return callback(null, data, locator.uri);
			                		});
				                });
				            }
				            return callback(new Error("Cannot determine how to download '" + locator.uri + "'!"));
						}

						return FS.exists(targetPath, function(exists) {
							if (exists) {
								return FS.stat(targetPath + "~~meta", function(err, stat) {
									if (err) return callback(err);
									return FS.readJson(targetPath + "~~meta", function(err, meta) {
										if (err) return callback(err);
										meta.mtime = stat.mtime.getTime()
						                return download(meta, callback);
									});
								});
							}
			                return download(null, callback);
			            });
					}

					return ensure(function(err, catalog, catalogLocation) {
						if (err) return callback(err);
						return exports.resolveDescriptor(catalog, {
		                    verbose: installOptions.verbose,
		                    debug: installOptions.debug,
							basePath: basePath,
							previousSummary: previousSummary,
							mountRelativeLocationsTo: catalogLocation.replace(/\/[^\/]+$/, "")
						}, function(err, catalog) {
							if (err) return callback(err);
							catalogs[id] = catalog;
							return callback(null);
						});
					});
				});
			}

			var downloads = {};
			var extracts = {};

			function ensurePackage(id, packageLocator, callback) {

				if (installOptions.debug) {
					console.log("[smi] schedule ensurePackage(" + id + ", " + JSON.stringify(packageLocator) + ")");
				}

				if (snapshotDescriptor._repeatEnsureAfterInstall && id !== snapshotDescriptor._repeatEnsureAfterInstall) {

					if (installOptions.debug) {
						console.log("[smi] return as found in repeat after install");
					}
					return callback(null);
				}

				return throttle(callback, function(callback) {

					if (installOptions.debug) {
						console.log("[smi] run ensurePackage(" + id + ", " + JSON.stringify(packageLocator) + ")");
					}

					try {

						var targetPath = null;
						// `./dependencies/smi`
						if (/^\./.test(id)) {
							targetPath = id;
						} else
						if (/^\//.test(id)) {
							targetPath = id;
						} else {
							targetPath = "./" + packagesDirectory + "/" + id;
						}

						var locatorFilename = ".smi.json";

						// TODO: Use pinf locator resolution logic.
						function resolveLocator (locator, depth) {
							if (installOptions.verbose) {
								console.log("resolveLocator()", locator, new Error().stack.split("\n").slice(0,3));
							}
							depth = depth || 0;
							if (depth > 5) {
								console.log("packages", packages);
								throw new Error("Error resolving locator: " + JSON.stringify(locator));
							}
							if (typeof locator === "string") {
								throw new Error("Set 'locator' on object instead of string!");
							}

							if (locator.location) {
								var locatorIdParts = locator.location.split("/");
								// NOTE: Looking for packages in catalogs MUST happen FIRST.
								//       BUT if we lookup first we will not find sources to link later.
								// TODO: Fix this in next version of `smi`.
								if (
									catalogs[locatorIdParts[0]] &&
									catalogs[locatorIdParts[0]].packages &&
									catalogs[locatorIdParts[0]].packages[locatorIdParts[1]]
								) {
									if (installOptions.verbose) {
										console.log(("Found package '" + locatorIdParts[1] + "' in catalog '" + locatorIdParts[0] + "'!").cyan);
									}
									var _locator = catalogs[locatorIdParts[0]].packages[locatorIdParts[1]];
									if (typeof _locator === "string") {
										_locator = {
											location: _locator
										};
									}
									_locator.install = locator.install;
									locator = _locator;
								} else
								if (packages[locator.location]) {
									if (installOptions.verbose) {
										console.log(("Found package '" + locator.location + "' in upstream packages!").cyan);
									}
									if (packages[locator.location].aspect) {
										_locator = {
											location: packages[locator.location].basePath
										};
										_locator.aspects = {};
										_locator.aspects[packages[locator.location].aspect] = {
											location: packages[locator.location].aspects[packages[locator.location].aspect]
										};
										locator = _locator;
									} else
									// TODO: This needs to be done much better.
									if (packages[locator.location].aspects) {
										if (
											Object.keys(packages[locator.location].aspects).length === 1 &&
											packages[locator.location].aspects.source &&
											packages[locator.location].aspects.source.basePath === packages[locator.location].basePath
										) {
											locator = {
												location: packages[locator.location].basePath,
												aspects: {
													source: {
														location: packages[locator.location].basePath
													}
												}
											};
										} else
										if (packages[locator.location].aspects.install) {
											locator = resolveLocator({
												location: packages[locator.location].aspects.install.basePath
											}, depth + 1);
										} else {
											var originalLocation = locator.location;
											locator = resolveLocator({
												location: packages[locator.location].basePath
											}, depth + 1);
											locator.aspects = {};
											for (var name in packages[originalLocation].aspects) {
												if (
													packages[originalLocation].aspects[name].basePath !== packages[originalLocation].basePath &&
													/^\./.test(packages[originalLocation].aspects[name].basePath)
												) {
													locator.aspects[name] = {
														location: packages[originalLocation].aspects[name].basePath
													};
												}
											}
											if (Object.keys(locator.aspects).length === 0) delete locator.aspects;
										}
									} else {
										locator = resolveLocator({
											location: packages[locator.location].basePath
										}, depth + 1);
									}
								} else								
								if (/^git@/.test(locator.location)) {
									if (installOptions.verbose) {
										console.log(("Will clone package '" + locator.location + "'!").cyan);
									}
								} else
								if (locatorIdParts.length === 2 && !/^\./.test(locator.location)) {
									// We seem to want to map a package in a catalog but the catalog is not declared.
									if (installOptions.verbose) {
										console.log("packages", packages);
									}
									if (locator.install === false) {
										return null;
									}
									throw new Error("Catalog '" + locatorIdParts[0] + "' not declared. Used by locator '" + JSON.stringify(locator) + "' for id '" + id + "'!");
								}
							}
							return locator;
						}
						var resolvedLocator = resolveLocator(packageLocator);

						if (!resolvedLocator) {
							if (installOptions.verbose) {
								console.log("Could not resolve locator '" + JSON.stringify(locator) + "'. Skipping provision and assuming package is not used.");
							}
							return callback(null);
						}
						var locator = resolvedLocator;

						var packageDescriptor = locator.descriptor || {};

						// TODO: Make this more generic.
						if (!packageDescriptor.config) {
							packageDescriptor.config = {};
						}
						if (!packageDescriptor.config["smi.cli"]) {
							packageDescriptor.config["smi.cli"] = {};
						}
						if (!packageDescriptor.config["smi.cli"].aspects) {
							packageDescriptor.config["smi.cli"].aspects = {};
						}
						if (locator.aspects) {
							for (var aspectName in locator.aspects) {
								if (typeof packageDescriptor.config["smi.cli"].aspects[aspectName] === "undefined") {
									packageDescriptor.config["smi.cli"].aspects[aspectName] = locator.aspects[aspectName];
								}
							}
						}
						if (locator.originalChecksum) {
							packageDescriptor.config["smi.cli"].originalChecksum = locator.originalChecksum;
						}
						if (locator.finalChecksum) {
							packageDescriptor.config["smi.cli"].finalChecksum = locator.finalChecksum;
						}
						if (locator.syncInfo) {
							packageDescriptor.config["smi.cli"].syncInfo = locator.syncInfo;
						}

						if (installOptions.verbose) {
							console.log(("Ensure package '" + id + "' using locator '" + JSON.stringify(locator, null, 4) + "'.").cyan);
						}

						function ensureAspect(targetPath, aspect, locator, options, callback) {

							locator = resolveLocator(locator);

							function _aspectifyPath(path) {
								if (aspect) {
									return path + "/" + aspect;
								}
								return path;
							}

							var extension = locator.location.match(/\.([^\.]+)$/);
							if (extension) {
								extension = extension[1];
							} else {
								extension = "tgz";
							}

							var desiredLocator = {
								location: locator.location,
								subpath: locator.subpath || null,
								filelink: locator.filelink || false,
								type: locator.type || null,
								copy: locator.copy || false,
								latestOnly: (
									snapshotDescriptor &&
									snapshotDescriptor.config &&
									snapshotDescriptor.config["smi.cli"] &&
									!!snapshotDescriptor.config["smi.cli"].latestOnly
								) || false,
								install: (typeof locator.install !== "undefined") ? locator.install : ((aspect === "source" || aspect === null) || null),
								descriptor: packageDescriptor,
								smi: {
									revision: options.revision,
									basePath: options.basePath,
									downloadedPath: _aspectifyPath(options.basePath) + "." + extension,
									extractedPath: _aspectifyPath(options.basePath) + "~extracted",
									installedPath: _aspectifyPath(options.basePath),
									livePath: _aspectifyPath(targetPath)
								}
							};


							// Select appropriate extractor.
							// TODO: Select based on more than just the file extension. Should be able to declare extractor in mapping.
							var extractor = null;
							function ensureExtractor(callback) {
								if (/\.dmg$/.test(locator.location)) {
									extension = "dmg";
									desiredLocator.smi.downloadedPath = _aspectifyPath(options.basePath) + "." + extension;
									return require.async("./adapters/dmg", function(api) {
										extractor = function(archivePath, targetPath, callback) {
											return api.extract(archivePath, targetPath, installOptions, callback);
										}
										return callback(null);
									}, callback);
								} else
								if (locator.type === "git") {
									extension = "git";
									desiredLocator.smi.downloadedPath = _aspectifyPath(options.basePath) + "." + extension;
									return callback(null);
								} else {
									extractor = function(archivePath, targetPath, callback) {
										var strip = " --strip 1";
										// TODO: This should come from common metadata.
										if (extension === "xpi") {
											strip = "";
										}
						                var command = 'tar -xzf "' + PATH.basename(archivePath) + '"' + strip + ' -C "' + targetPath + '/"';
						                if (locator.subpath) {
						                	command += ' "*/' + locator.subpath + '"';
						                }
										if (installOptions.verbose) {
							                console.log(("Running command: " + command + " (cwd: " + PATH.dirname(archivePath) + ")").magenta);
							            }
						                return EXEC(command, {
						                    cwd: PATH.dirname(archivePath)
						                }, function(err, stdout, stderr) {
						                	if (err) return callback(err);
						                	return callback(null);
						                });
									}									
									return callback(null);
								}
							}

							var actualLocator = null;

							if (!packages[_abspath(packagesDirectory, id)]) {
								packages[_abspath(packagesDirectory, id)] = {
									basePath: options.basePath,
									aspects: options.aspects || []
								};
								desiredLocator.dependsIndex = (Object.keys(packages).length - 1);
							}

							if (!installOptions.silent) {
								var urlParts = null;
								if (typeof locator.location === "string") {
									urlParts = URL.parse(locator.location);
								}
								process.stdout.write(("[smi] ensure CODE".bold + " " + targetPath + " [aspect=" + aspect + "]" + (urlParts ? " <- " + PATH.basename(urlParts.pathname): "")).cyan + "\n");
							}

							function canSymlink(callback) {

								function symlink(fromPath, callback) {

									function resolveFromPath(fromPath, callback) {
										return FS.exists(PATH.join(fromPath, "package.json"), function(exists) {
											if (!exists) return callback(null, fromPath);
											return exports.readDescriptor(PATH.join(fromPath, "package.json"), {
												verbose: installOptions.verbose || false,
												debug: installOptions.debug || false,
												silent: installOptions.silent || false												
											}, function(err, descriptor) {
												if (err) return callback(err);
												if (
													descriptor &&
													descriptor.config &&
													descriptor.config["smi.cli"] &&
													descriptor.config["smi.cli"].aspects &&
													descriptor.config["smi.cli"].aspects.install &&
													descriptor.config["smi.cli"].aspects.install.basePath
												) {
													if (/\//.test(descriptor.config["smi.cli"].aspects.install.basePath)) {
														return callback(null, descriptor.config["smi.cli"].aspects.install.basePath);
													} else {
														return callback(null, PATH.join(fromPath, descriptor.config["smi.cli"].aspects.install.basePath));
													}
												}
												return callback(null, fromPath);
											});
										});
									}

									return resolveFromPath(fromPath, function(err, fromPath) {
										if (err) return callback(err);

										if (desiredLocator.subpath) {
											fromPath = PATH.join(fromPath, desiredLocator.subpath);
										}

										return FS.exists(fromPath, function(exists) {
											if (!exists) {
												return callback(null, "SKIP_SILENT");
											}
											var linkPath = _abspath(desiredLocator.smi.installedPath);
											if (!FS.existsSync(PATH.dirname(linkPath))) {
												FS.mkdirsSync(PATH.dirname(linkPath))
											}
											return FS.exists(linkPath, function(exists) {
												if (exists) {
													return callback(null, linkPath);
												}
												if (installOptions.verbose) {
								                    console.log(("Linking (canSymlink) '" + fromPath + "' to '" + linkPath + "'").magenta);
								                }
												return FS.symlink(PATH.relative(PATH.dirname(linkPath), fromPath), linkPath, function(err) {
													if (err) return callback(err);

													if (!summary[id]) {
														summary[id] = {
															installedPath: options.basePath,
															livePath: options.livePath,
															aspect: packageLocator.aspect || null,
															aspects: {}
														};
													}
													desiredLocator.symlinked = true;
													if (
														fromPath.substring(0, basePath.length) === basePath ||
														desiredLocator.install
													) {
														function loadPackageDescriptor(callback) {
															return FS.exists(PATH.join(fromPath, "package.json"), function(exists) {
																if (!exists) return callback(null);
																return exports.readDescriptor(PATH.join(fromPath, "package.json"), {
																	verbose: installOptions.verbose || false,
																	debug: installOptions.debug || false,
																	silent: installOptions.silent || false
																}, callback);
															});
														}
														return loadPackageDescriptor(function(err, descriptor) {
															if (err) return callback(err);
															if (descriptor) {
																desiredLocator.descriptor = descriptor;
															}
															if (desiredLocator.install !== false) {
																desiredLocator.install = true;
															}
															if (!options.aspects) {
																summary[id].aspects["source"] = desiredLocator;
															} else {
																summary[id].aspects[aspect || ""] = desiredLocator;
															}
															return callback(null, linkPath);													
														});
													} else {
														desiredLocator.install = false;
														summary[id].aspects[aspect || ""] = desiredLocator;
													}
													return callback(null, linkPath);
												});
											});
										});
									});
								}

								if (installOptions.debug) {
				                    console.log("desiredLocator", JSON.stringify(desiredLocator, null, 4));
								}

								// TODO: Should we do this somewhere else?
								function checkIfExists (callback) {
									return FS.exists(_abspath(desiredLocator.smi.livePath), function (exists) {
										return callback(null, exists);
									});
								}

								return checkIfExists(function (err, exists) {
									if (err) return callback(err);

									if (exists) {
										if (installOptions.verbose) {
						                    console.log(("Package already exists at '" + desiredLocator.smi.livePath + "'!").cyan);
						                }
										// TODO: Should this be done here?
										packages[_abspath(packagesDirectory, id)].basePath = options.livePath;
										return callback(null, "SKIP_SILENT");
									}
									if (id === "smi.cli" && installOptions.linkSmi === true) {
										if (installOptions.debug) {
						                    console.log("path via 1");
										}
										if (installOptions.verbose) {
						                    console.log(("Linking in our smi codebase at '" + PATH.dirname(__dirname) + "'!").cyan);
						                }
				                		return symlink(PATH.dirname(__dirname), callback);
									} else
					                if (desiredLocator.location && /^\./.test(desiredLocator.location)) {
										if (installOptions.debug) {
						                    console.log("path via 2");
										}
										// If the alias points to where it will be installed we ignore this entry.
										// This happens when dependencies and mappings are declared and the mapping
										// point to the node_modules/<name> path.
										if (PATH.join(basePath, desiredLocator.location) === _abspath(desiredLocator.smi.livePath)) {
											return callback(null, "SKIP_SILENT");
										}
					                	return FS.exists(PATH.join(basePath, desiredLocator.location), function(exists) {
					                		if (!exists) {
												// The aspect may not exist. If it does not we don't link it.
												if (aspect) {
													if (aspect === "source") {
														// The linked source package may not declare a format for the package.
														// We assume it does not if we get here.
														// TODO: This should be done by pinf-it-package-insight way before we get here.
														var path = PATH.join(basePath, desiredLocator.location);
														if (
															/\/source$/.test(path) &&
															FS.existsSync(PATH.dirname(path))
														) {
															return symlink(PATH.dirname(path), callback);
														}
													} else {
														console.log("WARN: Cannot map package '" + id + "' to '" + PATH.join(basePath, desiredLocator.location) + "' as path does not exist!");
														return callback(null, "SKIP_SILENT");
													}
												}
					                			return callback(new Error("Cannot map package '" + id + "' to '" + PATH.join(basePath, desiredLocator.location) + "' as path does not exist!"));
					                		}
					                		return symlink(PATH.join(basePath, desiredLocator.location), callback);
					                	});
					                } else
					                if (desiredLocator.location && /^\//.test(desiredLocator.location)) {
										if (installOptions.debug) {
						                    console.log("path via 3");
										}
					                	return FS.exists(desiredLocator.location, function(exists) {
					                		if (!exists) {
					                			return callback(new Error("Cannot map package '" + id + "' to '" + desiredLocator.location + "' as path does not exist!"));
					                		}
					                		return symlink(desiredLocator.location, callback);
					                	});
					                } else
									if (packages[id]) {
										if (installOptions.debug) {
						                    console.log("path via 4");
										}
										var fromPath = null;
										if (typeof packages[id].aspects === "object") {
											if (installOptions.debug) {
							                    console.log("path via 4.1");
											}
											var bestAspects = onlyBestAspects(packages[id].aspects);
											if (
												aspect === null &&
												typeof bestAspects["source"] === "object"
											) {
							                    console.log("path via 4.4");
												return callback(null, false);
											}
											if (
												typeof bestAspects[aspect] === "undefined" ||
												bestAspects[aspect] === null
											) {
							                    console.log("path via 4.3");
												return callback(null, "SKIP_SILENT");
											}
											if (installOptions.debug) {
												console.log("packages[id].aspects[aspect].basePath", packages[id].aspects[aspect].basePath);
											}
											fromPath = _abspath(packages[id].aspects[aspect].basePath);
											if (installOptions.debug) {
												console.log("fromPath", fromPath);
											}
										} else {
											if (installOptions.debug) {
							                    console.log("path via 4.2");
											}
											fromPath = PATH.join(snapshotDescriptor._path, "..", packages[id].basePath);
										}
										return symlink(fromPath, callback);
									}
									return callback(null, false);
								});
							}

							function getExistingLocator(callback) {
								return FS.exists(_abspath(desiredLocator.smi.livePath), function(exists) {
									if (!exists) {
										// No existing package. We must install it.
										return callback(null, null);
									}
									// If package is symlinked we don't need an smi descriptor.
									return FS.lstat(_abspath(desiredLocator.smi.livePath), function(err, stats) {
										if (err) return callback(err);
										if (stats.isSymbolicLink()) {
											// We have an existing package that is symlinked.
											return callback(null, {});
										}
										return FS.exists(_abspath(desiredLocator.smi.livePath, locatorFilename), function(exists) {
											if (exists) {
												// We have an existing smi descriptor. Read it and compare.
												return FS.readJson(_abspath(desiredLocator.smi.livePath, locatorFilename), callback);
											}
											return callback(new Error("Package found at '" + _abspath(desiredLocator.smi.livePath) + "' but no smi descriptor found at '" + _abspath(desiredLocator.smi.livePath, locatorFilename) + "'. Do not declare package or let smi handle it."));
										});
									});
								});
							}

					        function ensureDownloaded(archivePath, url, callback) {
					            return FS.exists(archivePath, function(exists) {
					                if (exists) return callback(null);
					                if (typeof downloads[url] === "string") {
					                	if (downloads[url] === archivePath) {
					                		return callback(null);
					                	}
										if (installOptions.verbose) {
						                    console.log(("Linking '" + downloads[url] + "' to '" + archivePath + "'").magenta);
						                }
					                    if (!FS.existsSync(PATH.dirname(archivePath))) {
					                    	FS.mkdirs(PATH.dirname(archivePath));
					                    }
					                	return FS.symlink(PATH.relative(PATH.dirname(archivePath), downloads[url]), archivePath, callback);
					                } else
					                if (downloads[url]) {
					                	downloads[url].push([archivePath, callback]);
					                	return;
					                }
					                downloads[url] = [ [ archivePath, callback ] ];
									var tmpPath = archivePath + "~" + Date.now();
					                if (!FS.existsSync(PATH.dirname(tmpPath))) {
					                    FS.mkdirsSync(PATH.dirname(tmpPath));
					                }
					                callback = function(err) {
					                	if (err) {
						                	if (FS.existsSync(tmpPath)) {
							            		if (!installOptions.debug) {
							            			// TODO: Move to failed directory instead of removing.
							                		FS.removeSync(tmpPath);
							                	}
						                	}
					                	}
					                	var callbacks = downloads[url];
					                	downloads[url] = archivePath;
					                	callbacks.forEach(function(callback) {
					                		if (err) return callback[1](err);
					                		return ensureDownloaded(callback[0], url, callback[1]);
					                	});
					                }
					                try {

				                        function success(callback) {
					                        return FS.rename(tmpPath, archivePath, function(err) {
					                        	if (err) {
					                        		if (err.code === "ENOTEMPTY") {
					                        			// Someone beat us to it!
					                        			if (installOptions.verbose) {
									                        console.log(("Downloaded package archive from '" + url + "' (was already there)").green);
									                    }
								                        return callback(null);
					                        		}
					                        		return callback(err);
					                        	}
												if (installOptions.verbose) {
							                        console.log(("Downloaded package archive from '" + url + "'").green);
												}
						                        return callback(null);
					                        });
				                        }

										var urlParts = URL.parse(url);

										if (desiredLocator.type === "git" || /^git@/.test(urlParts.path)) {
											if (!installOptions.silent) {
												process.stdout.write(("[smi] get CODE".bold + " " + url).cyan + "\n");
											}
											if (
												urlParts.hostname === "github.com" ||
												/^git@github\.com:/.test(urlParts.path)
											) {
												return require.async("./adapters/github", function(api) {
													return api.download(url, tmpPath, installOptions, function(err) {
														if (err) return callback(err);
								                        return success(callback);
													});
												}, callback);
											} else {
												throw new Error("No download adapter for url: " + url);
											}
										}

										if (!installOptions.silent) {
											process.stdout.write(("[smi] get CODE".bold + " " + urlParts.hostname + " // " + PATH.basename(urlParts.pathname)).cyan + "\n");
										}
										if (installOptions.verbose) {
						                    console.log(("Downloading package archive from '" + url + "' to '" + archivePath + "'").magenta);
						                }
					                    return requestForDescriptor(snapshotDescriptor, {
					                    	url: url,
					                    	cachePath: tmpPath,
					                    	linkMeta: false,
        				                    verbose: true || installOptions.verbose,
						                    debug: installOptions.debug,
					                    }, function(err, response) {
					                        if (err) return callback(err);

					                        if (response.status === 404 || response.status === 406) {
					                        	return FS.unlink(tmpPath, function(err) {
					                        		if (err) return callback(err);
						                        	// We assume URL exists but we cannot access it because we are not logged in.
						                        	// So we upgrade our login if we are accessing a known service.
						                        	var urlParts = URL.parse(url);
													// TODO: Use `it.pinf.package` to detect pm.
													if (urlParts.hostname === "github.com") {
														return require.async("./adapters/github", function(api) {
															return api.download(url, tmpPath, installOptions, function(err) {
																if (err) return callback(err);
										                        return success(callback);
															});
														}, callback);
													}
					                        	});
					                        }
					                        if (response.status !== 200 && response.status !== 304) {
					                        	return callback(new Error("Url '" + url + "' did not return status 200 nor 304!"));
					                        }
					                        return success(callback);
					                    });
					                } catch(err) {
					                    return callback(err);
					                }
					            });
					        }

					        function ensureExtracted(extractedPath, archivePath, callback) {        	
					            return FS.exists(extractedPath, function(exists) {
					                if (exists) return callback(null);
					                if (typeof extracts[extractedPath] === "string") {
					                	if (extracts[extractedPath] === archivePath) {
					                		return callback(null);
					                	}
					                	return FS.symlink(PATH.relative(PATH.dirname(archivePath), extracts[extractedPath]), archivePath, callback);
					                } else
					                if (extracts[extractedPath]) {
					                	extracts[extractedPath].push([archivePath, callback]);
					                	return;
					                }
					                extracts[extractedPath] = [ [ archivePath, callback ] ];
					                callback = function(err) {
					                	if (err) {
					                		console.error("Error extracting", err.stack, extractedPath, archivePath);
					                	}
					                	var callbacks = extracts[extractedPath];
					                	extracts[extractedPath] = archivePath;
					                	callbacks.forEach(function(callback) {
					                		if (err) return callback[1](err);
					                		return ensureDownloaded(extractedPath, callback[0], callback[1]);
					                	});
					                }
					                return FS.stat(archivePath, function(err, stat) {
					                	if (err) return callback(err);
					                	if (stat.isDirectory()) {
					                		if (desiredLocator.latestOnly) {
												if (installOptions.verbose) {
									                console.log(("Copy '" + archivePath + "' to '" + extractedPath + "'").magenta);
									            }
								                return FS.copy(archivePath, extractedPath, callback);
					                		} else {
												if (installOptions.verbose) {
									                console.log(("Store link '" + PATH.relative(PATH.dirname(extractedPath), archivePath) + "' at '" + extractedPath + "'").magenta);
									            }
								                return FS.symlink(PATH.relative(PATH.dirname(extractedPath), archivePath), extractedPath, callback);
								            }
					                	}
										if (installOptions.verbose) {
							                console.log(("Extract '" + archivePath + "' to '" + extractedPath + "'").magenta);
							            }
										var tmpPath = extractedPath + "~" + Date.now();
						                if (!FS.existsSync(tmpPath)) {
						                    FS.mkdirsSync(tmpPath);
						                }
						                return extractor(archivePath, tmpPath, function(err) {
						                    if (err) {
								                console.error("Error extracting: " + archivePath);
							                	if (FS.existsSync(tmpPath)) {
								            		if (!installOptions.debug) {
								            			// TODO: Move to failed directory instead of removing.
								                		FS.removeSync(tmpPath);
								                	}
							                	}
						                    	return callback(err);
						                    }
											if (installOptions.verbose) {
								                console.log(("Rename '" + tmpPath + "' to '" + extractedPath + "'"));
								            }
						                    return FS.rename(tmpPath, extractedPath, function(err) {
						                    	if (err) return callback(err);
												if (installOptions.verbose) {
								                    console.log(("Archive '" + archivePath + "' extracted to '" + extractedPath + "'").green);
								                }
							                    return callback(null);
							                });
						                });
					                });
					            });
					        }

					        function readDescriptor(descriptorPath, callback) {
								return exports.readDescriptor(descriptorPath, {
									verbose: installOptions.verbose || false,
									debug: installOptions.debug || false,
									silent: installOptions.silent || false									
								}, callback);
					        }

							function writeLocator(targetPath, callback) {
								return readDescriptor(_abspath(desiredLocator.smi.extractedPath, desiredLocator.subpath || "", "package.json"), function(err, descriptor) {
									if (err) return callback(err);

									actualLocator = DEEPCOPY(desiredLocator);
									actualLocator.descriptor = DEEPMERGE(descriptor || {}, actualLocator.descriptor || {});

									return FS.outputFile(PATH.join(targetPath, locatorFilename), JSON.stringify(actualLocator, null, 4), callback);
								});
							}

							return ensureExtractor(function(err) {
								if (err) return callback(err);

								return canSymlink(function(err, symlinkPath) {
									if (err) return callback(err);

									if (symlinkPath) {
										if (symlinkPath !== "SKIP_SILENT") {
											if (installOptions.verbose) {
												console.log(("Skip provision package '" + id + "'. Symlinked to '" + symlinkPath + "'.").yellow);
											}
										}
										if (desiredLocator.install) {
											return writeLocator(_abspath(desiredLocator.smi.extractedPath), callback);
										}
										return callback(null);
									}

									return getExistingLocator(function(err, existingLocator) {
										if (err) return callback(err);
										if (existingLocator) {
											if (!existingLocator.smi || DEEPEQUAL(existingLocator.smi, desiredLocator.smi)) {
												if (installOptions.verbose) {
													console.log(("Skip provision package '" + id + "'. Already provision!").yellow);
												}
												return callback(null);
											}
										}

										function finalize(callback) {
											return writeLocator(_abspath(desiredLocator.smi.extractedPath), function(err) {
												if (err) return callback(err);

												if (!summary[id]) {
													summary[id] = {
														installedPath: options.basePath,
														livePath: options.livePath,
														downloadedPath: desiredLocator.smi.downloadedPath,
														extractedPath: desiredLocator.smi.extractedPath,
														aspect: packageLocator.aspect || null,
														aspects: {}
													};
												}
												summary[id].aspects[aspect || ""] = actualLocator;
												return callback(null);
											});										
										}

										if (!desiredLocator.location) {
											if (err) return callback(err);

											return finalize(callback);
										}

										return ensureDownloaded(_abspath(desiredLocator.smi.downloadedPath), desiredLocator.location, function(err) {
											if (err) return callback(err);

											return ensureExtracted(_abspath(desiredLocator.smi.extractedPath), _abspath(desiredLocator.smi.downloadedPath), function(err) {
												if (err) return callback(err);

												return finalize(callback);
							                });
							            });
									});
								});
							});
						}

						function generateRevision(locator) {

							function deepsort(o) {
								if (typeof o !== "object") {
									return o;
								}
							    var sorted = {},
							    key, a = [];
							    for (key in o) {
							    	if (o.hasOwnProperty(key)) {
							    		a.push(key);
							    	}
							    }
							    a.sort();
							    for (key = 0; key < a.length; key++) {
							    	if (typeof o[a[key]] === "object") {
								    	sorted[a[key]] = deepsort(o[a[key]]);
							    	} else {
								    	sorted[a[key]] = o[a[key]];
							    	}
							    }
							    return sorted;
							}

							// TODO: Take compile flags into account.
							var revision = CRYPTO.createHash("sha1");
						    revision.update(JSON.stringify(deepsort(locator), null, 4));
							return revision.digest("hex");
						}
/*
						function writePackageDescriptor(callback) {
							if (!packageDescriptor) {
								return callback(null);
							}
							var packageDescriptorPath = _abspath(targetPath + "-" + revision.substring(0, 7), "package.json");
							return FS.exists(packageDescriptorPath, function(exists) {
								if (exists) {
									packageDescriptorPath = packageDescriptorPath.replace(/\.json$/, ".1.json");
								}
								// TODO: Indicate source of descriptor. i.e. uri to catalog with pointer within catalog.
								if (installOptions.verbose) {
									console.log(("Writing package descriptor from catalog to: " + packageDescriptorPath).magenta);
								}
								return FS.outputFile(packageDescriptorPath, JSON.stringify(packageDescriptor, null, 4), callback);
							});
						}
*/
/*
						if (locator.install === false) {
							if (installOptions.verbose) {
								console.log("locator", locator);
								console.log("locator.install === false");
							}
							return callback(null);
						} else
*/
						if (locator.aspects) {
							var waitfor = WAITFOR[installOptions.debug ? "serial":"parallel"](function(err) {
								if (err) return callback(err);
								if (summary[id]) {
									summary[id].descriptor = packageDescriptor;
								}
								if (installOptions.verbose) {
									console.log("done id", id);
								}								
								return callback(null);
//								return writePackageDescriptor(callback);
							});
							var revision = generateRevision(locator.aspects);
							var aspects = {};
							Object.keys(locator.aspects).forEach(function(aspect) {
								if (installOptions.verbose) {
									console.log("aspect", aspect);
								}								
								aspects[aspect] = {
									basePath: PATH.join(targetPath + "-" + revision.substring(0, 7), aspect)
								};
							});
							var bestAspects = onlyBestAspects(locator.aspects, packageLocator.aspect || null);
							if (installOptions.verbose) {
								console.log("bestAspects", bestAspects);
							}
							if (packageLocator.aspect) {
								if (!bestAspects[packageLocator.aspect]) {
									console.error("bestAspects", bestAspects);
									throw new Error("Requested aspect '" + packageLocator.aspect + "' not found in best aspects!");
								}
							}
							for (var aspect in bestAspects) {
								var _locator = bestAspects[aspect];
								if (typeof _locator === "string") {
									_locator = {
										location: _locator
									};
								}
								if (typeof packageLocator.install !== "undefined") {
									_locator.install = packageLocator.install;
								}
								waitfor(targetPath, aspect, _locator, {
									basePath: targetPath + "-" + revision.substring(0, 7),
									livePath: targetPath,
									revision: revision,
									aspects: aspects
								}, ensureAspect);
							}
							return waitfor();
						} else
						if (locator.location) {
							var revision = generateRevision(locator);
							if (installOptions.verbose) {
								console.log("revision", revision);
							}
							return ensureAspect(targetPath, null, locator, {
								basePath: targetPath + "-" + revision.substring(0, 7),
								livePath: targetPath,
								revision: revision
							}, function(err) {
								if (err) return callback(err);
								if (summary[id]) {
									summary[id].descriptor = packageDescriptor;
								}
								return callback(null);
//								return writePackageDescriptor(callback);
							});
						} else {
							if (installOptions.verbose) {
								console.log(("[smi] Warning: Ignoring locator: " + JSON.stringify(locator, null, 4)));
							}
							return callback(null);
						}
					} catch(err) {
						return callback(err);
					}
				});
			}

			function link(callback) {

				if (installOptions.verbose) {
					console.log(("[smi] link packages: " + JSON.stringify(Object.keys(summary), null, 4)).cyan);
				}

				function doit(id, aspect, locator, callback) {

					if (snapshotDescriptor._repeatEnsureAfterInstall && id !== snapshotDescriptor._repeatEnsureAfterInstall) {
						if (installOptions.verbose) {
							console.log("Return due to repeat.");
						}
						return callback(null);
					}
/*
// NOTE: `install === false` means we should not call "install" on the package, but we still link it live within smi.
					if (aspect === "source" && locator.install !== true) {
						// TODO: Record reason.
						console.log("Return due to no install for package '" + id + "'.");
						return callback(null);
					}
*/
					function _aspectifyPath(path) {
						return path;
					}

					var installedPath = _abspath(_aspectifyPath(locator.smi.installedPath));

					function linkUsingAdapter(callback) {
						// TODO: Use `it.pinf.package` to detect pm.
						var type = "npm";

						return require.async("./adapters/" + type, function(api) {
							return api.link(_aspectifyPath(basePath), locator, packages, installOptions, callback);
						}, callback);
					}
					return FS.exists(installedPath, function(exists) {
						if (exists && !locator.symlinked) {
							if (installOptions.verbose) {
								console.log("Return due to exists and not symlinked", installedPath);
							}
							return callback(null);
						}

						var extractedPath = _abspath(_aspectifyPath(locator.smi.extractedPath));
						if (locator.subpath) {
							extractedPath = PATH.join(extractedPath, locator.subpath);
						}				

						function copy(callback) {
							if (installOptions.verbose) {
								console.log(("Copying '" + extractedPath + "' to '" + installedPath + "'.").magenta);
							}
							var command = 'cp -Rf "' + extractedPath + '" "' + installedPath + '"';
			                return EXEC(command, {
			                    cwd: PATH.dirname(installedPath)
			                }, function(err, stdout, stderr) {
			                    if (err) {
			                    	console.error("stdout", stdout);
			                    	console.error("stderr", stderr);
			                    	return callback(err);
			                    }
								if (!locator.subpath) {
									return callback(null);
								}
								return FS.copy(
									PATH.join(_abspath(_aspectifyPath(locator.smi.extractedPath)), ".smi.json"),
									PATH.join(installedPath, ".smi.json"),
									callback
								);
							});
						}

						function error(err) {
			            	if (FS.existsSync(installedPath)) {
			            		if (!installOptions.debug) {
			            			// TODO: Move to failed directory instead of removing.
				            		FS.removeSync(installedPath);
				            	}
			            	}
							return callback(err);
						}

						if (locator.install === false) {
							if (installOptions.verbose) {
								console.log(("Skip linking '" + installedPath + "' as 'install == false'.").yellow);
							}
							return callback(null);
						}

						if (locator.symlinked) {
							return linkUsingAdapter(callback);
						} else {

							return copy(function(err) {
								if (err) return error(err);	

								return linkUsingAdapter(function(err) {
									if (err) return error(err);
									return callback(null);
								});
							});
						}
					});
				}

// TODO: Run this in parallel once we know how we can process things based on meta data.
//				var waitfor = WAITFOR[installOptions.debug ? "serial":"parallel"](function(err) {
				var waitfor = WAITFOR.serial(function(err) {
					if (err) return callback(err);
					for (var id in summary) {
						if (summary[id].descriptor) {
							if (!DEEPEQUAL(summary[id].descriptor, {
							    "config": {
							        "smi.cli": {
							            "aspects": {}
							        }
							    }
							})) {
								var packageDescriptorPath = _abspath(summary[id].installedPath, "package.json");
								if (FS.existsSync(packageDescriptorPath)) {
									packageDescriptorPath = packageDescriptorPath.replace(/\.json$/, ".1.json");
								}
								// TODO: Indicate source of descriptor. i.e. uri to catalog with pointer within catalog.
								if (installOptions.verbose) {
									console.log(("Writing package descriptor from catalog to: " + packageDescriptorPath).magenta);
								}
								FS.outputFileSync(packageDescriptorPath, JSON.stringify(summary[id].descriptor, null, 4));
							}
						}
					}
					return callback(null, summary);
				});
				for (var id in summary) {
					for (var aspect in summary[id].aspects) {
						waitfor(id, aspect, summary[id].aspects[aspect], doit);
					}
				}
				return waitfor();
			}

			function install(callback) {

				if (installOptions.verbose) {
					console.log("[smi] install".cyan);
				}

				function doit(id, aspect, locator, callback) {

					if (snapshotDescriptor._repeatEnsureAfterInstall && id !== snapshotDescriptor._repeatEnsureAfterInstall) {
						return callback(null);
					}

					if (locator.install !== true) {
						// TODO: Record reason.
						return callback(null);
					}

					return throttle(callback, function(callback) {

						function _aspectifyPath(path) {
							return path;
						}

						var installedPath = _abspath(_aspectifyPath(locator.smi.installedPath));

						if (!installOptions.silent) {
							process.stdout.write(("[smi] ensure INSTALL".bold + " " + installedPath + " [aspect=" + aspect + "]").cyan + "\n");
						}

						function error(err) {
							err.message += " (while installing '" + installedPath + "')";
							err.stack += "\n(while installing '" + installedPath + "')";
							// TODO: Move directory to `*~failed`.
			            	if (FS.existsSync(installedPath)) {
			            		if (!installOptions.debug) {
			            			var failedPath = installedPath + "~failed." + Date.now();
			            			console.error("Moving failed install from '" + installedPath + "' to '" + failedPath + "'.");
			            			// TODO: Move to failed directory instead of removing.
				            		FS.moveSync(installedPath, failedPath);
				            	}
			            	}
							return callback(err);
						}

						return FS.exists(installedPath, function(exists) {
							if (!exists) {
								console.error("Warning: Cannot install package '" + id + "'. No directory found for '" + aspect + "' aspect!");
								return callback(null);
							}

							return FS.exists(PATH.join(installedPath, ".installed"), function(exists) {
								if (exists) {
									console.error("Skip install package '" + id + "' as '.installed' found!");
									return callback(null);
								}

								// TODO: Use `it.pinf.package.insight` to detect pm.
								var type = "npm";
								// POLICY: `pinf-it-package-insight` looks for `bin/install.sh` to determine if it is a `pinf` workspace.
								// TODO: May want to include some meta data in install.sh or look at other criteria as well.
								if (FS.existsSync(PATH.join(installedPath, "bin/install.sh"))) {
									type = "pinf";
								}

								return require.async("./adapters/" + type, function(api) {
									return api.install(_aspectifyPath(basePath), locator, packages, installOptions, function(err) {
										if (err) return error(err);
										return callback(null);
									});
								}, error);
							});
						});
					});
				}

// TODO: Change to `parallel` once smi can communicate inter-process to enable shared locking.
//       Currently if running multiple smi installs, resource installations may overlap at the wrong time!
//				var waitfor = WAITFOR.parallel(function(err) {
				var waitfor = WAITFOR.serial(function(err) {
					if (err) return callback(err);
					return callback(null, summary);
				});

				// TODO: Allow for declaring one mapping to be dependent on another
				//       and use `async` NPM module to install?
				for (var id in summary) {
					for (var aspect in summary[id].aspects) {
						if (aspect === "source" || aspect === "") {
							waitfor(id, aspect, summary[id].aspects[aspect], doit);
						}
					}
				}
				return waitfor();

				// TODO: Optionally put dependency into read only mode.
	            //'chmod -Rf 0544 _upstream',
	            //'find _upstream -type f -iname "*" -print0 | xargs -I {} -0 chmod 0444 {}',
	            //'find _upstream/* -maxdepth 1 -type d -print0 | xargs -I {} -0 chmod u+w {}'
			}

			return ensure(function(err) {
				if (err) return callback(err);

				if (installOptions.dryrun) {
					return callback(null);
				}

				return link(function(err) {
					if (err) return callback(err);
					return install(function(err) {
						if (err) return callback(err);
						if (snapshotDescriptor._repeatEnsureAfterInstall) {
							if (installOptions.verbose) {
								console.log("\n\nNOTICE: Repeat after install triggered!\n\n", snapshotDescriptor._repeatEnsureAfterInstall, "\n\n");
							}
							snapshotDescriptor._repeatEnsureAfterInstall = false;
							previousSummary = summary;
							return prepare(callback);
						}
						return callback(null, summary);
					});
				});
			});
		});
	}

	return prepare(function(err, summary) {
		if (err) return callback(err);

		if (installOptions.dryrun) {
			return callback(null, summary);
		}

		return ensureDescriptor(function(err, snapshotDescriptor) {
			if (err) return callback(err);

			function activate(callback) {

				if (installOptions.verbose) {
					console.log("[smi] activate".cyan);
				}

				function doit(id, info, callback) {
					function _aspectifyPath(path) {
						return path;
					}
					if (
						info.installedPath === info.livePath
					) {
						return callback(null);
					}

					var livePath = _abspath(_aspectifyPath(info.livePath));
					if (FS.existsSync(livePath)) {
	            		if (!installOptions.debug) {
		        			// TODO: Move to failed directory instead of removing.
							FS.removeSync(livePath);
						}
					}

					var installedPath = null;


					// If we are being asked to activate a specific aspect we do it.
					if (info.aspect) {
						if (!info.aspects[info.aspect]) {
							console.error("info", info);
							throw new Error("Requested aspect '" + info.aspect + "' not found in info!");
						}
						installedPath = _abspath(PATH.join(info.installedPath, info.aspect));

					} else {

						// If we have a source aspect with a path we activate that.
						if (
							info.aspects &&
							info.aspects.source &&
							info.aspects.source.location &&
							/^\./.test(info.aspects.source.location)
						) {
							installedPath = _abspath(info.aspects.source.location);
						} else {
							installedPath = _abspath(_aspectifyPath(info.installedPath));
						}

						if (
							!FS.existsSync(installedPath) &&
							/\/source$/.test(installedPath) &&
							FS.existsSync(PATH.dirname(installedPath))
						) {
							// The linked source package may not declare a format for the package.
							// We assume it does not if we get here.
							// TODO: This should be done by pinf-it-package-insight way before we get here.
							if (installOptions.verbose) {
								console.log("Warning: Hack shortening " + installedPath + " to " + PATH.dirname(installedPath) + " to adjust for no package content descriptor");
							}
							installedPath = PATH.dirname(installedPath);
						}
					}


					// Hack: For some reason the 'installedPath' comes back wrong at times
					//       when git repositories are involved.
					//       We just fix it here instead of trying to figure out why its wrong above.
					if (
						!FS.existsSync(installedPath) &&
						FS.existsSync(installedPath + ".git")
					) {
						installedPath += ".git";
					}


					if (installOptions.verbose) {
			            console.log(("Activating " + installedPath + " by linking to " + livePath).magenta);
			        }
					if (!FS.existsSync(PATH.dirname(livePath))) {
						FS.mkdirsSync(PATH.dirname(livePath));
					}
					try { FS.unlinkSync(livePath); } catch(err) {}

					function linkCommands (callback) {
						var binPath = binDirectoryForDescriptor(snapshotDescriptor);
						if (!binPath) {
							return callback(null);
						}
						var descriptorPath = PATH.join(livePath, "package.json");
						return FS.exists(descriptorPath, function (exists) {
							if (installOptions.verbose) {
					            console.log(("Descriptor path " + descriptorPath + " exists: " + exists).magenta);
					        }
							if (!exists) {
								return callback(null);
							}
							return FS.readJson(descriptorPath, function (err, descriptor) {
								if (err) return callback(err);
								if (installOptions.verbose) {
						            console.log(("Read descriptor " + descriptorPath + ":").magenta, descriptor);
						        }
								var waitfor = WAITFOR[installOptions.debug ? "serial":"parallel"](callback);
								if (descriptor.bin) {
									for (var name in descriptor.bin) {
										waitfor(name, function (name, callback) {
											var fromPath = PATH.join(descriptorPath, "..", descriptor.bin[name]);
											var toPath = PATH.join(snapshotDescriptor._path, "..", binPath, name);
											try {
												FS.removeSync(toPath);
											} catch (err) {}
											if (installOptions.verbose) {
									            console.log(("Linking declared bin '" + name + "' from '" + fromPath + "' to '" + toPath + "'").magenta);
									        }
									        if (!FS.existsSync(PATH.dirname(toPath))) {
									        	FS.mkdirsSync(PATH.dirname(toPath));
									        }
									        return FS.symlink(fromPath, toPath, callback);
										});
									}
								}
								return waitfor();
							});
						});
					}

					// TODO: How does this work with multiple aspects?
					if (
						info.aspects &&
						info.aspects[''] &&
						info.aspects[''].copy &&
						/^\//.test(info.aspects[''].location)
					) {
						// Copy file instead of creating symlinks.
						var command = 'rm -Rf "' + _abspath(info.downloadedPath || "/dev/null") + '" "' + _abspath(info.extractedPath || "/dev/null") + '" "' + installedPath + '"  "' + livePath + '" || true';
		                return EXEC(command, {
		                    cwd: PATH.dirname(installedPath)
		                }, function(err, stdout, stderr) {
							if (installOptions.verbose) {
					            console.log(("Writing linkfile to: " + livePath).yellow);
					        }
					        return FS.copy(info.aspects[''].location, livePath, function (err) {
					        	if (err) return callback(err);
					        	return linkCommands(callback);
					        });
		                });
					} else
					if (
						info.aspects &&
						info.aspects[''] &&
						info.aspects[''].filelink &&
						/^\//.test(info.aspects[''].location)
					) {
						// We write a file containing path to directory we are linking
						// instead of creating symlinks.
						var command = 'rm -Rf "' + _abspath(info.downloadedPath || "/dev/null") + '" "' + _abspath(info.extractedPath || "/dev/null") + '" "' + installedPath + '"  "' + livePath + '" || true';
		                return EXEC(command, {
		                    cwd: PATH.dirname(installedPath)
		                }, function(err, stdout, stderr) {
							if (installOptions.verbose) {
					            console.log(("Writing linkfile to: " + livePath).yellow);
					        }
							return FS.outputFile(livePath, info.aspects[''].location, "utf8", callback);
		                });
					} else {
						// If we only want the latest code we move the versioned install to the non-versioned
						// alias. Usually the non-versioned alias is a symlink to the activated version.
						if (
							installOptions.latestOnly ||
							(
								info.aspects &&
								info.aspects[''] &&
								info.aspects[''].latestOnly
							)
						) {
							var command = 'rm -Rf "' + _abspath(info.downloadedPath || "/dev/null") + '" "' + _abspath(info.extractedPath || "/dev/null") + '" "' + livePath + '" || true';
			                return EXEC(command, {
			                    cwd: PATH.dirname(installedPath)
			                }, function(err, stdout, stderr) {
								return FS.rename(installedPath, livePath, function (err) {
						        	if (err) return callback(err);
						        	return linkCommands(callback);
						        });
			                });
						}
						return FS.symlink(PATH.relative(PATH.dirname(livePath), installedPath), livePath, function(err) {
							if (err) return callback(err);
				        	return linkCommands(callback);
						});
					}
				}

				var waitfor = WAITFOR[installOptions.debug ? "serial":"parallel"](function(err) {
					if (err) return callback(err);
					return callback(null, summary);
				});
				// TODO: Allow for declaring one mapping to be dependent on another
				//       and use `async` NPM module to install?
				for (var id in summary) {
					waitfor(id, summary[id], doit);
				}
				return waitfor();
			}

			return activate(callback);
		});
	});
}


// @source https://github.com/c9/architect/blob/567b7c034d7644a2cc0405817493b451b01975fa/architect.js#L332
function orderPackages(plugins, ignoreMissing) {
    var resolved = {
        hub: true
    };
    var changed = true;
    var sorted = [];

    while(plugins.length && changed) {
        changed = false;

        plugins.concat().forEach(function(plugin) {
            var consumes = plugin.consumes.concat();

            var resolvedAll = true;
            for (var i=0; i<consumes.length; i++) {
                var service = consumes[i];
                if (!resolved[service]) {
                    resolvedAll = false;
                } else {
                    plugin.consumes.splice(plugin.consumes.indexOf(service), 1);
                }
            }

            if (!resolvedAll)
                return;

            plugins.splice(plugins.indexOf(plugin), 1);
            plugin.provides.forEach(function(service) {
                resolved[service] = true;
            });
            sorted.push(plugin);
            changed = true;
        });
    }

    if (plugins.length) {
        var unresolved = {};
        plugins.forEach(function(plugin) {
            delete plugin.config;
            plugin.consumes.forEach(function(name) {
                if (unresolved[name] == false)
                    return;
                if (!unresolved[name])
                    unresolved[name] = [];
                unresolved[name].push(plugin.packagePath);
            });
            plugin.provides.forEach(function(name) {
                unresolved[name] = false;
            });
        });

        Object.keys(unresolved).forEach(function(name) {
            if (unresolved[name] == false)
                delete unresolved[name];
        });

        if (ignoreMissing) {
		    return sorted;
        }

        console.error("Resolved services:", Object.keys(resolved));
        console.error("Missing services:", unresolved);
        console.error("Could not resolve dependencies of these plugins:", plugins);

        throw new Error("Could not resolve dependencies");
    }
    return sorted;
}
