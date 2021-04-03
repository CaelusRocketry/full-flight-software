
const Q = require("q");
const PATH = require("path");
const DESCRIPTOR = require("./descriptor");
const LOCATOR = require("./locator");
const DEEPMERGE = require("deepmerge");
const ESCAPE_REGEXP_COMPONENT = require("escape-regexp-component");


exports.fromFile = function (path, options, callback) {
	return DESCRIPTOR.fromFile(PackageDescriptor, path, options, callback);
}

var PackageDescriptor = function (path, data, options) {
	DESCRIPTOR.Descriptor.prototype.constructor.call(this, PackageDescriptor, path, data, options);
}
PackageDescriptor.type = "PackageDescriptor";
PackageDescriptor.prototype = Object.create(DESCRIPTOR.Descriptor.prototype);

PackageDescriptor.prototype.configForLocator = function (locator) {
	var self = this;
	var configId = locator.getConfigId();
	if (
		!self._data ||
		!self._data.config ||
		!self._data.config[configId]
	) {
		return false;
	}
	return self._data.config[configId];
}
