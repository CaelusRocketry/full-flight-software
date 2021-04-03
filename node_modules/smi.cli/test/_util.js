

exports.normalizeInfo = function(descriptor) {

	function sortObject(o) {
	    var sorted = {},
	    key, a = [];

	    for (key in o) {
	    	if (o.hasOwnProperty(key)) {
	    		a.push(key);
	    	}
	    }

	    a.sort();

	    for (key = 0; key < a.length; key++) {
	    	if (typeof o[a[key]] === "object") {
		    	sorted[a[key]] = sortObject(o[a[key]]);
	    	} else {
		    	sorted[a[key]] = o[a[key]];
	    	}
	    }
	    return sorted;
	}

	return sortObject(descriptor);
}
