q-throttle
==========

Throttle number of promises running in parallel. Additional promises may be added to queue while processing queue.


Install
-------

	npm install q
	npm install q-throttle


Usage
-----
    
    var Q = require("q");
    
	   // Require this module (to add `Q.Throttle` to the `Q` API)
    Q.Throttle = require("q-throttle").Throttle;
    
    // Maximum of 3 unresolved promises at a time
    var throttle = Q.Throttle(3);
    
    for (var i=0 ; i < 10 ; i++) {
        throttle.when([i], function(i) {
            // Never more than 3 unresolved doDeferredWork() promises
            return doDeferredWork(i).then(function() {
            });
        });
    }

    throttle.on("done", function()
    {
    });


Legal
-----

Copyright 2012 Christoph Dorn

MIT License
