
const ASSERT = require("assert");
const Q = require("q");
const FS = require("fs-extra");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");
const JSONPATH = require("JSONPath");
const DEEPMERGE = require("deepmerge");


exports.for = function (API) {

	var exports = {};

	exports.replaceInObject = function (obj, rules) {

		var objString = JSON.stringify(obj);

		function parseForMatches (objString, match) {
			var vars = {};
	        var m = null;
	        while (m = match.exec(objString)) {
	        	vars[m[2]] = {
	        		pointer: m[1] + m[2],
	        		matched: m[0]
	        	};
	        	if (/^!/.test(vars[m[2]].pointer)) {
	        		vars[m[2]].pointer = vars[m[2]].pointer.substring(1);
	        		vars[m[2]].optional = true;
	        	}
	        }
	        return vars;
		}

		function replaceValue (lookup, value, mode) {
			function replace (value) {
				var lookupRe = null;
				if (mode === "InjectObject") {
					// TODO: Make sure there are no key collisions
					//       in the object we are injecting into. We need a better JSON parser for this.
					value = JSON.stringify(value).replace(/(^\{|\}$)/g, "");
					if (!value || /^\s+$/.test(value)) {
						value = "";
						lookupRe = new RegExp(ESCAPE_REGEXP_COMPONENT(lookup) + "[^,]*,", "g");
					}
				} else
				if (
					typeof value === "object" ||
					Array.isArray(value)
				) {
					lookup = '"' + lookup + '"';
					value = JSON.stringify(value);
				}
				if (!lookupRe) {
					lookupRe = new RegExp(ESCAPE_REGEXP_COMPONENT(lookup), "g");
				}
				objString = objString.replace(
					lookupRe,
					value
				);
			}
			if (Q.isPromise(value)) {
				return value.then(replace);
			} else {
				return Q.resolve(replace(value));
			}
		}

		function replace_Inject (rule) {

			// "@inject": "{{$.@args.records}}",
			function injectJSONAtPath () {
				var vars = parseForMatches(
					objString,
					/"@inject"[^\/]"(!?)(\/[^\"]+)"/g
				);

				var varNames = Object.keys(vars);
				if (varNames.length === 0) {
					return Q.resolve();
				}
				return Q.all(varNames.map(function (varName) {
					if (!FS.existsSync(vars[varName].pointer)) {
						if (!vars[varName].optional) {
							throw new Error("Injected path '" + vars[varName].pointer + "' not found!");
						}
						return;
					}

					function loadFile (uri) {
						return Q.denodeify(function (callback) {
							return API.fromFile(uri, {
								// We assume that all variables in the translocated section
								// could be resolved.
								// TODO: Specify which section we are interested in and throw if
								//       an ENV variable is missing.
								ignoreMissingEnvironmentVariables: true
							}, callback);
						})();
					}

					return loadFile(vars[varName].pointer).then(function (descriptor) {
						return replaceValue(
							vars[varName].matched,
							descriptor._data,
							"InjectObject"
						);
					});
				}));
			}

			function injectObjectAtPointer () {
				var vars = parseForMatches(
					objString,
					/"@inject"[^\{]+\{\{(\$\.)([^\}]+)\}\}"/g
				);

				var varNames = Object.keys(vars);
				if (varNames.length === 0) {
					return Q.resolve();
				}

				return Q.all(varNames.map(function (varName) {
					var match = JSONPATH({
						json: JSON.parse(objString),
						path: vars[varName].pointer,
						resultType: 'all'
					});
					if (match.length === 0) {
						console.error("obj", obj);
						throw new Error("Could not match '" + vars[varName].pointer + "'!");
					}
					return replaceValue(
						vars[varName].matched,
						match[0].value,
						"InjectObject"
					);
				}));
			}

			return injectJSONAtPath().then(function () {
				return injectObjectAtPointer();
			});
		}

		function replace_JSONPathVariables (rule) {

			var vars = parseForMatches(
				objString,
				/\{\{(\$\.)([^\}]+)\}\}/g
			);

			var varNames = Object.keys(vars);
			if (varNames.length === 0) {
				return;
			}

			return Q.all(varNames.map(function (varName) {
				var match = JSONPATH({
					json: JSON.parse(objString),
					path: vars[varName].pointer,
					resultType: 'all'
				});
				if (match.length === 0) {
					console.error("obj", obj);
					throw new Error("Could not match '" + vars[varName].pointer + "'!");
				}
				return replaceValue(
					vars[varName].matched,
					match[0].value
				);
			}));
		}

		function replace_Translocate (rule) {

			obj = JSON.parse(objString);

			var match = JSONPATH({
				json: obj,
				path: "$..['@translocate']",
				resultType: 'all'
			});

			return Q.all(match.map(function (match) {

				var uri = match.value;
				if (!uri) return Q.resolve();

				var optional = /^!/.test(uri);
				if (optional) uri = uri.substring(1);

				if (!/\//.test(uri)) {
					return Q.reject(new Error("Translocation uri '" + uri + "' for config node '" + match.path + "' not supported."));
				}

				return Q.denodeify(function (callback) {

					return FS.exists(uri, function (exists) {
						if (!exists) {
							if (optional) {
								return callback(null);
							}
							return callback(new Error("Translocation uri '" + uri + "' for config node '" + match.path + "' not found! To ignore missing file use '@translocate: !<path>'"));
						}

						return API.fromFile(uri, {

							// We assume that all variables in the translocated section
							// could be resolved.
							// TODO: Specify which section we are interested in and throw if
							//       an ENV variable is missing.
							ignoreMissingEnvironmentVariables: true

						}, function (err, descriptor) {
							if (err) return callback(err);

							// This is always optional. i.e. we fail silently if nothing is found.

							var lookupPath = match.path.replace(/\['@translocate'\]$/, "");

							// TODO: Fix this in JSONPath so we get segments back wrapped in '[""]'
							// $@github.com~sourcemint~sm.expand~0/map
							var m = lookupPath.match(/^\$(@.+)$/);
							if (m) {

								if (descriptor._data[m[1]]) {
									// NOTE: The external descriptor always overrides our values!
									// TODO: Make this positional based on line in file.
									obj[m[1]] = DEEPMERGE(
										obj[m[1]] || {},
										descriptor._data[m[1]]
									);
								}
								if (obj[m[1]]) {
									delete obj[m[1]]["@translocate"];
								}

							} else {

								var newMatch = JSONPATH({
									json: descriptor._data,
									path: lookupPath,
									resultType: 'all'
								});

								if (newMatch.length === 1) {

									var parentNode = JSONPATH({
										json: obj,
										path: match.path.replace(/\['@translocate'\]$/, ""),
										resultType: 'all'
									})[0];

									// NOTE: The external descriptor always overrides our values!
									// TODO: Make this positional based on line in file.
									parentNode.parent[parentNode.parentProperty] = DEEPMERGE(
										parentNode.parent[parentNode.parentProperty],
										newMatch[0].value
									);

									delete parentNode.parent[parentNode.parentProperty]["@translocate"];
								}
							}

							return callback(null);
						});
					});
				})();
			})).then(function () {

				objString = JSON.stringify(obj);
			});
		}

		function replace_RegExp (rule) {

			ASSERT(typeof rule.match !== "undefined");
			ASSERT(typeof rule.vars, "object");

			var vars = parseForMatches(objString, rule.match);

			var varNames = Object.keys(vars);
			if (varNames.length === 0) {
				return;
			}

			return Q.all(varNames.map(function (varName) {

				if (typeof rule.vars[varName] === "undefined") {
					throw new Error("Argument with name '" + varName + "' not found!");
				}

				return replaceValue(
					vars[varName].matched,
					rule.vars[varName]
				);
			}));	
		}

		var done = Q.resolve();
		rules.forEach(function (rule) {
			done = Q.when(done, function () {
				if (rule.type === "@inject") {
					return replace_Inject(rule);
				} else
				if (rule.type === "@translocate") {
					return replace_Translocate(rule);
				} else
				if (rule.type === "JSONPathVariables") {
					return replace_JSONPathVariables(rule);
				} else
				if (rule.type === "RegExp") {
					return replace_RegExp(rule);
				} else {
					throw new Error("Rule with type '" + rule.type + "' not supported!");
				}
			});
		});
		return done.then(function () {
			try {
				return JSON.parse(objString);
			} catch (err) {
				err.message += " (while after replacing variables!)";
				err.stack += "\n(while after replacing variables!)";
				throw err;
			}
		});
	}

	return exports;
}

