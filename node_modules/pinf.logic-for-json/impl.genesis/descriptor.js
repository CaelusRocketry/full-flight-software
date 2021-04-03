

// POLICY: 'for' implies that something may need to be loaded and may return a promise for an API.
exports.for = function (API) {

	var exports = {};

	exports.fromFile = function (path, options) {

		function loadLegacy () {
			return API.Q.denodeify(function (callback) {
				return API.LEGACY.PACKAGE.fromFile(path, options || {}, function (err, descriptor) {
					if (err) return callback(err);
					return callback(null, descriptor._data);
				});
			})();
		}

		function loadDeclarations (descriptor) {

			var Descriptor = function (descriptor) {
				API.EXTEND(false, this, descriptor);
			}
			// POLICY: 'at' implies that everything is loaded and will return sync.
			Descriptor.prototype.at = function (id) {
				if (!this["@" + id]) return null;
				return new Descriptor(this["@" + id]);
			}

			return API.Q.resolve(new Descriptor(descriptor));
		}

		// First we load the legacy descriptor.
		return loadLegacy().then(function (descriptor) {
			// Now we parse and act on the top-level @ prefixed properties
			// and traverse them until no more encountered.
			return loadDeclarations(descriptor);
		});
	}

	return exports;
}

