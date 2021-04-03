smi
===

*Package Installation. Evolved.*

**Status: DEV**

The `smi` command installs packages and assets mapped in a `package.json` file into the directory structure of the declaring package.

It addresses the package installation features needed by a modern development workflow and can be thought of as building on top of [npm](https://www.npmjs.org/).

Most notably; `smi` adds an abstraction layer allowing the mapping of arbitrary external resources into arbitrary aliased namespeces within the package. This divorces the dependency implementation from the use of the dependency which is the foundation for supporting recomposable applications and systems.

At any time you should be able to *overlay* the package descriptor (`package.json`) and set a different dependency implementation for a given environment the package will run in. Assuming the alternate implementation exposes the same API, the declaring package should function as before.

`smi` embodies these principles and thus is a package installer suitable for use in a distributed system with diverse deployment requirements.

Features:

  * Declare dependencies using JSON
  * Install dependencies using command-line call
  * Idempotent operation for easy scripting integration
  * Compatible with `npm` ecosystem
  * Takes *npm dependencies* to another level
  * Reference assets using URIs
  * Reference assets using catalogs
  * Embeddable into NodeJS apps
  * Circular dependencies are no problem
  * Compose arbitrary namespaces
  * Environment specific dependencies
  * Extract many different types of archives


Install
-------

	npm install -g smi.cli

Usage:

	smi -h

Test:

	npm test


Docs
====

Declaring dependencies
----------------------

`package.json`

	{
		"upstream": {
	        "packages": {
	        	// Auto-link dependencies
	            "./local": "./../common/*"
	        },
			"catalogs": {
				"<id>": "<locator>",
				"archiveA": "./catalog.json"
			}
		},
		"mappings": {
			"<id>": "<locator>",
			// Place extracted archive anywhere
			"./local/archive1": "http://remote.com/archiveA.tar.gz",
			// or into `_packages` by default
			"archive1": "http://remote.com/archiveA.tar.gz",
			// Map packages using a catalog
			"archive2": "catalog1/archiveA"
		}
	}

`catalog.json`

	{
		"packages": {
			"archiveA": "http://remote.com/archiveA.tar.gz"
		}
	}

For a complete resource of supported *locators* see [./test/assets](https://github.com/sourcemint/smi/tree/master/test/assets).


Installing Dependencies
-----------------------

By calling `smi` directly from the command-line:

	smi install

A typical approach is to integrate it into the installation procedure of an existing `npm` package which can be done as follows.

`package.json`

	{
		"dependencies": {
			"smi.cli": "0.x"
		},
		"scripts": {
			"install": "./node_modules/.bin/smi install"
		}
	}

Extending Descriptors
---------------------

To compose the dependencies of a package one can extend existing descriptors. Each successive descriptor
gets merged on top of the previous one after resolving its own extends URLs and finally the declaring
descriptor (and its overlays) have final say.

	{
		"extends": [
			"./local/prototype/descriptor.json",
			"http://remote.com/prototype/descriptor.json",
			"<id>/prototype/descriptor.json"
		]
	}


TODO
====

  * Wrap various third party installers (e.g. `bower`, `composer`)
  * Resolve version selectors into release streams
  * Write install history
  * Write more meta data
  * Cleanup
  * Refactor to run on *pinf* program prototype


License
=======

Copyright (c) 2014 Christoph Dorn

MIT License
