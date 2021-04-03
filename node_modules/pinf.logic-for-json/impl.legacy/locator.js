
const PATH = require("path");


exports.fromUid = function (uid) {
	return new Locator({
		location: uid,
		revision: "0"
	});
}

exports.fromUri = function (uri) {
	return new Locator({
		location: uri,
		revision: "0"
	});
}

exports.fromConfigId = function (id) {
	id = id.split("/");
	var revision = id.pop();
	return new Locator({
		location: id.join("/"),
		revision: revision
	});
}

exports.fromDeclaration = function (declaration) {
	if (typeof declaration === "string") {
		declaration = {
			location: declaration,
			revision: "0"
		};
	}
	return new Locator(declaration);
}

exports.fromConfigDepends = function ($to) {
	return new Locator({
		location: "x",
		revision: "0",
		alias: $to
	});
}


var Locator = exports.Locator = function (declaration) {
	this._declaration = declaration;
}

Locator.prototype.getConfigId = function () {
	return this._declaration.location + "/" + this._declaration.revision;
}

Locator.prototype.getUid = function () {
	return this._declaration.location;
}

Locator.prototype.getEnv = function () {
	return this._declaration.env || {};
}

Locator.prototype.setBasePath = function (path) {
	this._basePath = path;
}

Locator.prototype.getAbsolutePath = function () {
	if (/^\//.test(this._declaration.location)) {
		return this._declaration.location;
	}
	return PATH.join(this._basePath, this._declaration.location);
}

Locator.prototype.getConfig = function () {
	return this._declaration.config || null;
}

Locator.prototype.getAlias = function () {
	return this._declaration.alias || null;
}
