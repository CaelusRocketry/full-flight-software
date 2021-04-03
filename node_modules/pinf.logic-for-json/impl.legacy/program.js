
const Q = require("q");
const PATH = require("path");
const DESCRIPTOR = require("./descriptor");
const LOCATOR = require("./locator");
const DEEPMERGE = require("deepmerge");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");
const PACKAGE = require("./package");
const JSONPATH = require("JSONPath");
const EXTEND = require("extend");



exports.fromFile = function (API, path, options, callback) {
	return DESCRIPTOR.fromFile(forAPI(API).ProgramDescriptor, path, options, callback);
}


function forAPI (API) {

	var ProgramDescriptor = function (path, data, options) {
		DESCRIPTOR.Descriptor.prototype.constructor.call(this, ProgramDescriptor, path, data, options);
	}
	ProgramDescriptor.type = "ProgramDescriptor";
	ProgramDescriptor.prototype = Object.create(DESCRIPTOR.Descriptor.prototype);

	ProgramDescriptor.prototype.isBootable = function () {
		return !!this._data.boot;
	}

	ProgramDescriptor.prototype.configForLocator = function (locator, options) {
		var self = this;
		options = options || {};
		function finalize (configId, alias) {
			var config = null;
			var configRef = null;
			if (options.includeId) {
				config = Object.create({
					$context: configId
				});
				if (alias) {
					configRef = self._data.config[configId].$to[alias];
					for (var name in self._data.config[configId].$to[alias]) {
						config[name] = self._data.config[configId].$to[alias][name];
					}
					config.$to = alias;
				} else {
					configRef = self._data.config[configId];
					for (var name in self._data.config[configId]) {
						config[name] = self._data.config[configId][name];
					}
				}
			} else {
				if (alias) {
					configRef = self._data.config[configId].$to[alias];
					config = self._data.config[configId].$to[alias];
					config.$to = alias;
				} else {
					configRef = self._data.config[configId];
					config = self._data.config[configId];
				}
			}

			if (config.$overlay) {
				// When an '$overlay' is encountered we merge it on top of our config structure.
				// NOTE: This will effect everyone using this config from now on. i.e. it is a
				//       time-forward adjustment. If a prestine config is needed, re-init it.

				API.console.debug("Merge injection", config.$overlay);

				if (config.$overlay.mappings) {
					throw new Error("Injected config may NOT contain 'mappings' property! Its too late for that. We can only manipulate config from now on.");
				}
				if (!config.$overlay.config) {
					throw new Error("Injected config MUST contain 'config' property!");
				}

				var overlayConfig = config.$overlay.config;

				delete configRef.$overlay;
				API.EXTEND(true, self._data.config, overlayConfig);

				// NOTE: We do lookup again as merge above may have added more properties for ourselves.
				return finalize (configId, alias);
			}
			return config;
		}

		var configId = locator.getConfigId();
		var alias = locator.getAlias();
		if (
			alias ||
			!self._data ||
			!self._data.config ||
			!self._data.config[configId]
		) {
			if (!/^x/.test(configId)) {
				return false;
			}
			if (alias) {
				for (var id in self._data.config) {
					// TODO: Match trailing version as well.
					if (self._data.config[id].$to === alias) {
						return finalize(id);
					} else
					if (typeof self._data.config[id].$to === "object") {
						for (var to in self._data.config[id].$to) {
							if (to === alias) {
								return finalize(id, alias);
							}
						}
					}
				}
			}
			return false;
		}
		return finalize(configId);
	}

	ProgramDescriptor.prototype.locatorForDeclaration = function (declaration) {
		var locator = LOCATOR.fromDeclaration(declaration);
		locator.setBasePath(PATH.dirname(this._path));
		return locator;
	}

	ProgramDescriptor.prototype.overlayConfig = function (config) {
		// TODO: Track different config layers separately.
		if (!config) {
			return;
		}
		this._data.config = DEEPMERGE(this._data.config, config);
	}

	ProgramDescriptor.prototype.parsedConfigForLocator = function (locator) {
		var self = this;
		var programDescriptorSelf = self;
		var config = self.configForLocator(locator, {
			includeId: true
		});
		if (!config) return null;

		function getUsingFrom (config) {
			var from = {};
	        var re = /\{\{\$from\.([^\.\[]+)([^\}]+)\}\}/g;
	        var m = null;
	        while (m = re.exec(JSON.stringify(config))) {
	        	if (!from[m[1]]) {
	        		from[m[1]] = {};
	        	}
	        	from[m[1]][m[2]] = m[0];
	        }
	        if (
	        	config.$depends &&
	        	Array.isArray(config.$depends)
	       	) {
	       		config.$depends.forEach(function (name) {
	       			if (!from[name]) {
			        	from[name] = {};
	       			}
	       		});
	        }
	        return from;
		}

		function getFunctions (config) {
			var functions = {};
	        var re = /\{\{([^\}\)]+)\(([^\)]*)\)\}\}/g;
	        var m = null;
	        while (m = re.exec(JSON.stringify(config))) {
	        	functions[m[1]] = {
	        		arg: m[2] || null,
	        		matched: m[0]
	        	};
	        }
	        return functions;
		}
	/*
		function getEnvironmentVariables (config) {
			var vars = {};
	        var re = /\{\{env\.([^\}]+)\}\}/g;
	        var m = null;
	        while (m = re.exec(JSON.stringify(config))) {
	        	vars[m[1]] = m[0];
	        }
	        return vars;
		}
	*/
		var Config = function (context, id, config) {		
			this.$context = context;
			this.id = id;
			this.depends = getUsingFrom(config);
			this.functions = null;//getFunctions(config);
	//		this.envs = getEnvironmentVariables(config);
			this.config = config;
//			if (!this.config.$to) {
//				throw new Error("Config variable '$to' must be declared for config context '" + this.id + "'");
//			}
		}
		Config.prototype.setResolved = function (resolvedConfig) {
			this._resolvedConfig = resolvedConfig;
		}
		Config.prototype.resolve = function (api) {
			var self = this;

	//console.log("original", self.config);

			var configString = JSON.stringify(self.config);

			function resolveVariables () {
	/*
				for (var name in self.envs) {
					// TODO: Fire event to handlers to promt for variable or load it from profile/credentials.
					if (!process.env[name]) {
						throw new Error("Environment variable '" + name + "' is not set!");
					}
					configString = configString.replace(new RegExp(ESCAPE_REGEXP_COMPONENT(self.envs[name]), "g"), process.env[name]);
				}
	*/
				var done = Q.resolve();
				for (var from in self.depends) {
					for (var name in self.depends[from]) {
						function resolveVariable (from, name) {
							if (
								!self._resolvedConfig ||
								!self._resolvedConfig[from]
							) {
								return Q.reject(new Error("Config variable '" + from + "' group not exported prior to using it!"));
							}
							function findValue (values, pointer) {

								var match = JSONPATH({
									json: values,
									path: "$" + pointer.replace(/^\[/, ".["),
									resultType: 'all'
								});

								if (match.length === 0) {
									console.error("values", JSON.stringify(values, null, 4));

console.log("self.depends", self.depends);

console.log("POINTER", "$" + pointer.replace(/^\[/, ".["));

console.log(new Error("handle functions: " + pointer).stack);
process.exit(1);
									throw new Error("Pointer '" + ("$" + pointer) + "' not found in values!");
								}

								return match[0].value;
/*

								// TODO: Use JSON PATH to find vars.
								var pointerParts = pointer.split(".");
								var segment = null;
								while (pointerParts.length > 0) {
									segment = pointerParts.shift();

									// Deal with path segment containing ".". e.g. 'programs['.pgs'].getRuntimeConfigFor'
									// Also "profile.credentials['dnsimple.com']"
									var index = 0;
									if ((index = segment.indexOf("[")) > 0) {
										pointerParts[0] = segment.substring(index) + "." + pointerParts[0];
										segment = segment.substring(0, index);
									} else
									if ((index = segment.indexOf("]")) > -1) {
										if (pointerParts.lenth > 0) {
											pointerParts[0] = segment.substring(index + 1) + pointerParts[0];
										}
										segment = segment.substring(0, index + 1);
									}

									var m = segment.match(/^\[(["'])([^'"]+)(["'])\]$/);
									if (m && m[1] === m[3]) {
										segment = m[2];
									}

									// Deal with funcitons. e.g 'getRuntimeConfigFor(pgs-expand)'
									m = segment.match(/^([^\(]+)\(([^\)]+)\)$/);
									if (m) {
										if (typeof values[m[1]] !== "function") {
											throw new Error("Property in config for name '" + m[1] + "' is not a function! Don't reference it as a funciton using '" + pointer + "' or declare a function.");
										}
										function findInSub (m, segment, subPointer) {
											return Q.when(values[m[1]](m[2])).then(function (values) {
												return Q.when(findValue(values, subPointer));
											});
										};

										return findInSub(m, segment, pointerParts.join("."));
									} else {
										if (!values[segment]) {
											return;
										}
										values = values[segment];
									}
								}
								return values;
*/
							}

							var value = null;

							try {
								value = findValue(self._resolvedConfig[from], name);
							} catch (err) {
								err.message += " (Config variable " + self.depends[from][name] + " not exported by '" + from + "' prior to using it!)";
								err.stack += "\n(Config variable " + self.depends[from][name] + " not exported by '" + from + "' prior to using it!)";
								return Q.reject(err);
							}

							if (typeof value === "undefined") {
								return Q.reject(new Error("Config variable " + self.depends[from][name] + " not exported by '" + from + "' prior to using it!"));
							}

							function replaceValue (value) {
								var lookup = self.depends[from][name];
								if (
									typeof value === "object" ||
									Array.isArray(value)
								) {
									lookup = '"' + lookup + '"';
									value = JSON.stringify(value);
								}
								configString = configString.replace(new RegExp(ESCAPE_REGEXP_COMPONENT(lookup), "g"), value);
							}

							if (Q.isPromise(value)) {
								done = Q.when(done, function () {
									return value.then(replaceValue);
								});
							} else {
								replaceValue(value);
							}
						}

						resolveVariable(from, name);
					}
				}
				return done;
			}

			function resolveFunctions () {
				if (!api) return Q.resolve();

				var partiallyResolvedConfig = JSON.parse(configString);

				return Q.all(Object.keys(self.functions).map(function (funcName) {
					var func = null;
					if (!api[funcName]) {
						// TODO: Use a whole bunch of generic functions declared by other plugins prior.
//						if (funcName === "topLevelDomainFromHostname") {
//						} else {
							throw new Error("Function '" + funcName + "' is not declared in api! Plugin '" + self.id + "' must provide this function when calling `config.resolve(api)`.");
//						}
					} else {
						func = api[funcName];
					}
					return Q.when(func(partiallyResolvedConfig, self.functions[funcName].arg || null)).then(function (value) {

						var lookup = self.functions[funcName].matched;
						if (
							typeof value === "object" ||
							Array.isArray(value)
						) {
							lookup = '"' + lookup + '"';
							value = JSON.stringify(value);
						}

						configString = configString.replace(new RegExp(ESCAPE_REGEXP_COMPONENT(lookup), "g"), value);
					});
				}));
			}

			function resolveNamespaces (config) {
				return API.COMPONENT.for(API).instanciateConfig(config);
			}

			return resolveVariables().then(function () {

				// We do this here instead of above in case variables being passed to
				// functions were replaced.
				self.functions = getFunctions(config);

				return resolveFunctions();
			}).then(function () {

	//console.log("resolved", JSON.parse(configString));
				var config = null;
				try {
					config = JSON.parse(configString);
				} catch (err) {
					process.stdout.write(configString);
					err.message += " (while parsing combined descriptor)";
					err.stack += "\n(while parsing combined descriptor)";
					throw err;
				}

				config.$context = self.$context;
				return config;
			}).then(function (config) {
				return resolveNamespaces(config);
			}).then(function (config) {
				self.config = config;
				return self.unfreeze();
			});
		}
		Config.prototype.unfreeze = function () {
			var self = this;
			return API.COMPONENT.for(API).unfreezeConfig(self.config).then(function (config) {
				return self.config = config;
			});
		}

		return new Config(config.$context, config.$to, config);
	}

	ProgramDescriptor.prototype.resolvePath = function (arg) {
		if (/^\./.test(arg)) {
			return PATH.join.apply(null, [this._path, ".."].concat(Array.prototype.slice.call(arguments)));
		} else
		if (/^\//.test(arg)) {
			return PATH.join.apply(null, Array.prototype.slice.call(arguments));
		} else {
			throw new Error("Unable to resolve path starting with: " + arg);
		}
	}

	ProgramDescriptor.prototype.getBootPackagePath = function () {
		if (
			!this._data.boot ||
			!this._data.boot.package
		) {
	//		console.error("this._data", this._data);
			throw new Error("No 'boot.package' declared in program descriptor '" + this._path + "'!");
		}
		var descriptorPath = this.resolvePath(this._data.boot.package);
		return PATH.dirname(descriptorPath);
	}

	ProgramDescriptor.prototype.getBootPackageDescriptorPath = function () {
		var self = this;
		return PATH.join(self.getBootPackagePath(), "package.json");
	}

	ProgramDescriptor.prototype.getBootPackageDescriptor = function () {
		var self = this;
		return Q.fcall(function () {
			return Q.denodeify(PACKAGE.fromFile)(self.getBootPackageDescriptorPath());
		});
	}

	return {
		ProgramDescriptor: ProgramDescriptor
	};
}
