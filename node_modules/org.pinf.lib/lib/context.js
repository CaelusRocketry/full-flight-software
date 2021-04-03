
const EVENTS = require("events");
const Q = require("q");
Q.Throttle = require("q-throttle/q-throttle").Throttle;


// TODO: Re-use pinf context logic once refined sufficiently.
var Context = exports.Context = function (API, rootPath, declaringRootPath) {
	var self = this;

	var DEFAULT_API = {
		SINGLETONS: {},
		VERBOSE: false,
		DEBUG: false,
		REQUIRE_ASYNC: require("require.async"),
		ASSERT: require("assert"),
		PATH: require("path"),
		FS: require("fs-extra"),
		Q: Q,
		QFS: require("q-io/fs"),
		EXTEND: require("extend"),
		ESCAPE_REGEXP_COMPONENT: require("escape-regexp-component"),
		EVENTS: EVENTS,
		SPAWN: require("child_process").spawn,
		EXEC: require("child_process").exec,
		CRYPTO: require("crypto"),
		COMMANDER: require("commander"),
		WAITFOR: require("waitfor"),
		DEEPMERGE: require("deepmerge"),
		CHANGESET: require("changeset"),
		FSWALKER: require("pinf-it-filetree-insight/fswalker"),
		REQUEST: require("request"),
		DESCRIPTOR: require("./descriptor"),
		PACKAGE: require("./package"),
		PROGRAM: require("./program"),
		LOCATOR: require("./locator"),
		COMPONENT: require("./component")
	};

	for (var name in DEFAULT_API) {
		self[name] = DEFAULT_API[name];
	}
	for (var name in API) {
		self[name] = API[name];
	}

	self.promisify = function (impl, callback) {
		var self = this;
		return self.Q.denodeify(function (callback) {
			return impl(callback);
		})().then(function (arg) {
			if (!callback) return;
			return callback(null, arg);
		}, function (err) {
			if (!callback) return;
			return callback(err);
		});
	}

	self.getDeclaringRootPath = function () {
		return declaringRootPath;
	}
	self.getDeclaringPathId = function () {
		return null;
	}
	self.getDeclaringConfig = function () {
		return null;
	}
	self.getRootPath = function () {
		return rootPath;
	}
	self.sub = function (rootPath, _api) {
		_api = _api || {};
		var api = null;
		if (rootPath) {
			api = new Context(
				self,
				rootPath,
				self.getRootPath()
			);
		} else {
			api = new Context(
				self,
				self.getRootPath(),
				self.getDeclaringRootPath()
			);
		}
		if (self.sub._api) {
			for (var name in self.sub._api) {
				_api[name] = self.sub._api[name];
			}
		}
		api.sub._api = _api;
		for (var name in _api) {
			api[name] = _api[name];
		}
		if (rootPath) {
			delete api.programDescriptor;
		}
		return api;
	}
	function formatLogArgs (args) {
		var allStrings = true;
		args.forEach(function (arg) {
			if (!allStrings) return;
			if (typeof arg !== "string") {
				allStrings = false;
			}
		});
		if (allStrings) {
			return args.join(" ");
		}
		return (args.length > 1 ? args : args[0]);
	}
	self.console = {
		log: function () {
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "log", formatLogArgs(args));
		},
		error: function () {
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "error", formatLogArgs(args));
		},
		warn: function () {
			if (!self.VERBOSE) return;
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "info", formatLogArgs(args));
		},
		verbose: function () {
			if (!self.VERBOSE) return;
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "info", formatLogArgs(args));
		},
		debug: function () {
			if (!self.DEBUG) return;
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "debug", formatLogArgs(args));
		}
	}
	self.insight = {
		log: function () {
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "log", formatLogArgs(args));
		},
		error: function () {
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "error", formatLogArgs(args));
		},
		warn: function () {
			if (!self.VERBOSE) return;
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "info", formatLogArgs(args));
		},
		verbose: function () {
			if (!self.VERBOSE) return;
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "info", formatLogArgs(args));
		},
		debug: function () {
			if (!self.DEBUG) return;
			var args = Array.prototype.slice.call(arguments);
			self.LOGGER.log.call(self.LOGGER, "debug", formatLogArgs(args));
		}
	}
	self.getProgramDescriptorPath = function () {
		return rootPath;
	}
	self.loadProgramDescriptor = function (callback) {
		var programDescriptorPath = self.getProgramDescriptorPath();
    	self.console.verbose("Load program descriptor:", programDescriptorPath);

		return self.FS.exists(programDescriptorPath, function (exists) {
			if (!exists) {
				return callback("ERROR: No program descriptor found at: " + programDescriptorPath);
			}
			return self.PROGRAM.fromFile(self, programDescriptorPath, function (err, programDescriptor) {
				if (err) return callback(err);

				programDescriptor.overlayConfig(self.getDeclaringConfig());

				return callback(null, programDescriptor);
			});
		});
	}
	self.getPGSRootPath = function () {
		return self.PATH.join(rootPath, "..", ".pgs");
	}
	self.getPINFProgramProtoDescriptorPath = function () {
		return self.PATH.join(rootPath, "..", "PINF.proto.json");
	}
	self.loadPINFProgramProtoDescriptor = function (callback) {
		var programDescriptorPath = self.getPINFProgramProtoDescriptorPath();
    	self.console.verbose("Load program proto descriptor:", programDescriptorPath);

		return self.FS.exists(programDescriptorPath, function (exists) {
			if (!exists) {
				return callback("ERROR: No PINF proto descriptor found at: " + programDescriptorPath);
			}
			return self.PROGRAM.fromFile(self, programDescriptorPath, function (err, programDescriptor) {
				if (err) return callback(err);

				programDescriptor.overlayConfig(self.getDeclaringConfig());

				return callback(null, programDescriptor);
			});
		});
	}
	self.runCommands = function (commands, options, callback) {
		if (typeof options === "function" && typeof callback === "undefined") {
			callback = options;
			options = {};
		}
		options = options || {};
		options.cwd = options.cwd || self.PATH.dirname(rootPath);
    	self.console.debug("Run commands:", commands, {
    		cwd: options.cwd
    	});
    	var env = process.env;
    	if (options.env) {
    		for (var name in options.env) {
    			env[name] = options.env[name];
    		}
    	}
	    var proc = self.SPAWN("bash", [
	        "-s"
	    ], {
	    	cwd: options.cwd,
	    	env: env
	    });
	    proc.on("error", function(err) {
	    	return callback(err);
	    });
	    var stdout = [];
	    var stderr = [];
	    proc.stdout.on('data', function (data) {
	    	stdout.push(data.toString());
			if (self.VERBOSE) {
				process.stdout.write(data);
			}
	    });
	    proc.stderr.on('data', function (data) {
	    	stderr.push(data.toString());
			if (self.VERBOSE) {
				process.stderr.write(data);
			}
	    });
	    proc.stdin.write(commands.join("\n"));
	    proc.stdin.end();
	    proc.on('close', function (code) {
	    	if (code) {
	    		var err = new Error("Commands exited with code: " + code);
	    		err.code = code;
	    		err.stdout = stdout;
	    		err.stderr = stderr;
	    		return callback(err);
	    	}
	        return callback(null, stdout.join(""));
	    });
	}

	self.getDeclaringPathId = function () {
		return "";
	};
	self.getDeclaringConfig = function () {
		return {};
	};
	self.getRuntimeDescriptorPath = function () {
		return this.PATH.join(this.getPinfDirpath(), "program.rt.json");
	};
}
Context.prototype = Object.create(EVENTS.EventEmitter.prototype);

Context.prototype.getFileTreeHashFor = function (path, options, callback) {
	var self = this;
	if (typeof options === "function" && typeof callback === "undefined") {
		callback = options;
		options = null;	    		
	}
	options = options || {};
	return self.promisify(function (callback) {
		return self.getFileTreeInfoFor(path, options, function (err, info) {
			if (err) return callback(err);
			return callback(null, info.hash);
		});
	}, callback);
}

Context.prototype.getFileTreeInfoFor = function (path, options, callback) {
	var self = this;

	var walker = new self.FSWALKER.Walker(path);
    var opts = {};
    for (var name in options) {
    	opts[name] = options[name];
    }
    opts.returnIgnoredFiles = false;
    opts.includeDependencies = false;
    opts.respectDistignore = true;
    opts.respectNestedIgnore = true;
    opts.excludeMtime = true;            
    return walker.walk(opts, function (err, paths, summary) {
    	if (err) return callback(err);
        return callback(null, {
            paths: paths,
            summary: summary,
            hash: self.CRYPTO.createHash("md5").update(JSON.stringify(paths)).digest("hex")
        });
    });
/*
	if (typeof options === "function" && typeof callback === "undefined") {
		callback = options;
		options = null;	    		
	}
	options = options || {};

	var rootPath = path;

	var ignoreFilePath = self.PATH.join(rootPath, ".gitignore");
	if (self.FS.existsSync(ignoreFilePath)) {
		options.ignore = options.ignore || [];
		self.FS.readFileSync(ignoreFilePath, "utf8").split("\n").forEach(function (rule) {
			if (!rule) return;
			if (/^#/.test(rule)) return;
			options.ignore.push(rule);
		});
	}

    // TODO: Replace this checksum logic with 1) meta data if available 2) better scanning that does not load files into memory.

    // ----------------
    // @source https://github.com/mcavage/node-dirsum/blob/master/lib/dirsum.js
    // Changes:
    //  * Do not die on non-existent symlink.
    //  * Bugfixes.
    // TODO: Contribute back to author.
    function _summarize(root, method, hashes) {

    	if (root === rootPath) {
        	self.console.debug("ignore rules for '" + rootPath + "'", options.ignore);
        	self.console.debug("hashes for '" + rootPath + "'", JSON.stringify(hashes, null, 4));
        }

      var keys = Object.keys(hashes);
      keys.sort();

      var obj = {};
      obj.files = hashes;
      var hash = self.CRYPTO.createHash(method);
      for (var i = 0; i < keys.length; i++) {
        if (typeof(hashes[keys[i]]) === 'string') {
          hash.update(hashes[keys[i]]);
        } else if (typeof(hashes[keys[i]]) === 'object') {
          hash.update(hashes[keys[i]].hash);
        } else {
          console.error('Unknown type found in hash: ' + typeof(hashes[keys[i]]));
        }
      }

      obj.hash = hash.digest('hex');
      return obj;
    }

    function digest(root, method, callback) {
      if (!root || typeof(root) !== 'string') {
        throw new TypeError('root is required (string)');
      }
      if (method) {
        if (typeof(method) === 'string') {
          // NO-OP
        } else if (typeof(method) === 'function') {
          callback = method;
          method = 'md5';
        } else {
          throw new TypeError('hash must be a string');
        }
      } else {
        throw new TypeError('callback is required (function)');
      }
      if (!callback) {
        throw new TypeError('callback is required (function)');
      }

      var hashes = {};

      self.FS.readdir(root, function(err, files) {
        if (err) return callback(err);

        if (files.length === 0) {
          return callback(undefined, {hash: '', files: {}});
        }
        var hashed = 0;
        files.forEach(function(f) {

          var path = root + '/' + f;

        	if (
        		root === rootPath &&
        		options.ignore &&
        		options.ignore.indexOf("/" + f) >= 0
        	) {
        		// Ignore file.
        		self.console.debug("Ignore file when computing filetree hash:", path);

                if (++hashed >= files.length) {
                  return callback(undefined, _summarize(root, method, hashes));
                }
                return;
        	}

          self.FS.stat(path, function(err, stats) {
            if (err) {
                if (err.code === "ENOENT") {
                    // We have a symlink that points to target that does not exist.
                    hashes[f] = "na";
                    if (++hashed >= files.length) {
                      return callback(undefined, _summarize(root, method, hashes));
                    }
                    return;
                }
                return callback(err);
            }
            if (stats.isDirectory()) {
              return digest(path, method, function(err, hash) {
                if (err) return callback(err);

                hashes[f] = hash;
                if (++hashed >= files.length) {
                  return callback(undefined, _summarize(root, method, hashes));
                }
              });
            } else if (stats.isFile()) {
              self.FS.readFile(path, 'utf8', function(err, data) {
                if (err) return callback(err);

                var hash = self.CRYPTO.createHash(method);
                hash.update(data);
                hashes[f] = hash.digest('hex');

                if (++hashed >= files.length) {
                  return callback(undefined, _summarize(root, method, hashes));
                }
              });
            } else {
              console.error('Skipping hash of %s', f);
              if (++hashed > files.length) {
                return callback(undefined, _summarize(root, method, hashes));
              }
            }
          });
        });
      });
    }

	return digest(path, "sha1", function (err, hashes) {
		if (err) return callback(err);
		return callback(null, hashes.hash);
	});
*/
}

