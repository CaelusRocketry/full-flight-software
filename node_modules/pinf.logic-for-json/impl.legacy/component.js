
const Q = require("q");
const JSONPATH = require("JSONPath");


exports.for = function (API) {

	var exports = {};

	exports.findImplementationForNamespace = function (name) {

		function findPackageSourceInfo (name) {
			var nameParts = name.split("/");
			var packageSourceInfo = null;
			var path = null;

			if (
				nameParts.length === 3 &&
				// TODO: Try and match major versioned package using 'nameParts[2]'.
				(path = API.PATH.join(API.getRootPath(), "../node_modules", nameParts[0])) && 
				API.FS.existsSync(path)
			) {
				packageSourceInfo = {
					path: path,
					api: nameParts[1]
				};
			} else
			if (
				(path = API.PATH.join(API.getPackagesDirpath(), name.replace(/\//g, "~") + "/source/installed/master")) &&
				API.FS.existsSync(path)
			) {
				packageSourceInfo = {
					path: path
				};
			}
			return packageSourceInfo;
		}

		var packageSourceInfo = findPackageSourceInfo(name);

		if (!packageSourceInfo) {
			// TODO: Dynamically download plugins.
			console.error("name", name);
			var err = new Error("Plugin '" + name + "' could not be found!");
			err.code = 404;
			return Q.reject(err);
		}

		var deferred = Q.defer();

		API.PACKAGE.fromFile(API.PATH.join(packageSourceInfo.path, "package.json"), function (err, pluginDescriptor) {

			if (err) return deferred.reject(err);
			pluginDescriptor = pluginDescriptor._data;

			var implPath = null;
			if (packageSourceInfo.api) {

				if (
					!pluginDescriptor.config ||
					!pluginDescriptor.config['org.pinf.genesis.lib/0'] ||
					!pluginDescriptor.config['org.pinf.genesis.lib/0'].api ||
					!pluginDescriptor.config['org.pinf.genesis.lib/0'].api.provides ||
					!pluginDescriptor.config['org.pinf.genesis.lib/0'].api.provides[packageSourceInfo.api]
				) {
					return deferred.reject(new Error("API '" + packageSourceInfo.api + "' not declared at 'config[org.pinf.genesis.lib/0].api[" + packageSourceInfo.api + "]' in package descriptor: " + API.PATH.join(packageSourceInfo.path, "package.json")));
				}
				implPath = API.PATH.join(packageSourceInfo.path, pluginDescriptor.config['org.pinf.genesis.lib/0'].api.provides[packageSourceInfo.api]);
			} else {
				implPath = API.PATH.join(packageSourceInfo.path, pluginDescriptor.main || "");
			}

			return deferred.resolve(implPath);
		});
		return deferred.promise;
	}

	exports.instanciateImplementations = function (restingConfig, groupConfig) {

		var liveConfig = API.EXTEND(false, {}, restingConfig);

		var match = JSONPATH({
			json: liveConfig,
			path: "$..@impl",
			resultType: 'all'
		});


		if (match.length === 0) {
			return Q.resolve(restingConfig);
		}

		return Q.all(match.map(function(match) {

			return Q.fcall(function () {

				if (typeof match.parent[match.parentProperty] !== "string") {
					return exports.unfreezeConfig(match.parent[match.parentProperty]).then(function (config) {
						API.EXTEND(false, match.parent[match.parentProperty], config);
					});
				}

				match.parent[match.parentProperty] = {};

				var config = {};
/*
				var subGroupConfig = groupConfig;
				if (restingConfig === groupConfig) {
					var subGroupConfigMatch = JSONPATH({
						json: subGroupConfig,
						path: match.path.replace(/\['@impl'\]$/, ""),
						resultType: 'all'
					});
					subGroupConfig = subGroupConfigMatch[0].value;
					config[match.value] = subGroupConfig;
				} else {
*/					
					config[match.value] = {};
//				}

//console.log("MATCH", match);
//console.log("SEGMENTS", match.path.split("]["));
//console.log("liveConfig", liveConfig);

// TODO: Provide `groupConfig` -> `siblingConfig` and `inheritedSiblingConfig`

				var pathSegments = match.path.split("][");
				pathSegments.pop();
				var configMatch = JSONPATH({
					json: liveConfig,
					path: pathSegments.join("][") + "]",
					resultType: 'all'
				});
				config[match.value] = configMatch[0].value;

				return exports.instanciateConfig(config, groupConfig).then(function (config) {

					API.EXTEND(false, match.parent[match.parentProperty], config);

				});

			}).fail(function (err) {
				if (err.code === 404) {
					API.console.warn("WARNING: " + err.stack.replace(/^Error: /, "").split("\n").slice(0, 3).join("; "));
					return;
				}
				throw err;
			});

		})).then(function () {
			return liveConfig;
		});
	}

	exports.instanciateComponentAt = function (config, name, implPath, groupConfig) {
		return Q.fcall(function () {

			// POLICY: An 'Implementation' is executable 'Source Logic'
			var impl = require(implPath);

			if (typeof impl.for !== "function") {
				// POLICY: A 'Module' is an instanciated 'Implementation'.
				throw new Error("Module for '" + implPath + "' must export 'for' function!");
			}

			API._NO_INIT_PLComponent = true;

			return Q.when(impl.for(API)).then(function (component) {

				// TODO: Use schema to optionally validate 'component' api.
				if (typeof component.PLComponent !== "function") {
					console.log("impl.for", impl.for);
					console.log("component", component);
					// POLICY: A 'Component' is a contextualized 'Module'.
					throw new Error("Component at '" + implPath + "' must export 'PLComponent' function!");
				}

//console.log("instanciateComponentAt", config, name, implPath, groupConfig);

				return exports.instanciateImplementations(config[name], groupConfig).then(function (liveConfig) {

					return Q.when(component.PLComponent(liveConfig, groupConfig)).then(function (components) {

						API.EXTEND(false, config, components);

						// Only delete declared config, not instanciated object.
						if (!/^\$/.test(name)) {
							delete config[name];
						}
					});
				});
			});

		}).then(function () {
			return config;
		});
	}

	exports.instanciateConfig = function (config, groupConfig) {
		var done = Q.resolve();

//console.log("instanciateConfig", config, groupConfig);

		// TODO: Load dependency rules from descriptors and resolve in correct order
		//       vs relying on declared JSON object order.
		Object.keys(config).forEach(function (name) {
			if (
				!/^[^\.\$]+\.[^\/]+\//.test(name)
			) {
//console.log("instanciateImplementations", name);
				done = Q.when(done, function () {
//					return exports.instanciateImplementations(config, config).then(function (liveConfig) {
					return exports.instanciateImplementations(config, groupConfig).then(function (liveConfig) {
						config = liveConfig;
					});
				});
				return;
			}

			done = Q.when(done, function () {
//console.log("findImplementationForNamespace", name);
				return exports.findImplementationForNamespace(name).then(function (implPath) {

					return exports.instanciateComponentAt(config, name, implPath, groupConfig || config).then(function (_config) {
						config = _config;
					});
				});
			});
		});
		return done.then(function () {
			return config;
		});
	}

	exports.unfreezeConfig = function (config) {
		var done = Q.resolve();

//console.log("UNFREEZE unfreezeConfig", config);

		Object.keys(config).forEach(function (name) {

//console.log("NAME", name, config[name]);

			if (!config[name].$PLComponent) {
//console.log("NOT FOUND");
				var match = JSONPATH({
					json: config[name],
					path: "$..$PLComponent",
					resultType: 'all'
				});

				if (match.length === 0) return;

throw new Error("TODO: Implement loading of sub-components");
/*
				match.forEach(function (match) {

console.log("UNFREEZE", match);

					var implNamespace = match.value;


					var pathSegments = match.path.split("][");
					pathSegments.pop();
					var configMatch = JSONPATH({
						json: config,
						path: pathSegments.join("][") + "]",
						resultType: 'all'
					});
console.log("configMatch", configMatch);

					configMatch.forEach(function (configMatch) {

						done = Q.when(done, function () {
							return exports.findImplementationForNamespace(implNamespace).then(function (implPath) {


								return exports.instanciateComponentAt(configMatch.parent, configMatch.parentProperty, implPath, config).then(function (_config) {

console.log("NEW CONFIG", _config);

console.log("config[name]", name, config[name]);


if (pathSegments.length > 1) {


} else {
//	config = 
}


process.exit(1);

//									config = _config;
								});
							});
						});
					});


				});
*/
				return;
			}

			done = Q.when(done, function () {
				return exports.findImplementationForNamespace(config[name].$PLComponent).then(function (implPath) {
					return exports.instanciateComponentAt(config, name, implPath, config).then(function (_config) {
						config = _config;
					});
				});
			});
		});
		return done.then(function () {
			return config;
		});

	}

	return exports;
}

