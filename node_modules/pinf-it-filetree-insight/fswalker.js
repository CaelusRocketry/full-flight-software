
// @source https://github.com/pinf-it/pinf-it-package-insight/blob/a9ffdb6996c0d08351be15ae662c589297eceae3/lib/walker.js
// Copyright 2012 Christoph Dorn MIT
// TODO: Use external module when it stabilizes instead of inlining source here.


const PATH = require("path");
const FS = require("fs-extra");
const DEEPCOPY = require("deepcopy");
const ESCAPE_REGEXP = require("escape-regexp-component");
//const EVENTS = require('events');



exports.Walker = function(rootPath) {
	this._rootPath = rootPath;
    this._ignoreRules = {
        // Rules that match the top of the tree (i.e. prefixed with `/`).
        top: {},
        // Rules that apply to every level.
        every: {},
        // Rules that include specific files and directories.
        include: {},
        filename: null
    };
    this._stats = {
        ignoreRulesCount: 0,
        totalFiles: 0,
        ignoredFiles: 0,
        ignoredFileList: [],
        totalSize: 0
    };
}

//exports.Walker.prototype = new EVENTS.EventEmitter();

exports.Walker.prototype._insertIgnoreRule = function(ignoreRules, rule, subPath, options) {
    if (options.includeDependencies) {
        if (/^\/?node_modules\/?$/.test(rule)) {
        	return;
/*
TODO: Move to subclass.
            // We ignore the catalog so that the dependencies don't get updated on install.
            rule = "sm-catalog.json";
*/    
        }
    }
    var key = rule.split("*")[0];
    var scope = /^!/.test(rule) ? "include" : ( /^\//.test(rule) ? "top" : "every" );
    if (scope === "include") {
        key = key.substring(1);
        rule = rule.substring(1);
    }
    if (subPath && /^\//.test(key)) {
        key = subPath + key;
    }
    if (!ignoreRules[scope][key]) {
        ignoreRules[scope][key] = [];
    }
    var re = new RegExp(ESCAPE_REGEXP(rule).replace(/\\\*/g, "[^\\/]*?"));

    if (
        scope === "top" &&
        ignoreRules["include"][key]
    ) {
        // Remove previous include rule as exclude rule loaded later supercedes.
        delete ignoreRules["include"][key];
    }

    ignoreRules[scope][key].push(function applyRule(path) {
        if (path === rule || re.test(path)) return true;
        return false;
    });

    this._stats.ignoreRulesCount += 1;
}

exports.Walker.prototype._loadIgnoreRulesFile = function(ignoreRules, path, subPath, options) {
	var self = this;
    if (!FS.existsSync(path)) return false;

    function readRulesFromFile (path) {
        FS.readFileSync(path).toString().split("\n").forEach(function(rule) {
            if (!rule) return;
            if (/^#/.test(rule)) return;
            if (/^@import\s+\S+$/.test(rule)) {
                var uri = rule.match(/^@import\s+(.+)$/)[1];
                self._insertIgnoreRule(ignoreRules, "/" + uri, subPath, options);
                readRulesFromFile(PATH.join(path, "..", uri));
            } else {
                self._insertIgnoreRule(ignoreRules, rule, subPath, options);
            }
        });

    }

    readRulesFromFile(path);

    // TODO: Make this more generic.
    var packagePath = PATH.dirname(path);
    if (subPath) packagePath = PATH.join(packagePath, subPath);
    if (FS.existsSync(PATH.join(packagePath, ".git"))) {
        self._insertIgnoreRule(ignoreRules, ".git", subPath, options);
    }
    if (FS.existsSync(PATH.join(packagePath, ".svn"))) {
        self._insertIgnoreRule(ignoreRules, ".svn/", subPath, options);
    }
    self._insertIgnoreRule(ignoreRules, "*~backup-*/", subPath, options);
    self._insertIgnoreRule(ignoreRules, ".sm/", subPath, options);
    return true;
}

exports.Walker.prototype._loadIgnoreRules = function(ignoreRules, subPath, options) {
	var self = this;
	var ignoreFiles = [];

    if (subPath !== "" && options.respectNestedIgnore !== true) {
        return;
    }

    if (options.respectDistignore) {
        if (FS.existsSync(PATH.join(self._rootPath, subPath, ".distignore"))) {
            ignoreFiles.push(".distignore");
        } else
        if (FS.existsSync(PATH.join(self._rootPath, subPath, ".npmignore"))) {
            ignoreFiles.push(".npmignore");
        }
    }
    if (ignoreFiles.length === 0) {
        ignoreFiles.push(".gitignore");
    }

	var found = false;
    ignoreFiles.forEach(function(basename) {
        if (found) return;
        self._insertIgnoreRule(ignoreRules, "/" + basename, subPath, options);
        if (self._loadIgnoreRulesFile(ignoreRules, PATH.join(self._rootPath, subPath, basename), subPath, options)) {
            found = true;
            ignoreRules.filename = basename;
        }
    });
    if (ignoreRules.filename === null) {
    	ignoreRules.filename = "default";
        // Default rules.
        /*
        insert(".git/");
        insert(".gitignore");
        insert(".npmignore");
        insert(".sm/");
        insert(".rt/");
        insert(".DS_Store");
        insert(".program.json");
        insert(".package.json");
        */
        // NOTE: Be careful when modifying. These are used when exporting a package.
        self._insertIgnoreRule(ignoreRules, ".*", subPath, options);
        //self._insertIgnoreRule(ignoreRules, ".*/");	// Should already be matched by `.*`.
        self._insertIgnoreRule(ignoreRules, "*~backup-*", subPath, options);
        self._insertIgnoreRule(ignoreRules, "/dist/", subPath, options);
        self._insertIgnoreRule(ignoreRules, "program.dev.json", subPath, options);
        self._insertIgnoreRule(ignoreRules, ".pio.*", subPath, options);
    }
}

exports.Walker.prototype.walk = function(options, callback) {
	var self = this;

	var traversedSymlink = {};

    function walkTree(ignoreRules, subPath, callback) {
        var list = {};
        var c = 0;
    	try {
    	    // Respect nested ignore files.
	        ignoreRules = DEEPCOPY(ignoreRules);
		    self._loadIgnoreRules(ignoreRules, subPath, options);
		} catch(err) {
			return callback(err);
		}
        FS.readdir(PATH.join(self._rootPath, subPath), function(err, files) {
            if (err) return callback(err);
            if (files.length === 0) {
                return callback(null, list, self._stats);
            }
            function error(err) {
                c = -1;
                return callback(err);
            }
            function done() {
                if (c !== 0) return;
                c = -1;
                // @source http://stackoverflow.com/a/1359808/330439
                function sortObject(o) {
				    var sorted = {},
				    key, a = [];
				    for (key in o) {
				    	if (o.hasOwnProperty(key)) {
				    		a.push(key);
				    	}
				    }
				    a.sort();
				    for (key = 0; key < a.length; key++) {
				    	sorted[a[key]] = o[a[key]];
				    }
				    return sorted;
				}
				list = sortObject(list);
                return callback(null, list, self._stats);
            }
            files.forEach(function(basename) {
                if (c === -1) return;

                // NOTE: We do not support a file called ' '.
                //       This typically appears in OSX DMG archives with an `/Applications` shortcut.
                if (basename === " ") {
                    self._stats.ignoredFiles += 1;
                    if (options.returnIgnoredFiles) {
                        self._stats.ignoredFileList.push(subPath + "/" + basename);
                    }
                    return;
                }

                function ignore(type) {
                    function select(ruleGroups, path) {
                        var rules = null;
                        if (ruleGroups[path]) {
                            rules = ruleGroups[path];
                        } else {
                            for (var prefix in ruleGroups) {
                                if (path.substring(0, prefix.length) === prefix) {
                                    rules = ruleGroups[prefix];
                                    break;
                                }
                            }
                        }
                        if (!rules && ruleGroups[""]) {
                            rules = ruleGroups[""];
                        }
                        if (rules) {
                            for (var i=0 ; i<rules.length ; i++) {
                                if (rules[i](path)) {
                                    return true;
                                }
                            }
                            return false;
                        }
                    }
                    if (select(ignoreRules.include, subPath + "/" + basename + ((type === "dir") ? "/" : ""))) {
                        return false;
                    }
                    if (select(ignoreRules.top, subPath + "/" + basename + ((type === "dir") ? "/" : ""))) {
                        return true;
                    }
                    // All deeper nodes.
                    return select(ignoreRules.every, basename + ((type === "dir") ? "/" : ""));
                }
                c += 1;
                FS.lstat(PATH.join(self._rootPath, subPath, basename), function(err, stat) {
                    if (err) return error(err);                    
                    c -= 1;
                    if (stat.isSymbolicLink()) {
                        c += 1;
                        FS.readlink(PATH.join(self._rootPath, subPath, basename), function(err, val) {
                            if (err) return error(err);
                            c -= 1;
                            // TODO: Detect circular links.

                            var linkDir = null;
                            try {
                                linkDir = FS.realpathSync(PATH.resolve(FS.realpathSync(PATH.join(self._rootPath, subPath)), val));
                            } catch(err) {
                                if (err.code === "ENOENT") {
                                    // If it is a relative path within the package we copy it.
                                    if (PATH.join(self._rootPath, subPath, val).substring(0, self._rootPath.length) === self._rootPath) {
                                        list[subPath + "/" + basename] = {
                                            mtime: stat.mtime.getTime(),
                                            size: stat.size,
                                            dir: null,
                                            symlink: val,
                                            symlinkReal: null
                                        };
                                        if (options.excludeMtime) {
                                            delete list[subPath + "/" + basename].mtime;
                                        }
                                    }
                                    return done();
                                }
                                throw err;
                            }
                            c += 1;
                            FS.lstat(linkDir, function(err, linkStat) {
                                if (err) return error(err);
                                c -= 1;

                                self._stats.totalFiles += 1;

                                if (!ignore( linkStat.isDirectory() ? "dir" : "file")) {
                                    list[subPath + "/" + basename] = {
                                        mtime: stat.mtime.getTime(),
                                        size: stat.size,
                                        dir: linkStat.isDirectory() || false,
                                        symlink: val,
                                        symlinkReal: linkDir
                                    };
                                    if (options.excludeMtime) {
                                        delete list[subPath + "/" + basename].mtime;
                                    }
                                    if (linkStat.isDirectory()) {
                                    	if (traversedSymlink[linkDir]) {
                                    		return done();
                                    	}
                                    	traversedSymlink[linkDir] = true;
                                        c += 1;
                                        return walkTree(ignoreRules, subPath + "/" + basename, function(err, subList) {
                                            if (err) return error(err);
                                            c -= 1;
                                            for (var key in subList) {
                                                list[key] = subList[key];
                                            }
                                            return done();
                                        });
                                    } else {
                                        return done();
                                    }
                                } else {
                                    self._stats.ignoredFiles += 1;
                                    if (options.returnIgnoredFiles) {
                                    	self._stats.ignoredFileList.push(subPath + "/" + basename);
                                    }
                                    return done();
                                }
                            });

                        });
                    } else
                    if (stat.isDirectory()) {
                        var walk = false;
                        if (!ignore("dir")) {
                            list[subPath + "/" + basename] = {
                                dir: true,
                                mtime: stat.mtime.getTime(),
                                size: stat.size
                            };
                            if (options.excludeMtime) {
                                delete list[subPath + "/" + basename].mtime;
                            }
                            walk = true;
                        } else {
                            for (var path in ignoreRules.include) {
                                if (path.substring(0, (subPath + "/" + basename).length) === (subPath + "/" + basename)) {
                                    walk = true;
                                    break;
                                }
                            }
                        }
                        if (walk) {
                            c += 1;
                            walkTree(ignoreRules, subPath + "/" + basename, function(err, subList) {
                                if (err) return error(err);
                                c -= 1;
                                for (var key in subList) {
                                    list[key] = subList[key];
                                }
                                done();
                            });
                        }
                    } else
                    if (stat.isFile()) {
                        self._stats.totalFiles += 1;
                        if (!ignore("file")) {
                        	self._stats.totalSize += stat.size;
                            list[subPath + "/" + basename] = {
                                mtime: stat.mtime.getTime(),
                                size: stat.size
                            };
                            if (options.excludeMtime) {
                                delete list[subPath + "/" + basename].mtime;
                            }
                        } else {
                            self._stats.ignoredFiles += 1;
                            if (options.returnIgnoredFiles) {
                            	self._stats.ignoredFileList.push(subPath + "/" + basename);
                            }
                        }
                    }
                    done();
                });
            });
            done();
        });
    }

    try {
	    self._loadIgnoreRules(self._ignoreRules, "", options);

        if (options.ignore) {
            options.ignore.forEach(function (rule) {
                self._insertIgnoreRule(self._ignoreRules, rule, "", options);
            });
        }

	} catch(err) {
		return callback(err);
	}

    return walkTree(self._ignoreRules, "", callback);
}
