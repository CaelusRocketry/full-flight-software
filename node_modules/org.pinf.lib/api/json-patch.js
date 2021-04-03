
const JSONPATH = require("JSONPath");
const VARIABLES = require("../lib/variables");


exports.for = function (API) {

	var exports = {};

	// NOTE: This method manipulates the 'args.master' object that is passed in!
	exports.process = function (context) {

		return API.Q.denodeify(function (callback) {

			function applyPatch (patchInfo, callback) {

				var match = JSONPATH({
					json: context.master,
					path: patchInfo[0],
					resultType: 'all'
				});
				if (match.length === 0) {
					return callback(new Error("Could not match '" + patchInfo[0] + "'!"));
				}
				if (
					match &&
					match.length === 1
				) {
					match[0].parent[match[0].parentProperty] = API.DEEPMERGE(match[0].value, patchInfo[1]);
				}
				return callback(null);
			}

			var waitfor = API.WAITFOR.serial(function (err) {
				if (err) return callback(err);

				// All done.
				return callback(null, context.master);
			});

			if (context.extends.patches) {
				context.extends.patches.forEach(function (patchInfo) {
					waitfor(patchInfo, applyPatch);
				});
			}

			return waitfor();
		})();
	}

	return exports;
}
