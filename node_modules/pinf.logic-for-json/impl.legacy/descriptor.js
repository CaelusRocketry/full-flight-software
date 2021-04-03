
require("require.async")(require);

const PATH = require("path");
const FS = require("fs-extra");
const Q = require("q");
const WAITFOR = require("waitfor");
const DEEPMERGE = require("deepmerge");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");
const VARIABLES = require("./variables");


const DEBUG = !!process.env.VERBOSE;


exports.fromFile = function (proto, path, options, callback) {

	if (typeof options === "function" && typeof callback === "undefined") {
		callback = options;
		options = null;
	}

	options = options || {};
	options.env = options.env || process.env;
/*
	var loadRootPINFConfigOnce = function (callback) {
		if (loadRootPINFConfigOnce.loaded) {
			return callback(null, {});
		}

		if (!options.env.PGS_WORKSPACE_ROOT) {
			return callback(new Error("'PGS_WORKSPACE_ROOT' environment variable must be set!"));
		}

		return loadFromFile(PATH.join(options.env.PGS_WORKSPACE_ROOT, "PINF.json"), function (err, pinfConfig) {
			if (err) return callback(err);

			var descriptor = new proto(
				PATH.join(options.env.PGS_WORKSPACE_ROOT, "PINF.json"),
				pinfConfig,
				options
			);
			return descriptor.init(function (err) {
				if (err) return callback(err);

				loadRootPINFConfigOnce.loaded = true;
				return callback(null, pinfConfig._data);
			});
		});
	}
*/
	function loadFromFile (path, callback) {

		function loadLayer(layerIndex, callback) {
			var _path = path;
			if (layerIndex > 0) {
				_path = _path.replace(/\.json/, "." + layerIndex + ".json");
			}
			return FS.exists(_path, function(exists) {
				if (!exists) return callback(null, null);

				if (process.env.DEBUG) {
					console.log("Load descriptor:", _path);
				}
				return FS.readJson(_path, function(err, descriptor) {
					if (err) {
						err.message += " (while parsing " + _path + ")";
						err.stack += "\n(while parsing " + _path + ")"
						return callback(err);
					}
					return loadLayer(layerIndex + 1, function(err, _descriptor) {
						if (err) return callback(err);
						if (_descriptor) {
							descriptor = DEEPMERGE(descriptor, _descriptor);
						}
						return callback(null, descriptor);
					});
				});
			});
		}
		return loadLayer(0, function(err, descriptor) {
			if (err) return callback(err);
			if (!descriptor) {
				return callback(null, {});
			}
			return callback(null, descriptor);
		});
	}

	function loadFromFiles (callback) {
		return loadFromFile(path, function (err, data) {
			if (err) return callback(err);

			// Load local override file if it exists.
			return loadFromFile(path.replace(/\.json$/, ".local.json"), function (err, _data) {
				if (err) return callback(err);

				data = DEEPMERGE(data, _data);

/*			
			if (proto.type === "ProgramDescriptor") {

console.log("PROCESS", PATH.join(process.env.PGS_WORKSPACE_ROOT, "PINF.json"));

				return loadRootPINFConfigOnce(function (err, pinfConfig) {
					if (err) return callback(err);

console.log("CONFIG pinfConfig", pinfConfig);

					data.config = DEEPMERGE(data.config || {}, pinfConfig || {});
					return callback(null, data);
				});
			}
*/
				return callback(null, data);
			});
		});
	}

	return loadFromFiles(function (err, data) {
		if (err) return callback(err);
		var descriptor = new proto(path, data, options);
		return descriptor.init(function (err) {
			if (err) return callback(err);
			return callback(null, descriptor);
		});
	});
}


var Descriptor = exports.Descriptor = function (proto, path, data, options) {
	var self = this;
	self._proto = proto;

	// TODO: Do this somewhere else.
	self._path = FS.realpathSync(path);

	self._data = data;
	self._options = options;

	self.VARIABLES = VARIABLES.for({
		fromFile: function (uri, _opts, callback) {
			var opts = {};
			for (var name in self._options) {
				opts[name] = self._options[name];
			}
			for (var name in _opts) {
				opts[name] = _opts[name];
			}
			return exports.fromFile(self._proto, uri, opts, callback);
		}
	});

//console.log("DATA", self._data);


	function injectArguments () {
		if (options["@args"] || self._data["@args"]) {
			self._data["@args"] = DEEPMERGE(self._data["@args"] || {}, options["@args"] || {});
		}
		// TODO: Make sure the options object passed in is not modified.
		delete options["@args"];
	}

	function getEnvironmentVariables (configString) {
		var vars = {};
        var re = /\{\{(!)?env\.([^\}]+)\}\}/g;
        var m = null;
        while (m = re.exec(configString)) {
        	vars[m[2]] = {
        		optional: (m[1] === "!"),
        		matched: m[0]
        	};
        }
        return vars;
	}

	function resolveVariables () {
		var configString = JSON.stringify(self._data);
		configString = configString.replace(/\{\{__FILENAME__\}\}/g, self._path);
		configString = configString.replace(/\{\{__DIRNAME__\}\}/g, PATH.dirname(self._path));
		configString = configString.replace(/\{\{__DIRNAME2__\}\}/g, PATH.dirname(PATH.dirname(self._path)));

		var envVars = getEnvironmentVariables(configString);
		for (var name in envVars) {
			// TODO: Fire event to handlers to promt for variable or load it from profile/credentials.
			if (!self._options.env[name]) {
				if (envVars[name].optional) {
					configString = configString.replace(new RegExp(ESCAPE_REGEXP_COMPONENT(envVars[name].matched), "g"), "");
					continue;
				}
				if (self._options.ignoreMissingEnvironmentVariables !== true) {
					throw new Error("Environment variable '" + name + "' is not set! Used in: " + self._path);
				}
			} else {
				configString = configString.replace(new RegExp(ESCAPE_REGEXP_COMPONENT(envVars[name].matched), "g"), self._options.env[name]);
			}
		}

		self._data = JSON.parse(configString);
	}

	injectArguments();
	resolveVariables();
}

Descriptor.prototype.getProtoBasename = function () {
	return PATH.basename(this._path).replace(/\.json$/, "");
}

Descriptor.prototype.init = function (callback) {
	var self = this;


	function applyInjections (callback) {
		return self.VARIABLES.replaceInObject(
			self._data,
			[
				{
					type: "@inject"
				}
			]
		).then(function (data) {
			self._data = data;
			return callback(null);
		}).fail(callback);
	}

	function resolveRelativeVariables (callback) {
		return self.VARIABLES.replaceInObject(
			self._data,
			[
				{
					type: "JSONPathVariables"
				}
			]
		).then(function (data) {
			self._data = data;
			return callback(null);
		}).fail(callback);
	}

	function resolveExtends (callback) {
		if (!self._data['@extends']) {
			return callback(null);
		}

		if (!self._data['$provenance']) {
			self._data['$provenance'] = {};
		}

		var Resolver = function () {
			var resolverSelf = this;
			resolverSelf.locators = self._data['@extends'];
			resolverSelf.locatorKeys = Object.keys(resolverSelf.locators);
			resolverSelf.locatorKeys.forEach(function(locatorKey, i) {
				var locator = resolverSelf.locators[locatorKey];
				if (!locator) {
					return;
				}
				if (typeof locator === "string") {
					resolverSelf.locators[locatorKey] = {
						location: locator
					};
				}
			});
			resolverSelf.locators = JSON.parse(JSON.stringify(resolverSelf.locators));
			resolverSelf.extendsLocators = [];
			resolverSelf.appliedLocators = [];
		}
		Resolver.prototype.getLocatorToApply = function (locatorKey) {
			var resolverSelf = this;

			//JSON.parse(JSON.stringify(self.locators));

//console.log("getLocatorToApply locatorKey", locatorKey);

//console.log("getLocatorToApply resolverSelf.extendsLocators", resolverSelf.extendsLocators);
//console.log("getLocatorToApply resolverSelf.callingLocator", resolverSelf.callingLocator);

//console.log("getLocatorToApply resolverSelf.locators", resolverSelf.locators[locatorKey]);

			var locator = resolverSelf.locators[locatorKey] || {};
			if (resolverSelf.callingLocator) {
				locator = DEEPMERGE(locator, resolverSelf.callingLocator.getLocatorToApply(locatorKey) || {});
			}
			if (resolverSelf.locators[locatorKey]) {
				resolverSelf.appliedLocators.push(locatorKey);
			}

			return locator;
		}
		Resolver.prototype.isApplied = function (locatorKey, callingInstance) {
			var resolverSelf = this;

//console.log("isApplied locatorKey", locatorKey);

//console.log("isApplied resolverSelf.extendsLocators", resolverSelf.extendsLocators);
//console.log("isApplied resolverSelf.callingLocator", resolverSelf.callingLocator);
//console.log("isApplied resolverSelf.appliedLocators", resolverSelf.appliedLocators);

			if (resolverSelf.appliedLocators.indexOf(locatorKey) !== -1) {
				return true;
			}
/*
			if (
				resolverSelf.callingLocator &&
				resolverSelf.callingLocator !== callingInstance &&
				resolverSelf.callingLocator.isApplied(locatorKey)
			) {
				return true;
			}
*/
			for (var i=0;i<resolverSelf.extendsLocators.length;i++) {
				if (
					resolverSelf.extendsLocators[i] !== callingInstance &&
					resolverSelf.extendsLocators[i].isApplied(locatorKey, resolverSelf)
				) {
					return true;
				}
			}

			return false;
//process.exit(1);
		}
		Resolver.prototype.resolveExtends = function (resolver, callback) {
			this.extendsLocators.push(resolver);
			resolver.callingLocator = this;
			return resolver.resolve(callback);
		}
		Resolver.prototype.resolve = function (callback) {
			var resolverSelf = this;
			var waitfor = WAITFOR.serial(function(err) {
				if (err) return callback(err);
				delete self._data['@extends'];
				return callback(null);
			});
			resolverSelf.locatorKeys.forEach(function(locatorKey, i) {

				return waitfor(function(callback) {

					if (resolverSelf.isApplied(locatorKey)) {
						console.log("Don't apply locator as already applied.", locatorKey);
						return callback(null);
					}

//		console.log("apply locatorKey", locatorKey);

					var locator = resolverSelf.getLocatorToApply(locatorKey);
					if (!locator) {
						return callback(null);
					}

					// Ensure locator is fully formed.
					if (!locator.location) {
						return callback(null);
					}

					var optional = /^!/.test(locator.location);
					if (optional) locator.location = locator.location.substring(1);
					if (/^\./.test(locator.location)) {
						locator.location = PATH.join(self._path, "..", locator.location);
					}

//console.log("locator", locator);

					if (/^\//.test(locator.location)) {
						var path = locator.location.replace(/(\/)\*(\.proto\.json)$/, "$1" + self.getProtoBasename() + "$2");
						return FS.exists(path, function(exists) {
							if (!exists) {
								if (optional || self._options.ignoreMissingExtends) {
									if (typeof self._options.ignoreMissingExtends === "function") {
										self._options.ignoreMissingExtends(path);
									}
									return callback(null);
								}
								return callback(new Error("Extends path '" + path + "' does not exist!"));
							}
							var opts = {};
							for (var name in self._options) {
								opts[name] = self._options[name];
							}
							opts["@args"] = locator["@args"] || null;

							opts.__extends_resolver = resolverSelf;

							if (!self._data['$provenance'][path]) {
								// TODO: Add '$depends' property.
								self._data['$provenance'][path] = {
									"locatorKey": locatorKey,
									"config": {
										"@args": opts["@args"] || {}
									}
								};
							} else
							if (opts["@args"]) {

console.log("May need to add to existing provenance", opts["@args"], " -> ", self._data['$provenance'][path]);	
process.exit(1);							
							}

							return exports.fromFile(self._proto, path, opts, function (err, descriptor) {
								if (err) return callback(err);

								function applyDescriptor (callback) {

									if (descriptor._data["@applicator"]) {
										if (!/^org\.pinf\.lib\/0\//.test(descriptor._data["@applicator"])) {
											return callback(new Error("'@applicator' in file must currently start with 'org.pinf.lib/0/'"));
										}
										// NOTE: We load it only when needed as it is not needed for simple/optimized core configs.
										// TODO: Use configurable integration plugin. Assuming 'org.pinf.genesis.lib' for now.
										return require.async('../api/' + descriptor._data["@applicator"].split("/").pop(), function (api) {

											return Q.when(api.for({
												Q: Q,
												DEEPMERGE: DEEPMERGE,
												WAITFOR: WAITFOR
											}), function (api) {

												if (typeof api.process !== "function") {
													return callback(new Error("Method 'process' not declared for applicator '" + descriptor._data["@applicator"] + "'"));
												}

												return Q.when(api.process({
													master: self._data,
													extends: descriptor._data
												}), function (data) {

//console.log("PACTHED", locatorKey, descriptor._data);

													self._data = data;
													return callback(null);
												}, callback);

											}, callback);
										}, callback);
									}

//console.log("MERGE USING", locatorKey);

									// NOTE: We override everything the extends sets.
									self._data = DEEPMERGE(descriptor._data, self._data);

									return callback(null);
								}

								return applyDescriptor(callback);
							});
						});
					} else {
						console.error("locator", locator);
						return callback(new Error("Locator with pattern '" + locator.location + "' not yet supported!"));
					}
				});
			});
			return waitfor();
		}

		if (!self._options.__extends_resolver) {

			self._options.__extends_resolver = new Resolver();

//console.log("NEW RESOLVER!!!");

			return self._options.__extends_resolver.resolve(callback);
		
		} else {

			return self._options.__extends_resolver.resolveExtends(new Resolver(), callback);
		}
	}

	function resolveTranslocations (callback) {

		return self.VARIABLES.replaceInObject(
			self._data,
			[
				{
					type: "@translocate"
				}
			]
		).then(function (data) {
			self._data = data;
			return callback(null);
		}).fail(callback);
/*

		if (!self._data.config) return callback(null);

		function resolveEnvironmentVariables (str) {
			var vars = {};
	        var re = /\{\{env\.([^\}]+)\}\}/g;
	        var m = null;
	        while (m = re.exec(str)) {
	        	if (typeof self._options.env[m[1]] !== "undefined") {
					str = str.replace(new RegExp(ESCAPE_REGEXP_COMPONENT(m[0]), "g"), self._options.env[m[1]]);
				}
	        }
	        return str;
		}

		var waitfor = WAITFOR.serial(callback);

		// TODO: Make this more generic.
		var uri = null;
		for (var configId in self._data.config) {
			uri = self._data.config[configId]['@translocate'] || null;
			if (!uri) continue;
			var optional = /^!/.test(uri);
			if (optional) uri = uri.substring(1);
			waitfor(configId, uri, function (configId, uri, callback) {
				uri = resolveEnvironmentVariables(uri);
				if (!/\//.test(uri)) {
					return callback(new Error("Translocation uri '" + uri + "' for config id '" + configId + "' not supported."));
				}
				return FS.exists(uri, function (exists) {
					if (!exists) {
						if (optional) {
							return callback(null);
						}
						return callback(new Error("Translocation uri '" + uri + "' for config id '" + configId + "' not found! To ignore missing file use '@translocate: !<path>'"));
					}
					var opts = {};
					for (var name in self._options) {
						opts[name] = self._options[name];
					}

					// We assume that all variables in the translocated section
					// could be resolved.
					// TODO: Specify which section we are interested in and throw if
					//       an ENV variable is missing.
					opts.ignoreMissingEnvironmentVariables = true;

					return exports.fromFile(self._proto, uri, opts, function (err, descriptor) {
						if (err) return callback(err);
						// This is always optional. i.e. we fail silently if nothing is found.
						if (
							descriptor._data.config &&
							descriptor._data.config[configId]
						) {
							// NOTE: The external descriptor always overrides our values!
							// TODO: Make this positional based on line in file.
							self._data.config[configId] = DEEPMERGE(self._data.config[configId], descriptor._data.config[configId]);
						}
						return callback(null);
					});
				});
			});
		}

		return waitfor();
*/
	}

	function applyOverlays (callback) {
/*
		if (self._data['overlays']) {
			console.error("DEPRECATED: Rename 'overlays' to '@overlays' in '" + self._path + "'!");
			self._data['@overlays'] = self._data['overlays'];
		}
		if (self._data['overrides']) {
			console.error("DEPRECATED: Rename 'overrides' to '@overlays' in '" + self._path + "'!");
			self._data['@overlays'] = self._data['overrides'];
		}
*/
		if (!self._data['@overlays']) {
			return callback(null);
		}
		var locators = self._data['@overlays'];
		var locatorKeys = Object.keys(locators);
		locatorKeys.reverse();
		delete self._data['@overlays'];

		var waitfor = WAITFOR.serial(function(err) {
			if (err) return callback(err);
			return callback(null);
		});
		locatorKeys.forEach(function(locatorKey, i) {
			return waitfor(function(callback) {
				var locator = locators[locatorKey];
				if (!locator) {
					return callback(null);
				}
				var optional = /^!/.test(locator);
				if (optional) locator = locator.substring(1);
				if (/^\./.test(locator)) {
					locator = PATH.join(self._path, "..", locator);
				}
				if (/^\//.test(locator)) {
					var path = locator.replace(/(\/)\*(\.proto\.json)$/, "$1" + self.getProtoBasename() + "$2");
					return FS.exists(path, function(exists) {
						if (!exists) {
							if (optional) {
								return callback(null);
							}
							console.log("self._data", self._data);
							console.log("locators", locators);
							console.log("locatorKey", locatorKey);
							console.log("locator", locator);
							console.log("self._path", self._path);
							return callback(new Error("Extends path '" + path + "' does not exist!"));
						}
						return exports.fromFile(self._proto, path, self._options, function (err, descriptor) {
							if (err) return callback(err);

							// NOTE: The overlay overrides everything we have.
							self._data = DEEPMERGE(self._data, descriptor._data);

							return callback(null);
						});
					});
				} else {

					// TODO: There should be a global option to see if we should do this.
					if (locator === "{{env.PIO_PROFILE_PATH}}") {
						optional = true;
					}

					if (optional) {
						return callback(null);
					}
					console.log("self._path", self._path);
					console.log("self._data", JSON.stringify(self._data, null, 4));
					return callback(new Error("Locator with pattern '" + locator + "' not yet supported!"));
				}
			});
		});
		return waitfor();
	}

	return applyInjections(function (err) {
		if (err) return callback(err);

		return resolveRelativeVariables(function (err) {
			if (err) return callback(err);

			return resolveExtends(function (err) {
				if (err) return callback(err);
				return resolveTranslocations(function (err) {
					if (err) return callback(err);
					return applyOverlays(callback);
				});
			});
		});
	});
}




// @source https://github.com/c9/architect/blob/567b7c034d7644a2cc0405817493b451b01975fa/architect.js#L332

exports.sortObjByDepends = function (services) {

    var plugins = [];
    var pluginsById = {};
    for (var serviceId in services) {
        pluginsById[serviceId] = {
            provides: [ serviceId ],
            consumes: (services[serviceId] && services[serviceId].depends) || [],
            id: serviceId
        }
        plugins.push(JSON.parse(JSON.stringify(pluginsById[serviceId])));
    }
    var resolved = {};
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
            sorted.push(plugin.id);
            changed = true;
        });
    }

    if (plugins.length) {
        var unresolved = {};
        plugins.forEach(function(plugin) {
            delete plugin.config;
            plugin.consumes.forEach(function(name) {
                if (unresolved[name] == false) {
                    return;
                }
                if (!unresolved[name]) {
console.log("unresolved", name, "for", plugin);
                    unresolved[name] = [];
                }
                unresolved[name].push(plugin.id);
            });
            plugin.provides.forEach(function(name) {
                unresolved[name] = false;
            });
        });

        Object.keys(unresolved).forEach(function(name) {
            if (unresolved[name] == false)
                delete unresolved[name];
        });

        console.error("services", Object.keys(services).length, services);
        console.error("Could not resolve dependencies of these plugins:", plugins);
        console.error("Resolved services:", Object.keys(resolved));
        console.error("Missing services:", unresolved);
        console.log("NOTICE: Did you declare '" + Object.keys(unresolved) + "' in 'services' config?");

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
        Object.keys(unresolved).forEach(function (pkgId) {
            showChildHierarchy(pkgId, pluginsById[pkgId]);
        });

        throw new Error("Could not resolve dependencies");
    }
    return sorted;
}


