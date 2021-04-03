
const PATH = require("path");
const FS = require("fs-extra");
const URL = require("url");
const Q = require("q");
const CRYPTO = require("crypto");
const REQUEST = require("request");
const SPAWN = require("child_process").spawn;


if (typeof process.env.HOME !== "string") {
	throw new Error("'HOME' environment variable not set!");
}


exports.download = function(url, path, installOptions, callback) {

	if (installOptions.verbose) {
		console.log(("Downloading '" + url +"' to '" + path + "' through github API ...").magenta);
	}

	// TODO: Use pinf-based namespace parser implementation to support all URI variations.
	var urlParts = URL.parse(url);
	var pathParts = urlParts.pathname.split("/").slice(1);

	var locator = {};
	if (pathParts[2] === "archive") {
		locator.owner = pathParts[0];
		locator.repo = pathParts[1];
	} else
	if (/^git@github\.com:/.test(url)) {
		urlParts = url.match(/^git@github\.com:([^\/]+)\/(.+?)\.git(#([^\()]+))?(\(([^\)]+)\))?$/);
		locator.owner = urlParts[1];
		locator.repo = urlParts[2];
		// NOTE: Always a commit reference!
		locator.ref = urlParts[4] || null;
		locator.branch = urlParts[6] || null;
	} else
	if (urlParts.hostname === "github.com") {
		locator.owner = pathParts[0];
		locator.repo = pathParts[1].replace(/\.git$/, "");
		if (urlParts.hash) {
			// NOTE: Always a commit reference!
			locator.ref = urlParts.hash.replace(/^#/, "");
		}
	} else {
		return callback(new Error("Cannot parse github URL '" + url + "'! It must look something like 'https://github.com/<owner>/<repo>/archive/<hash>.tar.gz' or 'git@github.com:<owner>/<repo>.git#<hash>'"));
	}

	if (!FS.existsSync(PATH.dirname(path))) {
		FS.mkdirsSync(PATH.dirname(path));
	}

	var command = "git clone git@github.com:" + locator.owner + "/" + locator.repo + '.git ' + path;

	if (installOptions.verbose) {
		console.log(("Running command: \n" + command + " \n(cwd: " + PATH.dirname(path) + ")").magenta);
	}

	var env = process.env;
	// TODO: Throw explicit error if `git` command not found!
	var proc = SPAWN(command.split(" ").shift(), command.split(" ").slice(1), {
        cwd: PATH.dirname(path),
        env: env
    });
    proc.on('error', function (err) {
    	return callback(err);
    });
    proc.stdout.on('data', function (data) {
    	if (!installOptions.silent) {
	        process.stdout.write(data);
	    }
    });
    proc.stderr.on('data', function (data) {
    	if (!installOptions.silent) {
	        process.stderr.write(data);
	    }
    });
    proc.on('close', function (code) {
        if (code !== 0) {
            console.error("ERROR: Command '" + command + "' exited with code '" + code + "'");
            return callback(new Error("Command '" + command + "' exited with code '" + code + "'"));
        }
        if (!FS.existsSync(path)) {
        	return callback(new Error("Something went wrong running command '" + command + "'. The target directory did not get created!"));
        }

        if (!locator.ref) {
	        return FS.remove(PATH.join(path, ".git"), callback);
        }

        command = "git reset --hard " + locator.ref;

		if (installOptions.verbose) {
			console.log(("Running command: \n" + command + " \n(cwd: " + path + ")").magenta);
		}

		var proc = SPAWN(command.split(" ").shift(), command.split(" ").slice(1), {
	        cwd: path,
	        env: env
	    });
	    proc.on('error', function (err) {
	    	return callback(err);
	    });
	    proc.stdout.on('data', function (data) {
	    	if (!installOptions.silent) {
		        process.stdout.write(data);
		    }
	    });
	    proc.stderr.on('data', function (data) {
	    	if (!installOptions.silent) {
		        process.stderr.write(data);
		    }
	    });
	    proc.on('close', function (code) {
	        if (code !== 0) {
	            console.error("ERROR: Command '" + command + "' exited with code '" + code + "'");
	            return callback(new Error("Command '" + command + "' exited with code '" + code + "'"));
	        }
	        return callback(null);
	    });
    });

/*
	var credentialsPath = PATH.join(process.env.HOME, ".smi", "credentials", "com.github.api");

	console.log("Using github API credentials from:", credentialsPath);

	function ensureCredentials(callback) {
		function read(callback) {
			return FS.readJson(credentialsPath, callback);
		}
		return FS.exists(credentialsPath, function(exists) {
			if (exists) return read(callback);

			return Q.fcall(function() {
				// Ask user to authenticate with github using browser.
				var deferred = Q.defer();
		        var shasum = CRYPTO.createHash("sha1");
		        shasum.update(Math.random() + ":" + Date.now());
		        var id = shasum.digest("hex");
				var profile = "pinf";
		        console.log(("Opening 'auth.sourcemint.org' in browser to authenticate profile '" + profile + "'.").magenta);
				exec("open 'http://auth.sourcemint.org/request?service=github&profile=" + profile + "&id=" + id + "'").fail(deferred.reject);
				var checkCount = 0;
				function check() {
					if (Q.isFulfilled(deferred.promise)) return;
					checkCount += 1;
					REQUEST("http://auth.sourcemint.org/token?id=" + id, function (err, response, body) {
						if (err) {
							console.error(err);
							return deferred.reject(err);
						}
						if (response.statusCode === 403) {
							// Stop trying if we have been for 2 mins.
							if (checkCount > 60 * 2) {
								return deferred.reject(new Error("Authentication is taking too long (> 2 mins). Try again."));
							}
							// Try again in one second.
							setTimeout(check, 1000);
						} else
						if (response.statusCode === 200) {
							try {
								var json = JSON.parse(body);
								console.log("Authentication successful.");
								return deferred.resolve(json);
							} catch(err) {
								err.message += " while parsing: " + body;
								return deferred.reject(err);
							}
					  	} else {
					  		console.error(response);
							return deferred.reject(new Error("Invalid response."));
					  	}
					});
				}
				check();
				return deferred.promise.then(function(credentials) {
					return Q.denodeify(FS.outputFile)(credentialsPath, JSON.stringify(credentials, null, 4));
				});
			}).then(function() {
				return read(callback);
			}).fail(callback);
		});
	}

	function exec(command, options, callback) {
		if (typeof options === "function" && typeof callback === "undefined") {
			callback = options;
			options = null;
		}
		options = options || {};
		var deferred = Q.defer();
		if (callback) {
			deferred.promise.then(function(ret) {
				return callback(null, ret);
			}, callback);
		}
		EXEC(command, options, function(err, stdout, stderr) {
			if (err) {
				process.stderr.write(stdout);
				process.stderr.write(stderr);
				return deferred.reject(err);
			}
			return deferred.resolve({
				stdout: stdout,
				stderr: stderr
			});
		});
		return deferred.promise;
	}

	function makeRequest(credentials, uri, args, callback) {

		var postBody = null;
		var method = "GET";
		if (/^POST:/.test(uri)) {
			method = "POST";
			uri = uri.substring(5);
			postBody = {};
			for (var name in args) {
				postBody[name] = args[name];
			}
			delete postBody.pages;
			postBody = JSON.stringify(postBody);
		}

		if (/\?/.test(uri)) {
			if (!/&$/.test(uri)) uri += "&";
		} else {
			uri += "?";
		}
		var url = "https://api.github.com" + uri + "per_page=100&access_token=" + credentials.token;
		function fetchPage(url, callback) {
			var data = [];
    		if (process.env.DEBUG) {
    			console.log("[pinf] Request:", url);
    		}
			return REQUEST({
				method: method,
				url: url,
				headers: {
					"User-Agent": "nodejs/request"
				},
				json: true,
				body: postBody
			}, function (err, res, body) {
				if (err) return callback(err);
				var links = {};
				if (res.headers.link) {
					res.headers.link.split(",").map(function(link) {
						var m = link.match(/^<([^>]*)>; rel="([^"]*)"$/);
						if (m) {
							links[m[2]] = m[1];
						}
					});
				}
				if (body) {
					if (
						(method === "GET" && res.statusCode !== 200) ||
						(method === "POST" && res.statusCode !== 201)
					) {
						if (method === "POST") {
							console.error("REQUEST BODY", postBody);
						}
						console.error("RESPONSE HEADERS", res.headers);
						console.error("RESPONSE BODY", body);
						var err = new Error(method + " Url '" + url + "' returned with status: " + res.statusCode);
						err.code = res.statusCode;
						return callback(err);
					}
					data.push(body);
				} else {
					console.error(body);
				}
				if (links.next) {
					return fetchPage(links.next, function(err, _data) {
						if (err) return callback(err);
						data = data.concat(_data);
						return callback(null, data);
					});
				}
				return callback(null, data);
			});
		}
		return fetchPage(url, callback);
	}

	return ensureCredentials(function(err, credentials) {
		if (err) return callback(err);
		return makeRequest(credentials, "/repos/" + pathParts[0] + "/" + pathParts[1] + "/downloads/" + pathParts[3].replace(/\..+$/, ""), function(err, result) {
			if (err) return callback(err);
		});
	});
*/
}

