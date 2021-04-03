
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");
const DIRSUM = require("dirsum");
const SMI = require("../lib/smi");
const UTIL = require("./_util");
const SPAWN = require("child_process").spawn;


//const MODE = "test";
const MODE = "write";

const DEBUG = false;


describe('smi-cli', function() {

	this.timeout(30 * 1000);
	var tmpPath = PATH.join(__dirname, ".tmp");
	if (FS.existsSync(tmpPath)) {
		FS.removeSync(tmpPath);
	}

	var assetBasePath = PATH.join(__dirname, "assets");

	function createTest(testName) {

    	it(testName, function(callback) {

			var resultPath = PATH.join(tmpPath, "smi-cli~" + testName);

    		function run(expectPath, callback) {

    			return FS.copy(PATH.join(assetBasePath, testName + ".smi.json"), PATH.join(resultPath, "package.json"), function(err) {
    				if (err) return callback(err);
    				var args = [
						"install"
					];
    				if (DEBUG) {
    					args.push("-vd");
    				}
					var proc = SPAWN(PATH.join(__dirname, "../bin/smi"), args, {
						cwd: resultPath
					});
					proc.on("error", callback);
					var stdout = [];
					proc.stdout.on('data', function (data) {
						stdout.push(data.toString());
						process.stdout.write(data);
					});
					proc.stderr.on('data', function (data) {
						process.stderr.write(data);
					});
					return proc.on('close', function (code) {
						if (code !== 0) {
							return callback(new Error("`sm install` did not exit with code 0 (code: " + code + ")!"));
						}
						var objects = {};
		                try {
		                    var re = /<wf\s+id\s*=\s*"([^"]+)"\s*>([\S\s]+?)<\s*\/wf\s*>/g;
		                    var m = null;
		                    while (m = re.exec(stdout.join(""))) {
		                        objects[m[1]] = JSON.parse(m[2]);
		                    }
		                } catch(err) {
		                    return callback(err);
		                }
						return DIRSUM.digest(resultPath, function(err, hashes) {
							if (err) return callback(err);
							var expectInfo = UTIL.normalizeInfo({
								hashes: hashes,
								info: objects.info
							});
							if (MODE === "write") {
								FS.outputFileSync(expectPath, JSON.stringify(expectInfo, null, 4));
							} else {
								ASSERT.deepEqual(expectInfo, FS.readJsonSync(expectPath));
							}
							return callback(null);
						});
					});
    			});
    		}

    		return run(PATH.join(assetBasePath, testName + ".expect.1.json"), function(err) {
    			if (err) return callback(err);
	    		return run(PATH.join(assetBasePath, testName + ".expect.2.json"), callback);
    		});
	    });
	}

	createTest("01-mappings-relpath");

});

