

function augmentAPI (API) {

	API.PATH = require("path");
	API.FS = require("fs-extra");
	API.Q = require("q");
	API.WAITFOR = require("waitfor");
	API.ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");

	API.DESCRIPTOR = require("./impl.genesis/descriptor").for(API);
	API.LEGACY = {
		PACKAGE: require("./impl.legacy/package")
	};
}



exports.for = function (API) {

	augmentAPI(API);

	var Logic = function (origin) {
		var self = this;

		if (!/^file:\/\//.test(origin)) {
			throw new Error("Only 'file://' uris are supported at this time! Got '" + origin + "'");
		}

		self.originDescriptorPath = origin.replace(/^file:\/\//, "");
	}

	Logic.prototype.load = function (options) {
		var self = this;
		return API.DESCRIPTOR.fromFile(self.originDescriptorPath, options).then(function (descriptor) {
			return {
				origin: self.originDescriptorPath,
				descriptor: descriptor
			};
		});
	}

	return function (origin, options) {
		var logic = new Logic(origin);
		return logic.load(options);
	}
}

