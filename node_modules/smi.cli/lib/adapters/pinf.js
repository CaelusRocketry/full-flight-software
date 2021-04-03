
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");
const WAITFOR = require("waitfor");
const SPAWN = require("child_process").spawn;
const NPM_ADAPTER = require("./npm");


exports.link = NPM_ADAPTER.link;


exports.install = function (basePath, locator, packages, installOptions, callback) {

	ASSERT.equal(typeof basePath, "string");

	function _abspath() {
        if (/^\//.test(arguments[0])) {
            return PATH.join.apply(null, Array.prototype.slice.apply(arguments));
        }
		return PATH.join.apply(null, [basePath].concat(Array.prototype.slice.apply(arguments)));
	}

    var command = "bin/install.sh";
    if (!installOptions.verbose) {
        command += " --silent";
    }

    return FS.realpath(_abspath(locator.smi.installedPath), function(err, installedPath) {
        if (err) return callback(err);

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
}
