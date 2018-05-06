module.exports = {
    mode: 'none',
    entry:  __dirname + "/src/esprima.js",
    output: {
        path:  __dirname + "/dist",
        filename: "esprima.js",
        libraryTarget: "umd",
        library: "esprima"
    }
}
