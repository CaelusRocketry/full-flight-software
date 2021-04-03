
const PATH = require("path");
const FS = require("fs-extra");
const SPAWN = require("child_process").spawn;


exports.extract = function(fromPath, toPath, installOptions, callback) {

	if (installOptions.verbose) {
		console.log(("Extracting '" + fromPath +"' to '" + toPath + "' using 'dmg' extractor ...").magenta);
	}

    // @credit http://superuser.com/a/250624

    var cdrPath = fromPath + "~.cdr";
    var mountPath = toPath + "~mount";

    function spawn(command, args, options, callback) {
		var proc = SPAWN(command, args, options);
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
    }

    function convert(callback) {
        if (FS.existsSync(cdrPath)) return callback(null);
        if (installOptions.verbose) console.log("Converting dmg '" + fromPath + "' to cdr.");
        return spawn("/usr/bin/hdiutil", [
            "convert", "-quiet", fromPath, "-format", "UDTO", "-o", fromPath + "~"
        ], {
            cwd: PATH.dirname(fromPath)
        }, callback);
    }

    function mount(callback) {
        if (installOptions.verbose) console.log("Mount cdr '" + cdrPath + "' to '" + mountPath + "'.");
        return spawn("/usr/bin/hdiutil", [
            "attach", "-quiet", "-nobrowse", "-noverify", "-noautoopen", "-mountpoint", mountPath, cdrPath
        ], {
            cwd: PATH.dirname(fromPath)
        }, callback);
    }

    function unmount(callback) {
        if (installOptions.verbose) console.log("Unmounting '" + mountPath + "'.");
        return spawn("/usr/bin/hdiutil", [
            "detach", mountPath
        ], {
            cwd: PATH.dirname(fromPath)
        }, callback);
    }

    function extract(callback) {
        if (installOptions.verbose) console.log("Extracting '" + mountPath + "' to '" + toPath + "'.");
        return FS.copy(mountPath, toPath, function(path) {
        	path = path.substring(mountPath.length);
            if (/^\/.Trashes$/.test(path)) return false;
            if (/^\/.DS_Store$/.test(path)) return false;
            if (/^\/.fseventsd$/.test(path)) return false;
            return true;
        }, callback);
    }

    function error(err, callback) {
        return unmount(function(_err) {
        	if (_err) {
        		console.error("Error unmounting", err.stack);
        	}
        	return callback(err);
        });
    }

    return convert(function(err) {
    	if (err) return error(err, callback);

        return mount(function(err) {
	    	if (err) return error(err, callback);

            return extract(function(err) {
		    	if (err) return error(err, callback);

		        return unmount(callback);
            });
        });
    });

}

