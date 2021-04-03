#!/bin/bash -e

if ! hash smi 2>/dev/null; then
	echo "'smi' command not found on path!"
	echo '<wf name="result">{"success": false}</wf>'
	exit 1
fi

smi -h

echo '<wf name="result">{"success": true}</wf>'

exit 0
