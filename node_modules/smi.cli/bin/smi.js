
const PATH = require("path");
const FS = require("fs-extra");
const Q = require("q");
const COMMANDER = require("commander");
const COLORS = require("colors");
const SMI = require("../lib/smi");
const SPAWN = require("child_process").spawn;


COLORS.setTheme({
    error: 'red'
});


if (require.main === module) {

    function error(err) {
        if (typeof err === "string") {
            console.error((""+err).red);
        } else
        if (typeof err === "object" && err.stack) {
            console.error((""+err.stack).red);
        }
        process.exit(1);
    }

    try {

        return Q.denodeify(function(callback) {

            var program = new COMMANDER.Command();

            program
                .version(JSON.parse(FS.readFileSync(PATH.join(__dirname, "../package.json"))).version)
                .option("-s, --silent", "Don't log anything")
                .option("-v, --verbose", "Log verbose progress messages")
                .option("-d, --debug", "Show debug output and serialize all otherwise parallel code paths")
                .option("--link-smi", "Link all dependencies called 'smi.cli' to our smi codebase")
                .option("-f, --force", "Force an operation when it would normally be skipped");

            var acted = false;

            program
                .command("show-deps")
                .description("Show dependencies")
                .action(function(options) {
                    acted = true;
                    var basePath = process.cwd();
                    var descriptorPath = PATH.join(basePath, "package.json");
                    return Q.denodeify(function(callback) {
                        return FS.exists(descriptorPath, function(exists) {
                            if (!exists) {
                                return callback("No descriptor found at: " + descriptorPath);
                            }
                            var opts = {
                                debug: program.debug || !!process.env.PIO_DEBUG || false,
                                verbose: program.verbose || !!process.env.PIO_VERBOSE || program.debug || !!process.env.PIO_DEBUG || false,
                                silent: program.silent || !!process.env.PIO_SILENT || false,
                                linkSmi: (process.env.SMI_OPT_LINK_SMI === "1" || program.linkSmi === true),
                                dryrun: "deps"
                            };
                            return SMI.install(basePath, descriptorPath, opts, function(err) {
                                if (err) return callback(err);
                                return callback(null);
                            });
                        });
                    })().then(function() {
                        return callback(null);
                    }).fail(callback);
                });

            program
                .command("install")
                .option("--npm", "Call 'npm install' after smi finishes")
                .description("Install packages")
                .action(function(options) {
                    acted = true;
                    var basePath = process.cwd();
                    var descriptorPath = PATH.join(basePath, "package.json");
                    return Q.denodeify(function(callback) {

                        if (options.npm && process.env._SMI_NPM_INSTALL_FLAG) {
                            console.log(("Skip `npm install` as we are already running `npm install` triggered by `smi install`!").yellow);
                            return callback(null);
                        }

                    	return FS.exists(descriptorPath, function(exists) {
                    		if (!exists) {
                    			return callback("No descriptor found at: " + descriptorPath);
                    		}
                            var opts = {
                                debug: program.debug || !!process.env.PIO_DEBUG || false,
                                verbose: program.verbose || !!process.env.PIO_VERBOSE || program.debug || !!process.env.PIO_DEBUG || false,
                                silent: program.silent || !!process.env.PIO_SILENT || false,
                                linkSmi: (process.env.SMI_OPT_LINK_SMI === "1" || program.linkSmi === true)
                            };
							return SMI.install(basePath, descriptorPath, opts, function(err, info) {
								if (err) return callback(err);

                                //process.stdout.write('<wf id="info">' + JSON.stringify(info, null, 4) + '</wf>' + "\n");

                                if (opts.verbose) {
                                    console.log("smi install success!".green);
                                }

                                function npmInstall(callback) {
                                    if (!options.npm) return callback(null);

                                    var env = {};
                                    for (var name in process.env) {
                                        env[name] = process.env[name];
                                    }
                                    env._SMI_NPM_INSTALL_FLAG = "1";
                                    env.SMI_OPT_LINK_SMI = opts.linkSmi ? "1" : "0";

                                    console.log(("Calling `npm install` for: " + basePath).magenta);
                                    var proc = SPAWN("npm", [
                                        "install"
                                    ], {
                                        cwd: basePath,
                                        env: env
                                    });
                                    proc.stdout.on('data', function (data) {
                                        process.stdout.write(data);
                                    });
                                    proc.stderr.on('data', function (data) {
                                        process.stderr.write(data);
                                    });
                                    return proc.on('close', function (code) {
                                        if (code !== 0) {
                                            console.error("ERROR: `npm install` exited with code '" + code + "'");
                                            return callback(new Error("`npm install` script exited with code '" + code + "'"));
                                        }
                                        console.log(("`npm install` for '" + basePath + "' done!").green);
                                        return callback(null);
                                    });
                                }

                                return npmInstall(function(err) {
                                    if (err) return callback(err);
                                    return callback(null);
                                });
							});
                    	});
                    })().then(function() {
                        return callback(null);
                    }).fail(callback);
                });

            program.parse(process.argv);

            if (!acted) {
                var command = process.argv.slice(2).join(" ");
                if (command) {
                    console.error(("ERROR: Command '" + process.argv.slice(2).join(" ") + "' not found!").error);
                }
                program.outputHelp();
                return callback(null);
            }
        })().then(function() {
            return process.exit(0);
        }).fail(error);
    } catch(err) {
        return error(err);
    }
}
