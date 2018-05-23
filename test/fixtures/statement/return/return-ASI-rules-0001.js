// Because of ASI rules, these two lines will parse as separate statements.
// (failed in recast+esprima)
function x() { 
	return
    "use strict"
}