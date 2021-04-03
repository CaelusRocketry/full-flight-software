
const ASSERT = require("assert");
const PATH = require("path");
const MFS = require("mfs");
const FS = new MFS.FileFS({
    lineinfo: true  
});
const WAITFOR = require("waitfor");
const SPAWN = require("child_process").spawn;

function debugFS () {
    if (debugFS.debugging) return;
    debugFS.debugging = true;
    FS.on("used-path", function(path, method, meta) {
        console.log(("FS." + method).yellow.bold, path, ((meta)?("(" + meta.file + " @ " + meta.line + ")"):""));
    });
}

exports.link = function(basePath, locator, packages, installOptions, callback) {

    if (installOptions.debug) {
        debugFS();
    }

    try {

        ASSERT.equal(typeof basePath, "string");

        function _abspath() {
            if (/^\//.test(arguments[0])) {
                return PATH.join.apply(null, Array.prototype.slice.apply(arguments));
            }
            return PATH.join.apply(null, [basePath].concat(Array.prototype.slice.apply(arguments)));
        }

        var declaredPackages = {};
        var declaredDevPackages = {};

        [
            "dependencies",
            "devDependencies",
            "mappings",
            "devMappings",
        ].forEach(function(property) {
            if (!locator.descriptor || !locator.descriptor[property]) return;
            Object.keys(locator.descriptor[property]).forEach(function(name) {
                declaredPackages[name] = true;
                if (/^dev[A-Z]/.test(property)) {
                    declaredDevPackages[name] = true;
                }
            });
        });
        declaredPackages = Object.keys(declaredPackages);

        if (declaredPackages.length === 0) {
            return callback(null);
        }

        // TODO: Don't do this. This is not specific enough and we could get the wrong package if
        //       a package with the same name exists twice in two different catalogs/paths.
        //       When we have better meta data for dependencies this can be resolved deterministically.
        var packagesByName = {};
        Object.keys(packages).forEach(function(path) {
            var name = PATH.basename(path);
            if (!packagesByName[name]) {
                packagesByName[name] = path;
            }
        });

        var waitfor = WAITFOR[installOptions.debug ? "serial":"parallel"](callback);
        declaredPackages.forEach(function(name) {

            waitfor(name, function(name, callback) {

                var linkPath = _abspath(locator.smi.installedPath, "node_modules", name);
                if (!FS.existsSync(PATH.dirname(linkPath))) {
                    FS.mkdirsSync(PATH.dirname(linkPath));
                }
                var removeLinkPath = linkPath;

                var path = null;
                var symlinkValue = null;
                if (name === "smi.cli" && installOptions.linkSmi === true) {
                    symlinkValue = path = PATH.dirname(PATH.dirname(__dirname));
                    if (installOptions.verbose) {
                        console.log(("Linking in our smi codebase at '" + path + "'!").cyan);
                    }
                } else {
                    path = _abspath(locator.smi.basePath, "..", name);
                    var lookupPath = path;
                    function obtainPath(locator) {
                        if (locator.aspects && locator.aspects.install && locator.aspects.install.basePath) {
                            path = _abspath(locator.aspects.install.basePath);
                        } else
                        if (locator.aspects && locator.aspects.source && locator.aspects.source.basePath) {
                            path = _abspath(locator.aspects.source.basePath);
                        } else {
                            path = _abspath(locator.basePath);
                        }
                        return path;
                    }
                    if (packages[lookupPath]) {
                        path = obtainPath(packages[lookupPath]);
                        if (installOptions.verbose) {
                            console.log("Matched path '" + lookupPath + "' to '" + path + "' based on lookup in 'packages'");
                        }
                    } else
                    if (packages[name]) {
                        path = obtainPath(packages[name]);
                        if (installOptions.verbose) {
                            console.log("Matched name '" + name + "' to '" + path + "' based on lookup in 'packages'");
                        }
                    } else
                    if (packagesByName[PATH.basename(name)] && packages[packagesByName[PATH.basename(name)]]) {
                        path = obtainPath(packages[packagesByName[PATH.basename(name)]]);
                        if (installOptions.verbose) {
                            console.log("Matched PATH.basename(name) '" + name + "' to '" + path + "' based on lookup in 'packages' using 'packagesByName'");
                        }
                    } else {
                        return callback(null);
                    }
                    if (locator.symlinked) {
                        try {
                            var pathBefore = path;
                            path = FS.realpathSync(path);
                            var linkPathBefore = linkPath;
                            linkPath = PATH.join(FS.realpathSync(PATH.dirname(linkPath)), PATH.basename(linkPath));
                        } catch(err) {
                            console.log("locator", locator);
                            console.log("lookupPath", lookupPath);
                            console.log(("Error [1] creating symlink at '" + linkPathBefore + "' pointing to '" + pathBefore + "'! " + err.stack).red);
                            console.log(("ACTION: Make sure the package '" + locator.location + "' has a dependency declaration for package '" + name + "'!").magenta);
                            throw err;
                        }
                    }
 
                    if (!FS.existsSync(path)) {
                        if (declaredDevPackages[name]) {
                            console.log(("Error [2] creating symlink at '" + linkPath + "' pointing to '" + symlinkValue + "' BUT skipping as it is a dev package. If using for dev run install on package directly to install dev dependencies!").yellow);
                            return callback(null);
                        } else {
                            console.log(("Error [2] creating symlink at '" + linkPath + "' pointing to '" + symlinkValue + "'! ").red);
                            console.log(("ACTION: Make sure the package '" + locator.location + "' has a dependency declaration for package '" + name + "'!").magenta);
                            throw new Error("Missing dependency declaration!");
                        }
                    }
 
                    // NOTE: We cannot use a relative path here because if it is mapped
                    //       more than once to different locations the path will not line up.
                    symlinkValue = path;
//                    symlinkValue = PATH.relative(PATH.dirname(linkPath), path);
                }

                if (installOptions.verbose) {
                    console.log(("Linking '" + path + "' to '" + linkPath + "' by storing '" + symlinkValue + "'.").magenta);
                }

                if (FS.existsSync(removeLinkPath)) {
                    FS.removeSync(removeLinkPath);
                }

                if (!FS.existsSync(linkPath)) {
                    try {
                        FS.symlinkSync(symlinkValue, linkPath);
                    } catch(err) {
                        // A link already exists even though it is pointing to a non-existent target!
                        if (installOptions.verbose) {
                            console.log("Warning: A link already exists at '" + linkPath + "' even though it is pointing to a non-existent target!");
                        }
                    }
                }

                function linkCommands(callback) {
                    var descriptorPath = PATH.join(path, "package.json");
                    var binBasePath = PATH.join(linkPath, "../.bin");
                    return FS.readJson(descriptorPath, function(err, descriptor) {
                        if (err) return callback(err);
                        if (!descriptor.bin) {
                            return callback(null);
                        }
                        if (installOptions.verbose) {
                            console.log("descriptor.bin for '" + descriptorPath + "':", descriptor.bin);
                        }
                        try {
                            for (var command in descriptor.bin) {

                                var linkPath = PATH.join(binBasePath, command);
                                var fromPath = PATH.join(descriptorPath, "..", descriptor.bin[command]);

                                if (installOptions.verbose) {
                                    console.log(("Linking bin command '" + fromPath + "' to '" + linkPath + "'.").magenta);
                                }

                                if (!FS.existsSync(linkPath)) {
                                    if (!FS.existsSync(fromPath)) {
                                        return callback(new Error("Command declared as '" + command + "' in '" + descriptorPath + "' not found at '" + fromPath + "'!"));
                                    }
                                    if (!FS.existsSync(PATH.dirname(linkPath))) {
                                        FS.mkdirsSync(PATH.dirname(linkPath));
                                    } else {
                                        // Replace symlink if it exists.
                                        try {
                                            FS.unlinkSync(linkPath);
                                        } catch(err) {}
                                    }
                                    FS.symlinkSync(PATH.relative(PATH.dirname(linkPath), fromPath), linkPath);
                                }
                            }
                        } catch (err) {
                            return callback(err);
                        }
                        return callback(null);
                    });
                }

                return linkCommands(callback);
            });
        });
        return waitfor();
    } catch(err) {
        return callback(err);
    }
}


exports.install = function (basePath, locator, packages, installOptions, callback) {

	ASSERT.equal(typeof basePath, "string");

	function _abspath() {
        if (/^\//.test(arguments[0])) {
            return PATH.join.apply(null, Array.prototype.slice.apply(arguments));
        }
		return PATH.join.apply(null, [basePath].concat(Array.prototype.slice.apply(arguments)));
	}

    var command = "npm";

    var smiForNpmPath = null;
    if (
        process.env.PGS_PACKAGES_DIRPATH &&
        (smiForNpmPath = PATH.join(process.env.PGS_PACKAGES_DIRPATH, "github.com~sourcemint~smi-for-npm~0/source/installed/master/bin/smi-for-npm")) &&
        // Only use if it exists.
        FS.existsSync(smiForNpmPath) &&
        // Only use if installed.
        // TODO: Use generic 'sm' feature for this.
        FS.existsSync(PATH.join(smiForNpmPath, "../../node_modules/fs-extra"))
    ) {
        command = smiForNpmPath;
    }
    command += " install --production --unsafe-perm";
    if (!installOptions.verbose) {
        command += " --silent";
    }

    return FS.realpath(_abspath(locator.smi.installedPath), function(err, installedPath) {
        if (err) return callback(err);

        return FS.exists(PATH.join(installedPath, "Makefile"), function(exists) {
            if (exists) {
                command = "make install";
            }

            if (installOptions.verbose) {
                console.log(("Calling `" + command + "` for: " + installedPath).magenta);
            }
            // TODO: Show on debug only.
            //console.log("NOTE: If there are symlinked packages with links to targets that do not exist, npm will replace these symlinks with downloaded packages!");
            var proc = SPAWN(command.split(" ").shift(), command.split(" ").slice(1), {
                cwd: installedPath
            });
            var buffer = [];
            proc.on('error', function (err) {
                console.error(err.stack);
                return callback(new Error("Spawn error while calling: " + command + " (cwd: " + installedPath + ")"));
            });
            proc.stdout.on('data', function (data) {
                buffer.push(data.toString());
                if (!installOptions.silent) {
                    process.stdout.write(data);
                }
            });
            proc.stderr.on('data', function (data) {
                buffer.push(data.toString());
                if (!installOptions.silent) {
                    process.stdout.write(data);
                }
            });
            return proc.on('close', function (code) {
                if (code !== 0) {
                    process.stderr.write((""+buffer.join("")).red + "\n");
                    console.error("ERROR: `" + command + "` exited with code '" + code + "'");
                    return callback(new Error("`" + command + "` script exited with code '" + code + "'"));
                }
                if (installOptions.verbose) {
                    console.log(("`npm install` for '" + installedPath + "' done!").green);
                }
                return callback(null);
            });
        });
    });
}
