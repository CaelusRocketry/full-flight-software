
const PATH = require("path");
const DEEPCOPY = require("deepcopy");


exports.normalizeEnvironmentVariables = function(env, overrides) {
	overrides = overrides || {};
	var ENV = DEEPCOPY(env || process.env);
	for (var name in overrides) {
		if (typeof overrides[name] !== "undefined") {
			ENV[name] = overrides[name];
		}
	}
	if (!ENV.PINF_PROGRAM && !ENV.CWD) {
		throw new Error("Either `ENV.PINF_PROGRAM` (" + ENV.PINF_PROGRAM + ") or `ENV.CWD` (" + ENV.CWD + ") must be set!");
	}
	// `PINF_PACKAGES` contains a list of directories used to lookup packages.
	// Packages should be stored in these directories where the package directory
	// represents the global ID of the package. This is ideally a DNS-based hostname with path.
	ENV.PINF_PACKAGES = (typeof ENV.PINF_PACKAGES === "string") ? ENV.PINF_PACKAGES : (process.env.PINF_PACKAGES || "");
	// If `PINF_PROGRAM_PARENT` is set the parent descriptor will be merged on top of our descriptor.
	// Under normal conditions the `PINF_PROGRAM_PARENT` varibale should never be set in the shell directly.
	// `PINF_PROGRAM_PARENT` is used when a program boots other programs as part of its own runtime to tell sub program
	// to store runtime info in parent context.
	// e.g. `/path/to/program.json`
	ENV.PINF_PROGRAM_PARENT = (typeof ENV.PINF_PROGRAM_PARENT === "string") ? ENV.PINF_PROGRAM_PARENT : (process.env.PINF_PROGRAM_PARENT || "");
	// These environment variables declare what to boot and in which state:
	//   * A local filesystem path to a `program.json` file (how to boot & custom config).
	ENV.PINF_PROGRAM = ENV.PINF_PROGRAM || PATH.join(ENV.CWD, "program.json");
	//   * A local filesystem path to a `package.json` file (what to boot & default config).
	ENV.PINF_PACKAGE = ENV.PINF_PACKAGE || (ENV.CWD && PATH.join(ENV.CWD, "package.json")) || "";
	//   * A local filesystem path to a `program.rt.json` file (the state to boot in).
	ENV.PINF_RUNTIME = ENV.PINF_RUNTIME || PATH.join(ENV.PINF_PROGRAM_PARENT || ENV.PINF_PROGRAM, "../.rt/program.rt.json");
	//   * The mode the runtime should run it. Will load `program.$PINF_MODE.json`.
	ENV.PINF_MODE = ENV.PINF_MODE || "production";
	return ENV;
}
