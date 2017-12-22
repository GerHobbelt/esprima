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

var esprima = require('../'),
    evaluateTestCase = require('./utils/evaluate-testcase'),
    createTestCases = require('./utils/create-testcases'),
    errorToObject = require('./utils/error-to-object'),
    fs = require('fs'),
    path = require('path'),
    diff = require('json-diff').diffString,
    total = 0,
    result,
    failures = [],
    cases = {},
    context = { source: '', result: null },
    tick = new Date(),
    testCase,
    header,
    regenTestCases = (process.argv && process.argv[2] === '--regenerate'),      // set to TRUE to regenerate all reference test values
    debug = false;              // set to TRUE if you want to see extensive logging.

function generateTestCase(testCase) {
    var fileName, filePath, fileContent;

    // set up testCase instance to allow `evaluateTestCase(testCase)` to produce
    // sensible exceptions, which we can use to obtain the actual expected result:
    //
    // start with 'failure' mode testing...
    testCase.failure = errorToObject(new Error('fake'));
    delete testCase.tokens;
    delete testCase.tree;

    var expected = 'fake';
    var actual;

    for (;;) {
        if (debug) console.log("testing parse failure...", expected);

        actual = undefined;
        try {
            evaluateTestCase(testCase);

            // test PASSED OK
            actual = expected;
            break;
        } catch (e) {
            actual = e.actual;
            // console.error('boink!', e, '\nstack:', e.stack, '\ntestcase:', testCase, '\nARGV:', process.argv);
            if (!e.expected) {
                throw e;
            }
            if (expected === actual || actual === undefined) {
                break;
            }
            expected = actual;
            testCase.failure = JSON.parse(expected);
            continue;
        }
    }

    if (actual !== undefined) {
        if (debug) console.log("accept parse failure...", expected);
        fileName = testCase.key + ".failure.json";

        filePath = path.join(__dirname, 'fixtures', fileName);
        fileContent = expected;
        // fs.writeFileSync(filePath, expected);
    } else {
        if (debug) console.log("NO parse failure...", expected);
        delete testCase.failure;
    }

    // then check if we need tokenization tests as well...
    //
    // make sure we also have a 'tokens' test for all 'tokenize' tests!
    if (testCase.tokens || testCase.key.match(/tokenize/)) {
        var failureBackup = testCase.failure;

        // first of all, check if we have a failure for tokenization:
        testCase.failure = errorToObject(new Error('fake'));
        testCase.failure.tokenize = true;

        expected = 'fake';

        for (;;) {
            if (debug) console.log("testing tokenize failure...", expected);

            actual = undefined;
            try {
                evaluateTestCase(testCase);

                // test PASSED OK
                actual = expected;
                break;
            } catch (e) {
                actual = e.actual;
                // console.error('boink!', e, '\nstack:', e.stack, '\ntestcase:', testCase, '\nARGV:', process.argv);
                if (!e.expected) {
                    throw e;
                }
                if (expected === actual || actual === undefined) {
                    break;
                }
                expected = actual;
                testCase.failure = JSON.parse(expected);
                testCase.failure.tokenize = true;
                continue;
            }
        }

        // overwrite the parse failure fixture: if we already have a failure in tokenization,
        // we don't bother with the higher level failure anyway.
        if (actual !== undefined) {
            testCase.failure = JSON.parse(expected);
            testCase.failure.tokenize = true;
            expected = JSON.stringify(testCase.failure, null, 4);

            if (debug) console.log("accept tokenize parse failure...", expected);
            fileName = testCase.key + ".failure.json";

            filePath = path.join(__dirname, 'fixtures', fileName);
            fileContent = expected;
            // fs.writeFileSync(filePath, expected);
        } else {
            if (debug) console.log("NO tokenize parse failure...", expected);
            delete testCase.failure;

            if (failureBackup) {
                testCase.failure = failureBackup;
            }



            // now check if we can tokenize okay: only try it when there's no tokenize error
            // already above.
            testCase.tokens = ['fake'];

            expected = 'fake';

            for (;;) {
                if (debug) console.log("testing tokens...", expected);

                actual = undefined;
                try {
                    evaluateTestCase(testCase);

                    // test PASSED OK
                    break;
                } catch (e) {
                    actual = e.actual;
                    // console.error('boink!', e, '\nstack:', e.stack, '\ntestcase:', testCase, '\nARGV:', process.argv);
                    if (!e.expected) {
                        throw e;
                    }
                    if (expected === actual || actual === undefined) {
                        break;
                    }
                    expected = actual;
                    testCase.tokens = JSON.parse(expected);
                }
            }

            // when `actual` is UNDEFINED, we actually did PASS the test: then
            // `expected` has the correct test result. In the other case where
            // we exit the loop above, it's also `expected` which will carry
            // the correct reference value...
            fileName = testCase.key + ".tokens.json";

            filePath = path.join(__dirname, 'fixtures', fileName);
            fileContent = expected;
            // fs.writeFileSync(filePath, expected);
        }
    }

    // then check if we might exec a parse and maybe obtain an AST (tree)...
    // but only when we didn't already do a tokenize round, for then that
    // one would get overruled.
    if (!testCase.tokens) {
        testCase.tree = {
            comments: true,
            errors: true            // ~> options.tolerant = true
        };
        // PATCH: make sure we also have a 'tree' test for all 'tolerant-parse' tests!
        //     testCase.key.match(/tolerant/)

        expected = 'fake';

        for (;;) {
            if (debug) console.log("testing tree...", expected);

            actual = undefined;
            try {
                evaluateTestCase(testCase);

                // test PASSED OK
                break;
            } catch (e) {
                actual = e.actual;
                // console.error('boink!', e, '\nstack:', e.stack, '\ntestcase:', testCase, '\nARGV:', process.argv);
                if (!e.expected) {
                    throw e;
                }
                if (expected === actual || actual === undefined) {
                    break;
                }
                // catch `assertEquality('Program', nodes....type);`:
                if (e.expected === 'Program') {
                    // do NOT nuke `expected`, but simply terminate:
                    break;
                }

                expected = actual;
                testCase.tree = JSON.parse(expected);
            }
        }

        // when `actual` is UNDEFINED, we actually did PASS the test: then
        // `expected` has the correct test result. In the other case where
        // we exit the loop above, it's also `expected` which will carry
        // the correct reference value...
        //
        // If `expected` is a plain error, there's no use running an entire
        // parse as we'll already have a 'failure' fixture for this one surely.
        testCase.tree = JSON.parse(expected);
        // when the new 'expected' value still is an exception, we only
        // save it when there's no 'failure'...
        if (typeof testCase.tree.message === 'string') {
            if (!testCase.failure) {
                if (debug) console.error('Unexpected combination of NO FAILURE yet a failing PARSE test!', testCase);
                throw new Error('Unexpected combination of NO FAILURE yet a failing PARSE test!');
            }
            if (debug) console.log("NO parse tree result...", fileContent);
        } else {
            if (debug) console.log("accept parse tree result...", expected);
            fileName = testCase.key + ".tree.json";

            filePath = path.join(__dirname, 'fixtures', fileName);
            fileContent = expected;
            // fs.writeFileSync(filePath, expected);
        }
    }

    if (!fileContent) {
        throw new Error('Unexpected: none of the three test modes delivered any reference content. Target = ' + fileName);
    } else {
        if (debug) console.log("dumping...", fileContent);
        fs.writeFileSync(filePath, fileContent);
    }

    console.error("Done.");
}

cases = createTestCases();
total = Object.keys(cases).length;

Object.keys(cases).forEach(function (key) {
    testCase = cases[key];

    if (!regenTestCases
        && (testCase.hasOwnProperty('tree')
            || testCase.hasOwnProperty('tokens')
            || testCase.hasOwnProperty('failure')
            || testCase.hasOwnProperty('result')
        )
    ) {
        try {
            evaluateTestCase(testCase);
        } catch (e) {
            // console.error('boink!', e, '\nstack:', e.stack, '\ntestcase:', testCase, '\nARGV:', process.argv);
            if (!e.expected) {
                throw e;
            }

            e.source = testCase.case || testCase.key;
            e.key = testCase.key;
            failures.push(e);
        }
    } else {
        if (debug) {
            console.error('Incomplete test case:' + testCase.key + '. Generating test result...', {
                regenTestCases,
                testCase
            });
        } else {
            console.error('Incomplete test case:' + testCase.key + '. Generating test result...');
        }

        generateTestCase(testCase);
    }
});

tick = (new Date()) - tick;

header = total + ' tests. ' + failures.length + ' failures. ' + tick + ' ms';

if (failures.length) {
    console.error(header);
    failures.forEach(function (failure) {
        var expectedObject, actualObject;
        var expected = (typeof failure.expected === 'string' ? failure.expected.split('\n').join('\n    ') : failure.expected);
        var actual = (typeof failure.actual === 'string' ? failure.actual.split('\n').join('\n    ') : failure.actual);

        try {
            expectedObject = JSON.parse(failure.expected);
            actualObject = JSON.parse(failure.actual);

            console.error('=== ' + failure.key + ' === ::\n' + failure.source + ': Expected\n    ' +
                expected +
                '\nto match\n    ' +
                actual +
                '\nDiff:\n' +
                diff(expectedObject, actualObject));
        } catch (ex) {
            console.error('=== ' + failure.key + ' === ::\n' + failure.source + ': Expected\n    ' +
                expected +
                '\nto match\n    ' +
                actual);
        }
    });
} else {
    console.log(header);
}

process.exit(failures.length === 0 ? 0 : 1);
