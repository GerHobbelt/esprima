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
    regenTestCases = (process.argv && process.argv[1] === '--regenerate');      // set to TRUE to regenerate all reference test values

function generateTestCase(testCase) {
    var options, tree, filePath, fileName, servicedType, list, code, tokens, i, len;

    fileName = testCase.key + ".tree.json";
    try {
        options = {
            jsx: true,
            loc: true,
            range: true,
            tokens: true,
            sourceType: testCase.key.match(/\.module$/) ? 'module' : 'script'
        };
        code = testCase.case || testCase.source || "";
        tree = esprima.parse(code, options);
        tree = JSON.stringify(tree, null, 4);
        servicedType = 'tree';
    } catch (e) {
        if (typeof e.index === 'undefined') {
            console.error("Failed to generate test result.", e, testCase);
            throw e;
        }
        tree = errorToObject(e);
        tree.description = e.description;
        tree = JSON.stringify(tree, null, 4);
        fileName = testCase.key + ".failure.json";
        servicedType = 'failure';
    }

    filePath = path.join(__dirname, 'fixtures', fileName);
    fs.writeFileSync(filePath, tree);

    // when there are several test TYPES, generate them all:

    // PATCH: make sure we also have a 'tokens' test for all 'tokenize' tests!
    if (!testCase.tokens && testCase.key.match(/tokenize/)) {
        testCase.tokens = 666;
    }
    // PATCH: make sure we also have a 'tree' test for all 'tolerant-parse' tests!
    if (!testCase.tree && testCase.key.match(/tolerant/)) {
        testCase.tree = 111;
    }
    // PATCH: make sure we also have a 'tree' test next to every 'failure' test!
    if (!testCase.tree && servicedType === 'failure') {
        testCase.tree = 666;
    }

    // type: tokens
    if (testCase.hasOwnProperty('tokens')) {
        fileName = testCase.key + ".tokens.json";

        try {
            options = {
                jsx: true,
                tokens: true,
                sourceType: testCase.key.match(/\.module$/) ? 'module' : 'script',

                comment: true,
                tolerant: true,
                loc: true,
                range: true
            };
            code = testCase.case || testCase.source || "";

            list = esprima.tokenize(code, options);
        } catch (e) {
            console.warn("Failed to generate tokens test result.", e, testCase);

            list = errorToObject(e);
            list.description = e.description;
        }
        tree = JSON.stringify(list, null, 4);

        filePath = path.join(__dirname, 'fixtures', fileName);
        fs.writeFileSync(filePath, tree);
    }

    // type: tree    (i.e. when we found a *failure* but also want to see a *tree* output)
    if (servicedType === 'failure' && testCase.hasOwnProperty('tree')) {
        // also regenerate a 'tree' fixture, which includes the failure as an 'error' data chunk:

        fileName = testCase.key + ".tree.json";
        try {
            options = {
                sourceType: testCase.key.match(/\.module$/) ? 'module' : 'script',

                jsx: true,
                comment: true,
                range: true,
                loc: true,
                tokens: true,
                raw: true,
                tolerant: true,
                source: null,
            };
            code = testCase.case || testCase.source || "";
            tree = esprima.parse(code, options);

            for (i = 0, len = tree.errors.length; i < len; i++) {
                tree.errors[i] = errorToObject(tree.errors[i]);
            }

            tree = JSON.stringify(tree, null, 4);
            servicedType = 'tree';
        } catch (e) {
            // only terminate when we already had such a fixture type before, i.e. when we now fail to REgenerate the fixture:
            if (testCase.tree !== 666) {
                console.error("Failed to generate tree-on-failure test result.", e, testCase, options);
                throw e;
            } else {
                console.warn("Failed to generate tree-on-failure test result.", e.message);
            }
            tree = errorToObject(e);
            tree.description = e.description;
            tree = JSON.stringify(tree, null, 4);
        }

        filePath = path.join(__dirname, 'fixtures', fileName);
        fs.writeFileSync(filePath, tree);
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
            if (!e.expected) {
                throw e;
            }

            e.source = testCase.case || testCase.key;
            e.key = testCase.key;
            failures.push(e);
        }
    } else {
        console.error('Incomplete test case:' + testCase.key + '. Generating test result...');
        generateTestCase(testCase);
    }
});

tick = (new Date()) - tick;

header = total + ' tests. ' + failures.length + ' failures. ' + tick + ' ms';

if (failures.length) {
    console.error(header);
    failures.forEach(function (failure) {
        var expectedObject, actualObject;
        try {
            expectedObject = JSON.parse(failure.expected);
            actualObject = JSON.parse(failure.actual);

            console.error('=== ' + failure.key + ' === ::\n' + failure.source + ': Expected\n    ' +
                failure.expected.split('\n').join('\n    ') +
                '\nto match\n    ' + failure.actual + '\nDiff:\n' +
                diff(expectedObject, actualObject));
        } catch (ex) {
            console.error('=== ' + failure.key + ' === ::\n' + failure.source + ': Expected\n    ' +
                failure.expected.split('\n').join('\n    ') +
                '\nto match\n    ' + failure.actual);
        }
    });
} else {
    console.log(header);
}

process.exit(failures.length === 0 ? 0 : 1);
