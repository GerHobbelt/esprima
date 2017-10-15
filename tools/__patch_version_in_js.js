
// fetch the version from package.json and patch the specified files

const version = require('../package.json').version;
const fs = require('fs');

 
var count = 0;

var updated = false;

var path = 'src/esprima.ts';
var src = fs.readFileSync(path, 'utf8');
src = src.replace(/^(\s*export const version = )([^;]+;)/gm, function repl(s, m1, m2) {
	if (m2 !== "'" + version + "';") {
		updated = true;
	}
	return m1 + "'" + version + "';";
});

if (updated) {
	count++;
	console.log('updated: ', path);
	fs.writeFileSync(path, src, {
        encoding: 'utf8',
        flags: 'w'
    });
}

console.log('\nUpdated', count, 'files\' version info to version', version);
