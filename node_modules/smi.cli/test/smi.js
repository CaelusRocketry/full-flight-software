
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs-extra");
const CRYPTO = require("crypto");
const DIRSUM = require("dirsum");
const FSWALKER = require("pinf-it-filetree-insight/fswalker");
const SMI = require("../lib/smi");
const UTIL = require("./_util");

//const MODE = "test";
const MODE = "write";

const DEBUG = false;


// TODO: For test 16 use two small npm packages that depend on each other instead of the
//       large smi packages!

describe('smi', function() {

	this.timeout(30 * 1000);
	var tmpPath = PATH.join(__dirname, ".tmp");
	if (FS.existsSync(tmpPath)) {
		FS.removeSync(tmpPath);
	}

	var assetBasePath = PATH.join(__dirname, "assets");


	function getFileTreeInfoFor (path, callback) {
		var self = this;

		var walker = new FSWALKER.Walker(path);
	    var opts = {};
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
	            hash: CRYPTO.createHash("md5").update(JSON.stringify(paths)).digest("hex")
	        });
	    });
	}

	FS.readdirSync(assetBasePath).forEach(function(filename) {
		if (!/^\d+-([^\.]+)\.smi\.json$/.test(filename)) return;

		var testName = filename.replace(/\.smi\.json$/, "");

//if (!/^16/.test(testName)) return;

    	it(testName, function(callback) {

			var resultPath = PATH.join(tmpPath, testName);

    		function run(expectPath, callback) {

    			SMI.setHome(PATH.join(tmpPath, ".smi"));

	    		return SMI.install(resultPath, PATH.join(assetBasePath, filename), {
	    			verbose: DEBUG,
	    			debug: DEBUG
	    		}, function(err, info) {
	    			if (err) return callback(err);

	    			function getFSInfo (callback) {
//						if (/^16/.test(testName)) {
			    			return getFileTreeInfoFor(resultPath, callback);
//			    		}
						return DIRSUM.digest(resultPath, callback);
	    			}

	    			return getFSInfo(function (err, fsinfo) {
	    				if (err) return callback(err);

						var expectInfo = UTIL.normalizeInfo({
							hashes: fsinfo,
							info: info
						});
						if (MODE === "write") {
							FS.outputFileSync(expectPath, JSON.stringify(expectInfo, null, 4));
						} else {
							ASSERT.deepEqual(expectInfo, FS.readJsonSync(expectPath));
						}
						return callback(null);
					});
	    		});
    		}

    		return run(PATH.join(assetBasePath, testName + ".expect.1.json"), function(err) {
    			if (err) return callback(err);
	    		return run(PATH.join(assetBasePath, testName + ".expect.2.json"), callback);
    		});
	    });
	});

});

