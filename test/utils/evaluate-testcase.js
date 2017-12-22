/*
  Copyright JS Foundation and other contributors, https://js.foundation/

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

'use strict';

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../'),
            require('./error-to-object')
        );
    } else {
        root.evaluateTestCase = factory(esprima, errorToObject);
    }
}(this, function (esprima, errorToObject) {
    function NotMatchingError(expected, actual) {
        var rv = new Error('Expected ');
        rv.expected = expected;
        rv.actual = actual;
        return rv;
    }
    // NotMatchingError.prototype = new Error();

    function assertEquality(expected, actual) {
        if (expected !== actual) {
            throw new NotMatchingError(expected, actual);
        }
    }

    function sortedObject(o) {
        var keys, result;
        if (o === null) {
            return o;
        }
        if (Array.isArray(o)) {
            return o.map(sortedObject);
        }
        if (typeof o !== 'object') {
            return o;
        }
        if (o instanceof RegExp) {
            return o;
        }
        keys = Object.keys(o);
        result = {
            range: undefined,
            loc: undefined
        };
        keys.forEach(function (key) {
            if (o.hasOwnProperty(key)) {
                result[key] = sortedObject(o[key]);

                // Nullify regex value for ES6 regex flags
                if (key === 'value' && o.hasOwnProperty('regex')) {
                    if (o.regex.flags.match(/[uy]/)) {
                        result[key] = null;
                    }
                }
            }
        });
        return result;
    }

    function hasAttachedComment(syntax) {
        var key;
        for (key in syntax) {
            if (key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') {
                return true;
            }
            if (typeof syntax[key] === 'object' && syntax[key] !== null) {
                if (hasAttachedComment(syntax[key])) {
                    return true;
                }
            }
        }
        return false;
    }

    function testParse(code, testCase) {
        'use strict';
        var expected, tree, actual, options, i, len, nodes;
        var syntax = testCase.tree;

        // when the expected `syntax` value is an error/exception, we flag tolerance!
        var tolerant = (typeof syntax.message === 'string');
        // we're also tolerant when the parse AST/tree has errors:
        tolerant = tolerant || (typeof syntax.errors !== 'undefined');

        options = {
            jsx: true,
            comment: (typeof syntax.comments !== 'undefined'),
            range: true,
            loc: true,
            tokens: true,
            raw: true,
            tolerant: tolerant,
            source: null,
            sourceType: syntax.sourceType || (testCase.key.match(/\.module$/) ? 'module' : 'script')
        };

        if (options.comment) {
            options.attachComment = hasAttachedComment(syntax);
        }

        if (typeof syntax.tokens !== 'undefined') {
            if (syntax.tokens.length > 0) {
                options.range = (typeof syntax.tokens[0].range !== 'undefined');
                options.loc = (typeof syntax.tokens[0].loc !== 'undefined');
            }
        }

        if (typeof syntax.comments !== 'undefined') {
            if (syntax.comments.length > 0) {
                options.range = (typeof syntax.comments[0].range !== 'undefined');
                options.loc = (typeof syntax.comments[0].loc !== 'undefined');
            }
        }

        if (options.loc && syntax.loc) {
            options.source = syntax.loc.source;
        }

        syntax = sortedObject(syntax);
        expected = JSON.stringify(syntax, null, 4);
        try {
            // Some variations of the options.
            tree = esprima.parse(code, { jsx: options.jsx, tolerant: options.tolerant, sourceType: options.sourceType });
            tree = esprima.parse(code, { jsx: options.jsx, tolerant: options.tolerant, sourceType: options.sourceType, range: true });
            tree = esprima.parse(code, { jsx: options.jsx, tolerant: options.tolerant, sourceType: options.sourceType, loc: true });

            tree = (options.sourceType === 'script') ? esprima.parseScript(code, options) : esprima.parseModule(code, options);
            esprima.parse(code, options);

            if (options.tolerant) {
                for (i = 0, len = tree.errors.length; i < len; i += 1) {
                    tree.errors[i] = errorToObject(tree.errors[i]);
                }
            }
            tree = sortedObject(tree);
            actual = JSON.stringify(tree, null, 4);

            // Only to ensure that there is no error when using string object.
            esprima.parse(new String(code), options);

        } catch (e) {
            tree = errorToObject(e);
            tree.description = e.description;
            actual = JSON.stringify(tree, null, 4);

            // HACK: when we arrived here AND 'expected' happens to match 'actual' 
            // in the assert below, we are sure working on an erroneous input and 
            // all subsequent tests below WILL FAIL (intentionally).
            // 
            // We prevent those from throwing a spanner in the test works,
            // we 'tweak' the options object and flag our test case as 'tolerant'
            // so that the otherwise 'non-functional' check for that option
            // below will catch us and terminate the (successful!) test as desired:
            options.tolerant = true;
        }
        assertEquality(expected, actual);

        function filter(key, value) {
            return (key === 'loc' || key === 'range') ? undefined : value;
        }

        if (options.tolerant) {
            return;
        }

        // Check again without any location info.
        options.range = false;
        options.loc = false;
        syntax = sortedObject(syntax);
        expected = JSON.stringify(syntax, filter, 4);
        try {
            tree = esprima.parse(code, options);

            if (options.tolerant) {
                for (i = 0, len = tree.errors.length; i < len; i += 1) {
                    tree.errors[i] = errorToObject(tree.errors[i]);
                }
            }
            tree = sortedObject(tree);
            actual = JSON.stringify(tree, filter, 4);
        } catch (e) {
            tree = errorToObject(e);
            tree.description = e.description;
            actual = JSON.stringify(tree, null, 4);
        }
        assertEquality(expected, actual);

        function collect(node) {
            nodes.push(node);
        }

        function filter(node) {
            if (node.type === 'Program') {
                nodes.push(node);
            }
        }

        // Use the delegate to collect the nodes.
        try {
            nodes = [];
            esprima.parse(code, options, collect);
        } catch (e) {
            nodes = errorToObject(e);
            nodes.description = e.description;
            actual = JSON.stringify(nodes, null, 4);
            throw new NotMatchingError(expected, actual);
        }
        // The last one, the most top-level node, is always a Program node.
        assertEquality('Program', nodes.pop().type);

        // Use the delegate to filter the nodes.
        try {
            nodes = [];
            esprima.parse(code, options, filter);
        } catch (e) {
            nodes = errorToObject(e);
            nodes.description = e.description;
            actual = JSON.stringify(nodes, null, 4);
            throw new NotMatchingError(expected, actual);
        }
        // Every tree will have exactly one Program node.
        assertEquality('Program', nodes[0].type);

        // Exercise more code paths with the delegate
        try {
            esprima.parse(code);
            (options.sourceType === 'module') ? esprima.parseModule(code) : esprima.parseScript(code);
            esprima.parse(code, { range: false, loc: false, comment: false }, filter);
            esprima.parse(code, { range: true,  loc: false, comment: false }, filter);
            esprima.parse(code, { range: false, loc: true,  comment: false }, filter);
            esprima.parse(code, { range: true,  loc: true,  comment: false }, filter);
            esprima.parse(code, { range: false, loc: false, comment: true }, filter);
            esprima.parse(code, { range: true,  loc: false, comment: true }, filter);
            esprima.parse(code, { range: false, loc: true,  comment: true }, filter);
            esprima.parse(code, { range: true,  loc: true,  comment: true }, filter);
        } catch (e) {
            // Ignore, do nothing
        }
    }

    function testTokenize(code, tokens) {
        'use strict';
        var options, expected, actual, list, entries, types;
        var isErrorParse = false;

        options = {
            comment: true,
            tolerant: true,
            loc: true,
            range: true
        };

        expected = JSON.stringify(tokens, null, 4);

        try {
            // Some variations of the options (tolerant mode, to avoid premature error)
            esprima.tokenize(code, { tolerant: true, comment: false, loc: false, range: false });
            esprima.tokenize(code, { tolerant: true, comment: false, loc: false, range: true });
            esprima.tokenize(code, { tolerant: true, comment: false, loc: true,  range: false });
            esprima.tokenize(code, { tolerant: true, comment: false, loc: true,  range: true });
            esprima.tokenize(code, { tolerant: true, comment: true,  loc: false, range: false });
            esprima.tokenize(code, { tolerant: true, comment: true,  loc: false, range: true });
            esprima.tokenize(code, { tolerant: true, comment: true,  loc: true,  range: false });

            list = esprima.tokenize(code, options);
            actual = JSON.stringify(list, null, 4);
        } catch (e) {
            list = errorToObject(e);
            list.description = e.description;
            actual = JSON.stringify(list, null, 4);
        }
        assertEquality(expected, actual);

        // Use the delegate to collect the token separately.
        try {
            entries = [];
            esprima.tokenize(code, options, function (token) {
                entries.push(token);
                return token;
            });
            actual = JSON.stringify(entries, null, 4);
        } catch (e) {
            list = errorToObject(e);
            list.description = e.description;
            actual = JSON.stringify(list, null, 4);
        }
        assertEquality(expected, actual);

        // Use the delegate to filter the token type.
        try {
            entries = esprima.tokenize(code, options, function (token) {
                return token.type;
            });
            actual = JSON.stringify(entries, null, 4);
        } catch (e) {
            list = errorToObject(e);
            list.description = e.description;
            actual = JSON.stringify(list, null, 4);
           
            isErrorParse = true;
        }
        if (!isErrorParse) {
            types = tokens.map(function (t) {
                return t.type;
            });
            expected = JSON.stringify(types, null, 4);
        }
        assertEquality(expected, actual);

        // Exercise more code paths
        try {
            esprima.tokenize(code);
            esprima.tokenize(code, { tolerant: false });
        } catch (e) {
            // Ignore, do nothing
        }
    }

    function testError(code, testCase) {
        'use strict';
        var sourceType, i, options, exception, expected, code, actual, err, handleInvalidRegexFlag, tokenize;

        // Different parsing options should give the same error.
        sourceType = testCase.key.match(/\.module$/) ? 'module' : 'script';
        options = [
            { jsx: true, sourceType: sourceType },
            { jsx: true, comment: true, sourceType: sourceType },
            { jsx: true, raw: true, sourceType: sourceType },
            { jsx: true, raw: true, comment: true, sourceType: sourceType }
        ];

        // If handleInvalidRegexFlag is true, an invalid flag in a regular expression
        // will throw an exception. In some old version of V8, this is not the case
        // and hence handleInvalidRegexFlag is false.
        handleInvalidRegexFlag = false;
        try {
            'test'.match(new RegExp('[a-z]', 'x'));
        } catch (e) {
            handleInvalidRegexFlag = true;
        }

        exception = testCase.failure;
        exception.description = exception.message.replace(/Error: Line [0-9]+: /, '');

        if (exception.tokenize) {
            tokenize = true;
            exception.tokenize = undefined;
        }

        expected = JSON.stringify(exception, null, 4);

        for (i = 0; i < options.length; i += 1) {

            actual = undefined;
            try {
                if (tokenize) {
                    esprima.tokenize(code, options[i]);
                } else {
                    esprima.parse(code, options[i]);
                }
            } catch (e) {
                err = errorToObject(e);
                err.description = e.description;
                actual = JSON.stringify(err, null, 4);
            }

            if (expected !== actual) {

                // Compensate for old V8 which does not handle invalid flag.
                if (exception.message.indexOf('Invalid regular expression') > 0) {
                    if (typeof actual === 'undefined' && !handleInvalidRegexFlag) {
                        return;
                    }
                }

                throw new NotMatchingError(expected, actual);
            }

        }
    }

    return function (testCase) {
        var code = testCase.case || testCase.source || "";
        if (testCase.hasOwnProperty('tree')) {
            testParse(code, testCase);
        } else if (testCase.hasOwnProperty('tokens')) {
            testTokenize(code, testCase.tokens);
        } else if (testCase.hasOwnProperty('failure')) {
            testError(code, testCase);
        }
    }
}));
